import { sql } from "drizzle-orm";
import { indexingConfig } from "~/server/config/indexing-config";
import { db } from "~/server/db";
import { extractSmartSnippet } from "./snippet-extractor";

export interface SearchResult {
  contentItemId: string;
  chunkId: string;
  chunkText: string;
  snippet: string;
  relevanceScore: number;
  matchType: "keyword" | "semantic" | "both";
  matchedTerms: string[];
}

interface QueryRow {
  content_item_id: string;
  chunk_id: string;
  chunk_text: string;
}

/**
 * Reciprocal Rank Fusion (RRF)
 * Combines keyword and semantic search rankings
 * Formula: score = 1 / (k + rank)
 */
function rrfFusion(
  keywordResults: QueryRow[],
  semanticResults: QueryRow[],
  searchQuery: string,
  k: number = indexingConfig.rrfK,
  limit: number = 10,
): SearchResult[] {
  const scores = new Map<string, number>();
  const dataMap = new Map<string, QueryRow>();

  // Track which chunks appeared in which source
  const keywordChunks = new Set<string>();
  const semanticChunks = new Set<string>();

  // Keyword rankings
  keywordResults.forEach((row, i) => {
    const key = row.chunk_id;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
    dataMap.set(key, row);
    keywordChunks.add(key);
  });

  // Semantic rankings
  semanticResults.forEach((row, i) => {
    const key = row.chunk_id;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
    dataMap.set(key, row);
    semanticChunks.add(key);
  });

  // Sort and return top results
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([chunkId, score]) => {
      const data = dataMap.get(chunkId)!;

      // Determine match type
      const inKeyword = keywordChunks.has(chunkId);
      const inSemantic = semanticChunks.has(chunkId);
      const matchType = inKeyword && inSemantic ? "both" :
                        inKeyword ? "keyword" : "semantic";

      // Extract smart snippet
      const { snippet, matchedTerms } = extractSmartSnippet(
        data.chunk_text,
        searchQuery,
      );

      return {
        contentItemId: data.content_item_id,
        chunkId,
        chunkText: data.chunk_text,
        snippet,
        relevanceScore: score,
        matchType,
        matchedTerms,
      };
    });
}

/**
 * Hybrid search: BM25 keyword + vector semantic with RRF fusion
 * Runs queries in parallel, fuses results client-side
 */
export async function hybridSearch(
  query: string,
  embedding: number[],
  limit: number = 10,
): Promise<SearchResult[]> {
  const candidateLimit = indexingConfig.candidatesPerSearch;

  // Run both queries in parallel
  const [keywordResults, semanticResults] = await Promise.all([
    // Query 1: Full-text keyword search using PostgreSQL native search
    db.execute(sql`
      SELECT
        ct.content_item_id,
        cc.id as chunk_id,
        cc.chunk_text
      FROM tiger_den.content_chunks cc
      JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
      WHERE to_tsvector('english', cc.chunk_text) @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(to_tsvector('english', cc.chunk_text), plainto_tsquery('english', ${query})) DESC
      LIMIT ${candidateLimit}
    `),

    // Query 2: Vector semantic search
    (async () => {
      const embeddingStr = `[${embedding.join(",")}]`;
      return db.execute(sql`
        SELECT
          ct.content_item_id,
          cc.id as chunk_id,
          cc.chunk_text
        FROM tiger_den.content_chunks cc
        JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
        WHERE cc.embedding IS NOT NULL
        ORDER BY cc.embedding <=> ${sql.raw(`'${embeddingStr}'::halfvec(1536)`)}
        LIMIT ${candidateLimit}
      `);
    })(),
  ]);

  // Fuse with RRF
  return rrfFusion(
    keywordResults as unknown as QueryRow[],
    semanticResults as unknown as QueryRow[],
    query,
    indexingConfig.rrfK,
    limit,
  );
}
