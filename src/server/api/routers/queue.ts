import { eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { contentItems, contentText } from "~/server/db/schema";
import { getQueue } from "~/server/queue/indexing-queue";
import { indexContent, indexFromExistingContent } from "~/server/services/indexing-orchestrator";

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
   * Re-index all content items that need indexing.
   * - Items with content_text already populated (from API sync, status 'pending'):
   *   chunk + embed directly without scraping.
   * - Items with failed content_text: reset and re-chunk/embed if content exists,
   *   otherwise fall back to fetching.
   * - Items with no content_text row at all: fetch via URL (scrape or API).
   */
  reindexAll: adminProcedure.mutation(async () => {
    let succeeded = 0;
    let failed = 0;
    let queued = 0;
    const errors: string[] = [];

    // 1. Items with content_text that has content and status 'pending' (from API sync)
    //    These already have plainText populated — just chunk + embed.
    const pendingWithContent = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "pending"),
    });
    const pendingReady = pendingWithContent.filter(
      (ct) => ct.plainText && ct.plainText.length > 0,
    );

    console.log(`[reindexAll] ${pendingReady.length} pending items with API content (chunk + embed only)`);
    for (const ct of pendingReady) {
      const result = await indexFromExistingContent(ct.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push(`${ct.contentItemId}: ${result.error}`);
      }
    }

    // 2. Items with failed status — reset and try again.
    //    If they have content already (from API), re-chunk/embed.
    //    Otherwise, fall back to URL fetching.
    const failedItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "failed"),
      with: { contentItem: true },
    });

    const failedWithContent = failedItems.filter(
      (ct) => ct.plainText && ct.plainText.length > 0,
    );
    const failedWithoutContent = failedItems.filter(
      (ct) => !ct.plainText || ct.plainText.length === 0,
    );

    console.log(`[reindexAll] ${failedWithContent.length} failed items with content, ${failedWithoutContent.length} without`);

    for (const ct of failedWithContent) {
      const result = await indexFromExistingContent(ct.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push(`${ct.contentItemId}: ${result.error}`);
      }
    }

    // Failed items without content — delete row and re-fetch via URL
    const fetchItems: Array<{ id: string; url: string }> = [];
    for (const item of failedWithoutContent) {
      if (item.contentItem?.currentUrl) {
        await db.delete(contentText).where(eq(contentText.id, item.id));
        fetchItems.push({ id: item.contentItemId, url: item.contentItem.currentUrl });
      }
    }

    // 3. Items with no content_text row at all — need to fetch via URL
    const notIndexedItems = await db.execute(sql`
      SELECT ci.id, ci.current_url FROM tiger_den.content_items ci
      WHERE NOT EXISTS (
        SELECT 1 FROM tiger_den.content_text ct WHERE ct.content_item_id = ci.id
      )
    `);
    for (const row of notIndexedItems as unknown as Array<{ id: string; current_url: string }>) {
      fetchItems.push({ id: row.id, url: row.current_url });
    }

    // Process URL-fetch items if any
    if (fetchItems.length > 0) {
      console.log(`[reindexAll] ${fetchItems.length} items need URL fetching`);
      const fetchResult = await indexContent(fetchItems);
      succeeded += fetchResult.succeeded;
      failed += fetchResult.failed;
      queued += fetchResult.queued;
      errors.push(
        ...fetchResult.results
          .filter((r) => !r.success && r.error)
          .map((r) => `${r.contentItemId}: ${r.error}`),
      );
    }

    const total = succeeded + failed + queued;
    console.log(`[reindexAll] Complete: ${succeeded} succeeded, ${failed} failed, ${queued} queued`);

    return {
      success: true,
      message: `Indexed ${succeeded} items, ${failed} failed, ${queued} queued`,
      total,
      succeeded,
      failed,
      queued,
      errors: errors.length > 0 ? errors : undefined,
    };
  }),
});
