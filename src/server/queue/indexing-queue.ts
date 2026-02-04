import PgBoss from "pg-boss";
import { env } from "~/env";

let boss: PgBoss | null = null;

/**
 * Get or create the pg-boss queue instance
 * Singleton pattern to ensure only one instance exists
 */
export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
      retryLimit: 3,
      retryDelay: 5, // 5 minutes
      retryBackoff: true, // exponential: 5min, 30min, 2hr
      archiveCompletedAfterSeconds: 86400, // keep completed jobs for 24hrs
    });

    await boss.start();
    console.log("[Queue] pg-boss started successfully");
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
