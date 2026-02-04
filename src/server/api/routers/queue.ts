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

    // Ensure queue exists
    try {
      await queue.createQueue("index-content", {
        retryLimit: 3,
        retryDelay: 5,
        retryBackoff: true,
      });
      console.log(`[enqueuePending] Queue created or already exists`);
    } catch (error) {
      console.log(`[enqueuePending] Queue creation error (might already exist):`, error);
    }

    // Find all content items with pending status
    const pendingItems = await db.query.contentText.findMany({
      where: eq(contentText.indexStatus, "pending"),
      with: {
        contentItem: true,
      },
    });

    console.log(`[enqueuePending] Found ${pendingItems.length} pending items`);

    // Enqueue each item
    let enqueued = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      if (!item.contentItem?.currentUrl) {
        errors.push(`Item ${item.contentItemId} has no URL`);
        console.log(
          `[enqueuePending] Item ${item.contentItemId} has no URL`,
        );
        continue;
      }

      try {
        if (enqueued === 0) {
          console.log(`[enqueuePending] About to send first job:`, {
            name: "index-content",
            data: {
              contentItemId: item.contentItemId,
              url: item.contentItem.currentUrl,
            },
          });
        }

        const jobId = await queue.send("index-content", {
          contentItemId: item.contentItemId,
          url: item.contentItem.currentUrl,
        });

        if (enqueued === 0) {
          console.log(`[enqueuePending] First job result:`, jobId);
        }

        if (jobId) {
          enqueued++;
        } else {
          errors.push(`Job ${item.contentItemId} returned null`);
        }

        if (enqueued % 100 === 0) {
          console.log(`[enqueuePending] Enqueued ${enqueued} items...`);
        }
      } catch (error) {
        console.error(
          `[enqueuePending] Failed to enqueue ${item.contentItemId}:`,
          error,
        );
        errors.push(
          `Failed to enqueue ${item.contentItemId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

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
