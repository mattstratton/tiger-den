import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { users } from "~/server/db/schema";

export const usersRouter = createTRPCRouter({
  // List all users (admin only)
  list: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.users.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
  }),

  // Update user role (admin only)
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["admin", "contributor", "reader"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent admin from changing their own role
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change your own role",
        });
      }

      // Check if this would remove the last admin
      if (input.role !== "admin") {
        const targetUser = await ctx.db.query.users.findFirst({
          where: eq(users.id, input.userId),
        });

        if (targetUser?.role === "admin") {
          const adminCountResult = await ctx.db
            .select({ count: count() })
            .from(users)
            .where(eq(users.role, "admin"))
            .execute();

          const adminCount = adminCountResult[0]?.count ?? 0;

          if (adminCount === 1) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot remove the last admin",
            });
          }
        }
      }

      // Update the role
      const result = await ctx.db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning();

      if (!result[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return result[0];
    }),

  // Get current user's role (for client-side checks)
  getMyRole: protectedProcedure.query(({ ctx }) => {
    return { role: ctx.session.user.role };
  }),
});
