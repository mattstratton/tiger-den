import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  contributorProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { voiceProfiles, writingSamples } from "~/server/db/schema";

export const voiceProfilesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const profileList = await ctx.db
      .select({
        id: voiceProfiles.id,
        name: voiceProfiles.name,
        displayName: voiceProfiles.displayName,
        title: voiceProfiles.title,
        company: voiceProfiles.company,
        topics: voiceProfiles.topics,
        createdAt: voiceProfiles.createdAt,
        sampleCount:
          sql<number>`cast(count(${writingSamples.id}) as int)`,
      })
      .from(voiceProfiles)
      .leftJoin(
        writingSamples,
        eq(voiceProfiles.id, writingSamples.voiceProfileId),
      )
      .groupBy(voiceProfiles.id)
      .orderBy(voiceProfiles.displayName);

    return profileList;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.query.voiceProfiles.findFirst({
        where: eq(voiceProfiles.id, input.id),
        with: { writingSamples: true },
      });

      if (!profile) {
        throw new Error("Voice profile not found");
      }

      return profile;
    }),

  getByName: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.query.voiceProfiles.findFirst({
        where: eq(voiceProfiles.name, input.name.toLowerCase()),
        with: { writingSamples: true },
      });

      if (!profile) {
        const allProfiles = await ctx.db
          .select({ name: voiceProfiles.name })
          .from(voiceProfiles)
          .orderBy(voiceProfiles.name);

        throw new Error(
          `No voice profile found for '${input.name}'. Available profiles: ${allProfiles.map((p) => p.name).join(", ") || "none"}`,
        );
      }

      return profile;
    }),

  create: contributorProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .transform((s) => s.toLowerCase().replace(/\s+/g, "-")),
        displayName: z.string().min(1),
        title: z.string().optional(),
        company: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        topics: z.array(z.string()).optional(),
        voiceNotes: z.string().min(1),
        antiPatterns: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.voiceProfiles.findFirst({
        where: eq(voiceProfiles.name, input.name),
      });

      if (existing) {
        throw new Error("Voice profile with this name already exists");
      }

      const [newProfile] = await ctx.db
        .insert(voiceProfiles)
        .values({
          ...input,
          linkedinUrl: input.linkedinUrl || null,
        })
        .returning();

      return newProfile;
    }),

  update: contributorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .transform((s) => s.toLowerCase().replace(/\s+/g, "-"))
          .optional(),
        displayName: z.string().min(1).optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        topics: z.array(z.string()).optional(),
        voiceNotes: z.string().min(1).optional(),
        antiPatterns: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      if (updates.name) {
        const existing = await ctx.db.query.voiceProfiles.findFirst({
          where: eq(voiceProfiles.name, updates.name),
        });

        if (existing && existing.id !== id) {
          throw new Error("Voice profile with this name already exists");
        }
      }

      const [updatedProfile] = await ctx.db
        .update(voiceProfiles)
        .set({
          ...updates,
          linkedinUrl: updates.linkedinUrl === "" ? null : updates.linkedinUrl,
        })
        .where(eq(voiceProfiles.id, id))
        .returning();

      return updatedProfile;
    }),

  delete: contributorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(voiceProfiles)
        .where(eq(voiceProfiles.id, input.id));
      return { success: true };
    }),

  // Writing sample mutations
  addSample: contributorProcedure
    .input(
      z.object({
        voiceProfileId: z.string().uuid(),
        label: z.string().min(1),
        content: z.string().min(1),
        sourceType: z.string().optional(),
        sourceUrl: z.string().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [sample] = await ctx.db
        .insert(writingSamples)
        .values({
          ...input,
          sourceUrl: input.sourceUrl || null,
        })
        .returning();

      return sample;
    }),

  updateSample: contributorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        sourceType: z.string().optional(),
        sourceUrl: z.string().url().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updatedSample] = await ctx.db
        .update(writingSamples)
        .set({
          ...updates,
          sourceUrl: updates.sourceUrl === "" ? null : updates.sourceUrl,
        })
        .where(eq(writingSamples.id, id))
        .returning();

      return updatedSample;
    }),

  deleteSample: contributorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(writingSamples)
        .where(eq(writingSamples.id, input.id));
      return { success: true };
    }),
});
