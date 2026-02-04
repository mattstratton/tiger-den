import { getQueue } from "~/server/queue/indexing-queue";
import { indexSingleItem } from "~/server/services/indexing-orchestrator";
import type { IndexJobPayload } from "~/server/queue/indexing-queue";

/**
 * Start the queue worker to process index-content jobs
 * Worker runs with batch size of 5 for concurrent processing
 */
export async function startWorker() {
  const queue = await getQueue();

  // Start worker with batch size of 5 for concurrent processing
  await queue.work<IndexJobPayload>(
    "index-content",
    { batchSize: 5 },
    async (jobs) => {
      // Process jobs concurrently in batches of 5
      const results = await Promise.allSettled(
        jobs.map(async (job) => {
          const { contentItemId, url } = job.data;

          console.log(
            `[Worker] Processing job ${job.id} for item ${contentItemId}`,
          );

          const result = await indexSingleItem(contentItemId, url);

          if (!result.success) {
            console.error(`[Worker] Job ${job.id} failed:`, result.error);
            throw new Error(result.error || "Indexing failed");
          }

          console.log(`[Worker] Job ${job.id} completed successfully`);
          return result;
        }),
      );

      // Check if any jobs failed
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        throw new Error(
          `${failures.length} out of ${jobs.length} jobs failed`,
        );
      }
    },
  );

  console.log("[Worker] Started with batch size of 5");
}
