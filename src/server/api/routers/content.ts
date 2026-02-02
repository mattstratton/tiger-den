import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { contentItems, contentCampaigns } from "~/server/db/schema";
import { eq, ilike, and, or, gte, lte, inArray, sql } from "drizzle-orm";

export const contentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        contentTypes: z.array(z.enum([
          "youtube_video",
          "blog_post",
          "case_study",
          "website_content",
          "third_party",
          "other",
        ])).optional(),
        campaignIds: z.array(z.string().uuid()).optional(),
        publishDateFrom: z.string().optional(),
        publishDateTo: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      // Search filter
      if (input.search) {
        conditions.push(
          or(
            ilike(contentItems.title, `%${input.search}%`),
            ilike(contentItems.description, `%${input.search}%`),
            ilike(contentItems.currentUrl, `%${input.search}%`)
          )
        );
      }

      // Content type filter
      if (input.contentTypes && input.contentTypes.length > 0) {
        conditions.push(inArray(contentItems.contentType, input.contentTypes));
      }

      // Date range filter
      if (input.publishDateFrom) {
        conditions.push(gte(contentItems.publishDate, input.publishDateFrom));
      }
      if (input.publishDateTo) {
        conditions.push(lte(contentItems.publishDate, input.publishDateTo));
      }

      // Campaign filter
      if (input.campaignIds && input.campaignIds.length > 0) {
        conditions.push(
          inArray(
            contentItems.id,
            ctx.db
              .selectDistinct({ id: contentCampaigns.contentItemId })
              .from(contentCampaigns)
              .where(inArray(contentCampaigns.campaignId, input.campaignIds))
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await ctx.db.query.contentItems.findMany({
        where: whereClause,
        limit: input.limit,
        offset: input.offset,
        orderBy: (contentItems, { desc }) => [desc(contentItems.createdAt)],
        with: {
          campaigns: {
            with: {
              campaign: true,
            },
          },
        },
      });

      // Count total for pagination
      const countResult = await ctx.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(contentItems)
        .where(whereClause);

      const total = countResult[0]?.count ?? 0;

      return {
        items,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        currentUrl: z.string().url(),
        contentType: z.enum([
          "youtube_video",
          "blog_post",
          "case_study",
          "website_content",
          "third_party",
          "other",
        ]),
        publishDate: z.string().optional(),
        description: z.string().optional(),
        author: z.string().optional(),
        targetAudience: z.string().optional(),
        tags: z.array(z.string()).optional(),
        campaignIds: z.array(z.string().uuid()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { campaignIds, ...contentData } = input;

      // Check for duplicate URL
      const existing = await ctx.db.query.contentItems.findFirst({
        where: eq(contentItems.currentUrl, input.currentUrl),
      });

      if (existing) {
        throw new Error("Content with this URL already exists");
      }

      // Create content item
      const newItem = await ctx.db.transaction(async (tx) => {
        const [item] = await tx
          .insert(contentItems)
          .values({
            ...contentData,
            createdByUserId: ctx.session.user.id,
            source: "manual",
          })
          .returning();

        if (!item) {
          throw new Error("Failed to create content item");
        }

        // Link campaigns if provided
        if (campaignIds && campaignIds.length > 0) {
          await tx.insert(contentCampaigns).values(
            campaignIds.map((campaignId) => ({
              contentItemId: item.id,
              campaignId,
            }))
          );
        }

        return item;
      });

      return newItem;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        currentUrl: z.string().url().optional(),
        contentType: z.enum([
          "youtube_video",
          "blog_post",
          "case_study",
          "website_content",
          "third_party",
          "other",
        ]).optional(),
        publishDate: z.string().optional(),
        description: z.string().optional(),
        author: z.string().optional(),
        targetAudience: z.string().optional(),
        tags: z.array(z.string()).optional(),
        campaignIds: z.array(z.string().uuid()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, campaignIds, currentUrl, ...updates } = input;

      // Get existing item
      const existing = await ctx.db.query.contentItems.findFirst({
        where: eq(contentItems.id, id),
      });

      if (!existing) {
        throw new Error("Content item not found");
      }

      // If URL changed, add old URL to history
      let previousUrls = existing.previousUrls || [];
      if (currentUrl && currentUrl !== existing.currentUrl) {
        previousUrls = [...previousUrls, existing.currentUrl];
      }

      // Update content item and campaigns
      const updatedItem = await ctx.db.transaction(async (tx) => {
        const [item] = await tx
          .update(contentItems)
          .set({
            ...updates,
            ...(currentUrl && { currentUrl }),
            previousUrls,
            updatedAt: new Date(),
          })
          .where(eq(contentItems.id, id))
          .returning();

        if (!item) {
          throw new Error("Failed to update content item");
        }

        // Update campaigns if provided
        if (campaignIds !== undefined) {
          // Delete existing campaign links
          await tx
            .delete(contentCampaigns)
            .where(eq(contentCampaigns.contentItemId, id));

          // Insert new campaign links
          if (campaignIds.length > 0) {
            await tx.insert(contentCampaigns).values(
              campaignIds.map((campaignId) => ({
                contentItemId: id,
                campaignId,
              }))
            );
          }
        }

        return item;
      });

      return updatedItem;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(contentItems)
        .where(eq(contentItems.id, input.id));

      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.query.contentItems.findFirst({
        where: eq(contentItems.id, input.id),
        with: {
          campaigns: {
            with: {
              campaign: true,
            },
          },
        },
      });

      if (!item) {
        throw new Error("Content item not found");
      }

      return item;
    }),
});
