import { db } from "~/server/db";
import { contentChunks, contentText } from "~/server/db/schema";
import { indexingConfig } from "~/server/config/indexing-config";
import { sql } from "drizzle-orm";

export interface SearchResult {
  contentItemId: string;
  chunkId: string;
  chunkText: string;
  relevanceScore: number;
  matchType: "hybrid";
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
  k: number = indexingConfig.rrfK,
  limit: number = 10,
): SearchResult[] {
  const scores = new Map<string, number>();
  const dataMap = new Map<string, QueryRow>();

  // Keyword rankings
  keywordResults.forEach((row, i) => {
    const key = row.chunk_id;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
    dataMap.set(key, row);
  });

  // Semantic rankings
  semanticResults.forEach((row, i) => {
    const key = row.chunk_id;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
    dataMap.set(key, row);
  });

  // Sort and return top results
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([chunkId, score]) => {
      const data = dataMap.get(chunkId)!;
      return {
        contentItemId: data.content_item_id,
        chunkId,
        chunkText: data.chunk_text,
        relevanceScore: score,
        matchType: "hybrid",
      };
    });
}
