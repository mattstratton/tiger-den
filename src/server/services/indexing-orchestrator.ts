import { db } from "~/server/db";
import { contentText, contentChunks } from "~/server/db/schema";
import { indexingConfig } from "~/server/config/indexing-config";
import { fetchContent, ContentFetchError } from "./content-fetcher";
import { chunkContent } from "./content-chunker";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface IndexingResult {
  success: boolean;
  contentItemId: string;
  error?: string;
}

export interface IndexingStats {
  total: number;
  succeeded: number;
  failed: number;
  results: IndexingResult[];
}

/**
 * Calculate SHA256 hash of text
 */
function calculateHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
