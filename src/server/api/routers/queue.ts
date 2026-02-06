import { eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { contentItems, contentText } from "~/server/db/schema";
import { getQueue } from "~/server/queue/indexing-queue";
import { indexContent } from "~/server/services/indexing-orchestrator";

export const queueRouter = createTRPCRouter({
  /**
   * Get queue statistics
   */
  getStats: protectedProcedure.query(async () => {
    const queue = await getQueue();

    // Get job counts by state
    const [created, active, completed, failed] = await Promise.all([
      queue.getQueueSize("index-content", { before: "active" }),
      queue.getQueueSize("index-content", { before: "completed" }),
      queue.getQueueSize("index-content", { before: "failed" }),
      queue.getQueueSize("index-content"),
    ]);

    // Get count of pending items in database
    const pendingItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "pending"),
    });

    // Get count of content items with no content_text row (never indexed)
    const notIndexedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM tiger_den.content_items ci
      WHERE NOT EXISTS (
        SELECT 1 FROM tiger_den.content_text ct WHERE ct.content_item_id = ci.id
      )
    `);
    const notIndexed = Number((notIndexedResult as unknown as Array<{ count: string }>)[0]?.count ?? 0);

    // Get count of indexed items
    const indexedItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "indexed"),
    });

    // Get count of failed items in content_text
    const failedItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "failed"),
    });

    return {
      queued: created,
      processing: active,
      completed: completed - active,
      failed,
      pending: pendingItems.length,
      notIndexed,
      indexed: indexedItems.length,
      failedIndexing: failedItems.length,
    };
  }),

  /**
   * Pause the worker
   */
  pause: protectedProcedure.mutation(async () => {
    const queue = await getQueue();
    await queue.offWork("index-content");

    return {
      success: true,
      message: "Worker paused",
    };
  }),

  /**
   * Resume the worker
   */
  resume: protectedProcedure.mutation(async () => {
    // Worker is started on server startup, so we just need to ensure it's running
    // This is a placeholder - actual resume logic would restart the worker
    return {
      success: true,
      message: "Worker resumed (requires server restart if fully stopped)",
    };
  }),

  /**
   * Enqueue all pending items
   */
  enqueuePending: protectedProcedure.mutation(async () => {
    const queue = await getQueue();

    // Find all content items with pending status
    const pendingItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "pending"),
      with: {
        contentItem: true,
      },
    });

    console.log(`[enqueuePending] Found ${pendingItems.length} pending items`);

    // Prepare jobs for batch insert
    const jobs = pendingItems
      .filter((item) => item.contentItem?.currentUrl)
      .map((item) => ({
        name: "index-content" as const,
        data: {
          contentItemId: item.contentItemId,
          url: item.contentItem!.currentUrl,
        },
      }));

    const skipped = pendingItems.length - jobs.length;
    if (skipped > 0) {
      console.log(`[enqueuePending] Skipped ${skipped} items with no URL`);
    }

    console.log(`[enqueuePending] Batch inserting ${jobs.length} jobs...`);

    // Use batch insert for much faster enqueueing
    try {
      await queue.insert(jobs);
      console.log(`[enqueuePending] Batch insert complete`);
    } catch (error) {
      console.error(`[enqueuePending] Batch insert failed:`, error);
      throw error;
    }

    const enqueued = jobs.length;
    const errors: string[] = [];

    console.log(
      `[enqueuePending] Complete: ${enqueued} enqueued, ${errors.length} errors`,
    );

    return {
      success: true,
      message: `Enqueued ${enqueued} items${errors.length > 0 ? ` (${errors.length} errors)` : ""}`,
      enqueued,
      errors: errors.length > 0 ? errors : undefined,
    };
  }),

  /**
   * Retry failed jobs
   */
  retryFailed: protectedProcedure.mutation(async () => {
    const queue = await getQueue();

    // Get failed jobs
    const failedJobs = await queue.fetch("index-content");

    // Note: pg-boss doesn't have a direct way to get failed jobs
    // This is a simplified implementation
    // In production, you'd query the pgboss.job table directly

    return {
      success: true,
      message: "Failed jobs retry initiated (limited implementation)",
    };
  }),

  /**
   * Re-index all content items that have no content_text row or failed indexing
   */
  reindexAll: adminProcedure.mutation(async () => {
    // Find content items with no content_text row
    const notIndexedItems = await db.execute(sql`
      SELECT ci.id, ci.current_url FROM tiger_den.content_items ci
      WHERE NOT EXISTS (
        SELECT 1 FROM tiger_den.content_text ct WHERE ct.content_item_id = ci.id
      )
    `);

    // Find content items with failed indexing
    const failedItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "failed"),
      with: { contentItem: true },
    });

    // Build list of items to index
    const items: Array<{ id: string; url: string }> = [];

    for (const row of notIndexedItems as unknown as Array<{ id: string; current_url: string }>) {
      items.push({ id: row.id, url: row.current_url });
    }

    for (const item of failedItems) {
      if (item.contentItem?.currentUrl) {
        // Delete the failed content_text row so indexSingleItem can create a fresh one
        await db.delete(contentText).where(eq(contentText.id, item.id));
        items.push({ id: item.contentItemId, url: item.contentItem.currentUrl });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: "All content items are already indexed",
        total: 0,
        succeeded: 0,
        failed: 0,
        queued: 0,
      };
    }

    console.log(`[reindexAll] Indexing ${items.length} items...`);
    const result = await indexContent(items);
    console.log(`[reindexAll] Complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.queued} queued`);

    return {
      success: true,
      message: `Indexed ${result.succeeded} items, ${result.failed} failed, ${result.queued} queued`,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      queued: result.queued,
      errors: result.results
        .filter((r) => !r.success && r.error)
        .map((r) => `${r.contentItemId}: ${r.error}`),
    };
  }),
});
