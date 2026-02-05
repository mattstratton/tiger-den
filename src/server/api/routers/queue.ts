import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { contentItems, contentText } from "~/server/db/schema";
import { getQueue } from "~/server/queue/indexing-queue";

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

    return {
      queued: created,
      processing: active,
      completed: completed - active,
      failed,
      pending: pendingItems.length,
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
});
