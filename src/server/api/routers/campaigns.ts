import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { campaigns, contentCampaigns } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

export const campaignsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const campaignList = await ctx.db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        createdAt: campaigns.createdAt,
        contentCount: sql<number>`cast(count(${contentCampaigns.contentItemId}) as int)`,
      })
      .from(campaigns)
      .leftJoin(
        contentCampaigns,
        eq(campaigns.id, contentCampaigns.campaignId)
      )
      .groupBy(campaigns.id)
      .orderBy(campaigns.name);

    return campaignList;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.query.campaigns.findFirst({
        where: eq(campaigns.id, input.id),
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      return campaign;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await ctx.db.query.campaigns.findFirst({
        where: eq(campaigns.name, input.name),
      });

      if (existing) {
        throw new Error("Campaign with this name already exists");
      }

      const [newCampaign] = await ctx.db
        .insert(campaigns)
        .values(input)
        .returning();

      return newCampaign;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // If name is being updated, check for duplicates
      if (updates.name) {
        const existing = await ctx.db.query.campaigns.findFirst({
          where: eq(campaigns.name, updates.name),
        });

        if (existing && existing.id !== id) {
          throw new Error("Campaign with this name already exists");
        }
      }

      const [updatedCampaign] = await ctx.db
        .update(campaigns)
        .set(updates)
        .where(eq(campaigns.id, id))
        .returning();

      return updatedCampaign;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if campaign is in use
      const countResult = await ctx.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(contentCampaigns)
        .where(eq(contentCampaigns.campaignId, input.id));

      const count = countResult[0]?.count ?? 0;

      if (count > 0) {
        throw new Error(
          "Cannot delete campaign that is assigned to content items"
        );
      }

      await ctx.db.delete(campaigns).where(eq(campaigns.id, input.id));

      return { success: true };
    }),
});
