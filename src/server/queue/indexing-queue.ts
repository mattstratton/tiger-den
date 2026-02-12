import PgBoss from "pg-boss";
import { env } from "~/env";

// Use global to persist across hot reloads in development
const globalForBoss = globalThis as unknown as {
  boss: PgBoss | undefined;
};

let boss = globalForBoss.boss;

/**
 * Get or create the pg-boss queue instance.
 * Singleton pattern — also registers the worker on first creation
 * so the worker only starts when queue operations are needed,
 * not on every serverless function invocation.
 */
export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    console.log("[Queue] Creating new pg-boss instance...");
    const newBoss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
      retryLimit: 3,
      retryDelay: 5, // 5 minutes
      retryBackoff: true, // exponential: 5min, 30min, 2hr
      archiveCompletedAfterSeconds: 86400, // keep completed jobs for 24hrs
      max: 2, // limit connection pool for serverless
    });

    // Assign immediately to prevent race conditions
    boss = newBoss;
    globalForBoss.boss = newBoss;

    await newBoss.start();
    console.log("[Queue] pg-boss started successfully");

    newBoss.on("error", (error) => {
      console.error("[Queue] pg-boss error:", error);
    });

    // Register the worker lazily (only when queue is first accessed)
    const { registerWorker } = await import("~/server/queue/worker");
    await registerWorker(newBoss);
  }

  return boss;
}

/**
 * Job payload for index-content jobs
 */
export interface IndexJobPayload {
  contentItemId: string;
  url: string;
  attempt?: number;
}
