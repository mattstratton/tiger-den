import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  contributorProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import {
  contentCampaigns,
  contentItems,
  contentText,
} from "~/server/db/schema";
import { generateEmbedding } from "~/server/services/embeddings";
import { indexContent } from "~/server/services/indexing-orchestrator";
import { keywordSearch } from "~/server/services/keyword-search";
import { hybridSearch } from "~/server/services/search-service";

export const contentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        contentTypeIds: z.array(z.number()).optional(),
        campaignIds: z.array(z.string().uuid()).optional(),
        publishDateFrom: z.string().optional(),
        publishDateTo: z.string().optional(),
        sortBy: z
          .enum(["title", "date", "type", "author", "createdAt"])
          .default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      // Search filter
      if (input.search) {
        conditions.push(
          or(
            ilike(contentItems.title, `%${input.search}%`),
            ilike(contentItems.description, `%${input.search}%`),
            ilike(contentItems.currentUrl, `%${input.search}%`),
            ilike(contentItems.author, `%${input.search}%`),
          ),
        );
      }

      // Content type filter
      if (input.contentTypeIds && input.contentTypeIds.length > 0) {
        conditions.push(
          inArray(contentItems.contentTypeId, input.contentTypeIds),
        );
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
              .where(inArray(contentCampaigns.campaignId, input.campaignIds)),
          ),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const sortDir = input.sortOrder === "asc" ? asc : desc;
      const nullsLast = input.sortOrder === "desc" ? sql`NULLS LAST` : sql`NULLS FIRST`;
      const dateExpr = sql`COALESCE(${contentItems.lastModifiedAt}, ${contentItems.publishDate}::timestamptz)`;
      const sortColumnMap = {
        title: contentItems.title,
        date: dateExpr,
        type: contentItems.contentTypeId,
        author: contentItems.author,
        createdAt: contentItems.createdAt,
      };
      const sortColumn = sortColumnMap[input.sortBy];

      const items = await ctx.db.query.contentItems.findMany({
        where: whereClause,
        limit: input.limit,
        offset: input.offset,
        orderBy: [sql`${sortDir(sortColumn)} ${nullsLast}`],
        with: {
          contentTypeRel: true,
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

  create: contributorProcedure
    .input(
      z.object({
        title: z.string().min(1),
        currentUrl: z.string().url(),
        contentTypeId: z.number(),
        publishDate: z.string().optional(),
        description: z.string().optional(),
        author: z.string().optional(),
        targetAudience: z.string().optional(),
        tags: z.array(z.string()).optional(),
        campaignIds: z.array(z.string().uuid()).optional(),
      }),
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
            })),
          );
        }

        return item;
      });

      // Index content
      try {
        await indexContent([{ id: newItem.id, url: newItem.currentUrl }]);
      } catch (error) {
        console.error("Content indexing failed:", error);
        // Don't fail creation if indexing fails
      }

      return newItem;
    }),

  update: contributorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        currentUrl: z.string().url().optional(),
        contentTypeId: z.number().optional(),
        publishDate: z.string().optional(),
        description: z.string().optional(),
        author: z.string().optional(),
        targetAudience: z.string().optional(),
        tags: z.array(z.string()).optional(),
        campaignIds: z.array(z.string().uuid()).optional(),
      }),
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
              })),
            );
          }
        }

        return item;
      });

      return updatedItem;
    }),

  delete: contributorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify item exists first
      const existing = await ctx.db.query.contentItems.findFirst({
        where: eq(contentItems.id, input.id),
      });

      if (!existing) {
        throw new Error("Content item not found");
      }

      await ctx.db.delete(contentItems).where(eq(contentItems.id, input.id));

      return { success: true };
    }),

  reindexContent: contributorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Get content item
      const item = await ctx.db.query.contentItems.findFirst({
        where: eq(contentItems.id, input.id),
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content item not found",
        });
      }

      // Run indexing
      const result = await indexContent([
        { id: item.id, url: item.currentUrl },
      ]);

      if (result.failed > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.results[0]?.error ?? "Indexing failed",
        });
      }

      return { success: true };
    }),

  getIndexStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const indexStatus = await ctx.db.query.contentText.findFirst({
        where: eq(contentText.contentItemId, input.id),
        columns: {
          indexStatus: true,
          indexError: true,
          indexedAt: true,
          crawledAt: true,
          wordCount: true,
          tokenCount: true,
        },
      });

      return indexStatus ?? null;
    }),

  hybridSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Generate embedding for query
      const embedding = await generateEmbedding(input.query);

      // Perform hybrid search
      const searchResults = await hybridSearch(
        input.query,
        embedding,
        input.limit,
      );

      // Enrich results with content item details
      const contentItemIds = searchResults.map((r) => r.contentItemId);

      if (contentItemIds.length === 0) {
        return [];
      }

      const contentItemsData = await ctx.db.query.contentItems.findMany({
        where: inArray(contentItems.id, contentItemIds),
        with: {
          contentTypeRel: true,
          campaigns: {
            with: {
              campaign: true,
            },
          },
        },
      });

      // Create a map for quick lookup
      const contentMap = new Map(
        contentItemsData.map((item) => [item.id, item]),
      );

      // Normalize relevance scores to 0-100 scale (top result = 100%)
      const maxScore = Math.max(...searchResults.map((r) => r.relevanceScore));
      const normalizedResults = searchResults.map((result) => ({
        ...result,
        relevanceScore: maxScore > 0 ? result.relevanceScore / maxScore : 0,
      }));

      // Combine search results with content details
      return normalizedResults.map((result) => ({
        ...result,
        contentItem: contentMap.get(result.contentItemId) ?? null,
      }));
    }),

  keywordSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Perform keyword-only search (BM25)
      const searchResults = await keywordSearch(input.query, input.limit);

      // Enrich results with content item details
      const contentItemIds = searchResults.map((r) => r.contentItemId);

      if (contentItemIds.length === 0) {
        return [];
      }

      const contentItemsData = await ctx.db.query.contentItems.findMany({
        where: inArray(contentItems.id, contentItemIds),
        with: {
          contentTypeRel: true,
          campaigns: {
            with: {
              campaign: true,
            },
          },
        },
      });

      // Create a map for quick lookup
      const contentMap = new Map(
        contentItemsData.map((item) => [item.id, item]),
      );

      // Normalize relevance scores to 0-100 scale (top result = 100%)
      const maxScore = Math.max(...searchResults.map((r) => r.relevanceScore));
      const normalizedResults = searchResults.map((result) => ({
        ...result,
        relevanceScore: maxScore > 0 ? result.relevanceScore / maxScore : 0,
      }));

      // Combine search results with content details
      return normalizedResults.map((result) => ({
        ...result,
        contentItem: contentMap.get(result.contentItemId) ?? null,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.query.contentItems.findFirst({
        where: eq(contentItems.id, input.id),
        with: {
          contentTypeRel: true,
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

  deleteAll: contributorProcedure.mutation(async ({ ctx }) => {
    // Delete all content items (for testing purposes)
    // This will cascade delete all content_campaigns relationships
    await ctx.db.delete(contentItems);

    return { success: true, message: "All content items deleted" };
  }),
});
