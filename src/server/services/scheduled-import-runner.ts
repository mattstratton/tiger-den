import { and, desc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { apiImportLogs, apiImportSchedules } from "~/server/db/schema";
import {
  apiImportService,
  type ImportSource,
} from "~/server/services/api-import-service";

const ALL_SOURCES: ImportSource[] = [
  "ghost",
  "contentful_learn",
  "contentful_case_study",
  "youtube_channel",
];

/**
 * Get the started_at time of the last successful (non-dry-run) import for a source.
 * Returns undefined if no prior import exists (triggers a full import).
 */
export async function getLastSuccessfulImportTime(
  source: ImportSource,
): Promise<Date | undefined> {
  const lastImport = await db
    .select({ startedAt: apiImportLogs.startedAt })
    .from(apiImportLogs)
    .where(
      and(
        eq(apiImportLogs.sourceType, source),
        eq(apiImportLogs.dryRun, false),
      ),
    )
    .orderBy(desc(apiImportLogs.startedAt))
    .limit(1);

  return lastImport[0]?.startedAt ?? undefined;
}

/**
 * Run incremental imports for all enabled sources.
 * Used by the Vercel Cron route and can be called from anywhere.
 */
export async function runEnabledImports(): Promise<
  Array<{
    source: ImportSource;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  }>
> {
  const schedules = await db.select().from(apiImportSchedules);
  const enabledSources = schedules
    .filter((s) => s.enabled)
    .map((s) => s.sourceType as ImportSource)
    .filter((s) => ALL_SOURCES.includes(s));

  if (enabledSources.length === 0) {
    console.log("[Cron] No sources enabled, skipping");
    return [];
  }

  const results = [];

  for (const source of enabledSources) {
    try {
      const since = await getLastSuccessfulImportTime(source);
      console.log(
        `[Cron] Running import for ${source}${since ? ` since ${since.toISOString()}` : " (full)"}`,
      );

      const result = await apiImportService.executeImport(source, null, {
        since,
      });

      results.push({
        source,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      });

      console.log(
        `[Cron] ${source}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      );
    } catch (error) {
      console.error(`[Cron] Failed to import ${source}:`, error);
      results.push({ source, created: 0, updated: 0, skipped: 0, failed: -1 });
    }
  }

  return results;
}
