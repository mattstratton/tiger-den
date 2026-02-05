import { TRPCError } from "@trpc/server";
import { and, count, eq, not } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { contentItems, contentTypes } from "~/server/db/schema";

export const contentTypesRouter = createTRPCRouter({
  // List all content types (ordered by display_order)
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.contentTypes.findMany({
      orderBy: (types, { asc }) => [asc(types.displayOrder)],
    });
  }),

  // Create new content type
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        slug: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9_]+$/, "Slug must be lowercase with underscores only"),
        color: z.enum([
          "red",
          "blue",
          "green",
          "purple",
          "yellow",
          "orange",
          "pink",
          "cyan",
          "gray",
          "indigo",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check slug uniqueness
      const existing = await ctx.db.query.contentTypes.findFirst({
        where: eq(contentTypes.slug, input.slug),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A content type with this slug already exists",
        });
      }

      // Get max display order
      const maxOrderResult = await ctx.db
        .select({ max: count() })
        .from(contentTypes)
        .execute();
      const nextOrder = (maxOrderResult[0]?.max ?? 0) + 1;

      const result = await ctx.db
        .insert(contentTypes)
        .values({
          ...input,
          displayOrder: nextOrder,
        })
        .returning();

      return result[0];
    }),

  // Update content type
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(50),
        slug: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9_]+$/, "Slug must be lowercase with underscores only"),
        color: z.enum([
          "red",
          "blue",
          "green",
          "purple",
          "yellow",
          "orange",
          "pink",
          "cyan",
          "gray",
          "indigo",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if content type exists and is not system type
      const existing = await ctx.db.query.contentTypes.findFirst({
        where: eq(contentTypes.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content type not found",
        });
      }

      if (existing.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify system content type",
        });
      }

      // Check if slug conflicts with other types
      const slugConflict = await ctx.db.query.contentTypes.findFirst({
        where: and(
          eq(contentTypes.slug, input.slug),
          not(eq(contentTypes.id, input.id)),
        ),
      });

      if (slugConflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A content type with this slug already exists",
        });
      }

      const result = await ctx.db
        .update(contentTypes)
        .set({
          name: input.name,
          slug: input.slug,
          color: input.color,
          updatedAt: new Date(),
        })
        .where(eq(contentTypes.id, input.id))
        .returning();

      return result[0];
    }),

  // Delete content type (with usage check)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if content type exists
      const type = await ctx.db.query.contentTypes.findFirst({
        where: eq(contentTypes.id, input.id),
      });

      if (!type) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content type not found",
        });
      }

      // Check if system type
      if (type.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete system content type",
        });
      }

      // Check usage count
      const usageResult = await ctx.db
        .select({ count: count() })
        .from(contentItems)
        .where(eq(contentItems.contentTypeId, input.id))
        .execute();

      const usageCount = usageResult[0]?.count ?? 0;

      if (usageCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot delete: ${usageCount} content items use this type`,
        });
      }

      await ctx.db.delete(contentTypes).where(eq(contentTypes.id, input.id));

      return { success: true };
    }),

  // Reassign all items to another type, then delete
  reassignAndDelete: adminProcedure
    .input(
      z.object({
        id: z.number(),
        reassignToId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if both types exist
      const [typeToDelete, targetType] = await Promise.all([
        ctx.db.query.contentTypes.findFirst({
          where: eq(contentTypes.id, input.id),
        }),
        ctx.db.query.contentTypes.findFirst({
          where: eq(contentTypes.id, input.reassignToId),
        }),
      ]);

      if (!typeToDelete) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Content type to delete not found",
        });
      }

      if (!targetType) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target content type not found",
        });
      }

      if (typeToDelete.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete system content type",
        });
      }

      // Reassign all content items
      await ctx.db
        .update(contentItems)
        .set({ contentTypeId: input.reassignToId })
        .where(eq(contentItems.contentTypeId, input.id));

      // Delete the content type
      await ctx.db.delete(contentTypes).where(eq(contentTypes.id, input.id));

      return { success: true };
    }),

  // Reorder content types
  reorder: adminProcedure
    .input(
      z.object({
        ids: z.array(z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update display_order for each type
      await Promise.all(
        input.ids.map((id, index) =>
          ctx.db
            .update(contentTypes)
            .set({ displayOrder: index, updatedAt: new Date() })
            .where(eq(contentTypes.id, id)),
        ),
      );

      return { success: true };
    }),
});
