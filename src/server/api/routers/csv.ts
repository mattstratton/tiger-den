import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { processImportWithProgress } from "~/server/services/csv-processor";

export const csvRouter = createTRPCRouter({
  import: protectedProcedure
    .input(
      z.object({
        rows: z.array(z.record(z.string(), z.unknown())),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return processImportWithProgress(input.rows, ctx.session.user.id, ctx.db);
    }),
});
