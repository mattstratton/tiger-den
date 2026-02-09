import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { apiImportService } from "~/server/services/api-import-service";

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
});
