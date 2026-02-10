import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { db } from "~/server/db";
import { apiImportSchedules } from "~/server/db/schema";
import { apiImportService } from "~/server/services/api-import-service";
import { getLastSuccessfulImportTime } from "~/server/services/scheduled-import-runner";

const importSourceSchema = z.enum([
  "ghost",
  "contentful_learn",
  "contentful_case_study",
  "youtube_channel",
]);

export const apiImportRouter = createTRPCRouter({
  /**
   * Test connections to Ghost and Contentful APIs
   */
  testConnections: adminProcedure.query(async () => {
    return apiImportService.testConnections();
  }),

  /**
   * Fetch a single item by slug/ID from an API source
   */
  fetchSingleItem: adminProcedure
    .input(
      z.object({
        source: importSourceSchema,
        identifier: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return apiImportService.fetchSingleItem(input.source, input.identifier);
    }),

  /**
   * Preview what an import would do (read-only)
   */
  fetchPreview: adminProcedure
    .input(
      z.object({
        source: importSourceSchema,
        since: z.string().datetime().optional(),
      }),
    )
    .query(async ({ input }) => {
      return apiImportService.fetchPreview(input.source, {
        since: input.since ? new Date(input.since) : undefined,
      });
    }),

  /**
   * Execute an import (or dry run)
   */
  importItems: adminProcedure
    .input(
      z.object({
        source: importSourceSchema,
        since: z.string().datetime().optional(),
        dryRun: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return apiImportService.executeImport(input.source, ctx.session.user.id, {
        since: input.since ? new Date(input.since) : undefined,
        dryRun: input.dryRun,
      });
    }),

  /**
   * Get import history logs
   */
  getImportHistory: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return apiImportService.getImportHistory({
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  /**
   * Get all import schedule configurations
   */
  getSchedules: adminProcedure.query(async () => {
    return db.select().from(apiImportSchedules);
  }),

  /**
   * Toggle a schedule on/off for a source
   */
  updateSchedule: adminProcedure
    .input(
      z.object({
        sourceType: importSourceSchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(apiImportSchedules)
        .set({
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(apiImportSchedules.sourceType, input.sourceType));

      return { success: true };
    }),

  /**
   * Trigger an import now (incremental, same logic as cron route)
   */
  triggerScheduledImport: adminProcedure
    .input(
      z.object({
        source: importSourceSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const since = await getLastSuccessfulImportTime(input.source);

      const result = await apiImportService.executeImport(
        input.source,
        ctx.session.user.id,
        { since },
      );

      return result;
    }),
});
