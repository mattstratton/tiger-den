import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { indexingConfig } from "~/server/config/indexing-config";
import { db } from "~/server/db";
import { contentChunks, contentText } from "~/server/db/schema";
import { chunkContent } from "./content-chunker";
import { ContentFetchError, fetchContent } from "./content-fetcher";
import { getQueue } from "~/server/queue/indexing-queue";
import { generateEmbedding } from "./embeddings";

export interface IndexingResult {
  success: boolean;
  contentItemId: string;
  error?: string;
}

export interface IndexingStats {
  total: number;
  succeeded: number;
  failed: number;
  queued: number;
  results: IndexingResult[];
}

/**
 * Calculate SHA256 hash of text
 */
function calculateHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Index a single content item
 * Fetches content, chunks it, stores in database
 */
export async function indexSingleItem(
  contentItemId: string,
  url: string,
): Promise<IndexingResult> {
  try {
    // Step 1: Fetch content
    const fetchResult = await fetchContent(url);

    // Handle empty content (e.g., no YouTube transcript)
    if (!fetchResult.plainText) {
      return {
        success: false,
        contentItemId,
        error: "No content available (empty or transcript unavailable)",
      };
    }

    // Step 2: Check for redirects to avoid duplicate content
    if (fetchResult.wasRedirected) {
      console.log(
        `[Redirect] ${url} → ${fetchResult.finalUrl} for item ${contentItemId}`,
      );

      // Check if the final URL already exists for a different content item
      const existingItem = await db.query.contentItems.findFirst({
        where: (items, { eq, and, ne }) =>
          and(eq(items.currentUrl, fetchResult.finalUrl), ne(items.id, contentItemId)),
        columns: { id: true, title: true },
      });

      if (existingItem) {
        return {
          success: false,
          contentItemId,
          error: `URL redirects to ${fetchResult.finalUrl} which already exists (${existingItem.title})`,
        };
      }
    }

    const contentHash = calculateHash(fetchResult.plainText);

    // Step 3: Store or update full content (upsert for pending items)
    const [contentTextRecord] = await db
      .insert(contentText)
      .values({
        contentItemId,
        fullText: fetchResult.fullText,
        plainText: fetchResult.plainText,
        wordCount: fetchResult.wordCount,
        tokenCount: fetchResult.tokenCount,
        contentHash,
        crawlDurationMs: fetchResult.duration,
        indexStatus: "pending",
      })
      .onConflictDoUpdate({
        target: contentText.contentItemId,
        set: {
          fullText: fetchResult.fullText,
          plainText: fetchResult.plainText,
          wordCount: fetchResult.wordCount,
          tokenCount: fetchResult.tokenCount,
          contentHash,
          crawlDurationMs: fetchResult.duration,
          indexStatus: "pending",
        },
      })
      .returning();

    if (!contentTextRecord) {
      throw new Error("Failed to upsert content_text record");
    }

    // Step 4: Chunk content
    const chunks = await chunkContent(fetchResult.plainText);

    // Step 5: Generate embeddings and store chunks
    // Generate embeddings in parallel for better performance
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const embedding = await generateEmbedding(chunk.text);
          return {
            contentTextId: contentTextRecord.id,
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            chunkTokenCount: chunk.tokenCount,
            embedding: embedding, // Pass array directly - Drizzle handles halfvec conversion
          };
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${chunk.index}:`, error);
          // Store chunk without embedding rather than failing entirely
          return {
            contentTextId: contentTextRecord.id,
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            chunkTokenCount: chunk.tokenCount,
            embedding: null,
          };
        }
      }),
    );

    await db.insert(contentChunks).values(chunksWithEmbeddings);

    // Step 6: Mark as indexed
    await db
      .update(contentText)
      .set({
        indexStatus: "indexed",
        indexedAt: new Date(),
      })
      .where(eq(contentText.id, contentTextRecord.id));

    return {
      success: true,
      contentItemId,
    };
  } catch (error) {
    // Store error in database
    try {
      const existing = await db.query.contentText.findFirst({
        where: eq(contentText.contentItemId, contentItemId),
      });

      if (existing) {
        await db
          .update(contentText)
          .set({
            indexStatus: "failed",
            indexError:
              error instanceof ContentFetchError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : "Unknown error",
          })
          .where(eq(contentText.id, existing.id));
      }
    } catch (dbError) {
      console.error("Failed to update error status:", dbError);
    }

    return {
      success: false,
      contentItemId,
      error:
        error instanceof ContentFetchError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
    };
  }
}

/**
 * Index a content item that already has content_text populated (e.g. from API sync).
 * Skips fetching — just chunks and generates embeddings.
 */
export async function indexFromExistingContent(
  contentTextId: string,
): Promise<IndexingResult> {
  try {
    const record = await db.query.contentText.findFirst({
      where: eq(contentText.id, contentTextId),
    });

    if (!record || !record.plainText) {
      return {
        success: false,
        contentItemId: contentTextId,
        error: "No content_text record or empty plainText",
      };
    }

    // Delete any old chunks for this content_text
    await db
      .delete(contentChunks)
      .where(eq(contentChunks.contentTextId, record.id));

    // Chunk content
    const chunks = await chunkContent(record.plainText);

    // Generate embeddings and store chunks
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const embedding = await generateEmbedding(chunk.text);
          return {
            contentTextId: record.id,
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            chunkTokenCount: chunk.tokenCount,
            embedding,
          };
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${chunk.index}:`, error);
          return {
            contentTextId: record.id,
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            chunkTokenCount: chunk.tokenCount,
            embedding: null,
          };
        }
      }),
    );

    await db.insert(contentChunks).values(chunksWithEmbeddings);

    // Mark as indexed
    await db
      .update(contentText)
      .set({
        indexStatus: "indexed",
        indexedAt: new Date(),
        indexError: null,
      })
      .where(eq(contentText.id, record.id));

    return {
      success: true,
      contentItemId: record.contentItemId,
    };
  } catch (error) {
    return {
      success: false,
      contentItemId: contentTextId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Index multiple content items
 * Sync for ≤10 items, mark as pending for 11+
 */
export async function indexContent(
  items: Array<{ id: string; url: string }>,
): Promise<IndexingStats> {
  if (!indexingConfig.enableIndexing) {
    return {
      total: items.length,
      succeeded: 0,
      failed: 0,
      queued: 0,
      results: items.map((item) => ({
        success: false,
        contentItemId: item.id,
        error: "Content indexing disabled (ENABLE_CONTENT_INDEXING=false)",
      })),
    };
  }

  // Sync indexing for ≤ threshold
  if (items.length <= indexingConfig.syncThreshold) {
    const results: IndexingResult[] = [];

    for (const item of items) {
      const result = await indexSingleItem(item.id, item.url);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: items.length,
      succeeded,
      failed,
      queued: 0,
      results,
    };
  }

  // Async indexing - sync first N items, enqueue rest
  const syncItems = items.slice(0, indexingConfig.syncThreshold);
  const queueItems = items.slice(indexingConfig.syncThreshold);

  // Process first batch synchronously
  const syncResults: IndexingResult[] = [];
  for (const item of syncItems) {
    const result = await indexSingleItem(item.id, item.url);
    syncResults.push(result);
  }

  // Enqueue remaining items
  const queue = await getQueue();
  const queueResults: IndexingResult[] = [];

  for (const item of queueItems) {
    try {
      // Enqueue job with singleton key to prevent duplicates
      await queue.send(
        "index-content",
        { contentItemId: item.id, url: item.url },
        { singletonKey: item.id },
      );

      // Create placeholder content_text record
      await db.insert(contentText).values({
        contentItemId: item.id,
        fullText: "",
        plainText: "",
        wordCount: 0,
        tokenCount: 0,
        contentHash: "",
        crawlDurationMs: 0,
        indexStatus: "pending",
      });

      queueResults.push({
        success: true,
        contentItemId: item.id,
      });
    } catch (error) {
      queueResults.push({
        success: false,
        contentItemId: item.id,
        error:
          error instanceof Error ? error.message : "Failed to enqueue item",
      });
    }
  }

  // Combine results
  const allResults = [...syncResults, ...queueResults];
  const succeeded = syncResults.filter((r) => r.success).length;
  const failed = syncResults.filter((r) => !r.success).length;
  const queued = queueResults.filter((r) => r.success).length;

  return {
    total: items.length,
    succeeded,
    failed,
    queued,
    results: allResults,
  };
}
