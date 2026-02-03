import { sql } from "drizzle-orm";
import { indexingConfig } from "~/server/config/indexing-config";
import { db } from "~/server/db";

export interface KeywordSearchResult {
  contentItemId: string;
  chunkId: string;
  chunkText: string;
  relevanceScore: number;
  matchType: "keyword";
}

interface QueryRow {
  content_item_id: string;
  chunk_id: string;
  chunk_text: string;
}

/**
 * Keyword-only search using BM25
 * No semantic search, no OpenAI API calls, no cost
 * Fast and effective for exact keyword matching
 */
export async function keywordSearch(
  query: string,
  limit: number = 10,
): Promise<KeywordSearchResult[]> {
  console.log(`[keywordSearch] Searching for: "${query}", limit: ${limit}`);

  // Query: Full-text keyword search using PostgreSQL native search
  const results = await db.execute(sql`
    SELECT
      ct.content_item_id,
      cc.id as chunk_id,
      cc.chunk_text,
      ts_rank(to_tsvector('english', cc.chunk_text), plainto_tsquery('english', ${query})) as score
    FROM tiger_den.content_chunks cc
    JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
    WHERE to_tsvector('english', cc.chunk_text) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${limit}
  `);

  console.log(`[keywordSearch] Found ${(results as unknown as QueryRow[]).length} results`);

  // Convert to result format with normalized relevance scores
  // BM25 scores are already normalized by pg_textsearch
  return (results as unknown as QueryRow[]).map((row, index) => ({
    contentItemId: row.content_item_id,
    chunkId: row.chunk_id,
    chunkText: row.chunk_text,
    relevanceScore: 1 / (index + 1), // Simple rank-based score
    matchType: "keyword",
  }));
}
