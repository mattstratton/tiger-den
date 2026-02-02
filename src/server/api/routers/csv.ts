import { z, ZodError } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { contentItems, contentCampaigns, campaigns } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// CSV row schema with snake_case column names
const csvRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  current_url: z.string().url("Invalid URL format"),
  content_type: z.enum([
    "youtube_video",
    "blog_post",
    "case_study",
    "website_content",
    "third_party",
    "other",
  ]),
  publish_date: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  target_audience: z.string().optional(),
  tags: z.string().optional(), // Comma-separated string
  campaigns: z.string().optional(), // Comma-separated string
});

interface ImportError {
  row: number;
  message: string;
  field?: string;
}

export const csvRouter = createTRPCRouter({
  import: protectedProcedure
    .input(
      z.object({
        rows: z.array(z.record(z.string(), z.unknown())),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let successful = 0;
      let failed = 0;
      const errors: ImportError[] = [];

      // Process each row
      for (let i = 0; i < input.rows.length; i++) {
        const rowNumber = i + 2; // Row 1 is headers, data starts at row 2
        const row = input.rows[i];

        try {
          // Validate row
          const validatedRow = csvRowSchema.parse(row);

          // Check for duplicate URL
          const existing = await ctx.db.query.contentItems.findFirst({
            where: eq(contentItems.currentUrl, validatedRow.current_url),
          });

          if (existing) {
            throw new Error(`Duplicate URL: ${validatedRow.current_url}`);
          }

          // Parse tags (comma-separated)
          const tags = validatedRow.tags
            ? validatedRow.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
            : undefined;

          // Parse campaign names (comma-separated)
          const campaignNames = validatedRow.campaigns
            ? validatedRow.campaigns.split(",").map((name) => name.trim()).filter(Boolean)
            : [];

          // Get or create campaigns
          const campaignIds: string[] = [];
          for (const campaignName of campaignNames) {
            // Check if campaign exists
            let campaign = await ctx.db.query.campaigns.findFirst({
              where: eq(campaigns.name, campaignName),
            });

            // Create campaign if it doesn't exist
            if (!campaign) {
              const [newCampaign] = await ctx.db
                .insert(campaigns)
                .values({ name: campaignName })
                .returning();
              campaign = newCampaign;
            }

            if (campaign) {
              campaignIds.push(campaign.id);
            }
          }

          // Insert content item and link campaigns in a transaction
          await ctx.db.transaction(async (tx) => {
            const [item] = await tx
              .insert(contentItems)
              .values({
                title: validatedRow.title,
                currentUrl: validatedRow.current_url,
                contentType: validatedRow.content_type,
                publishDate: validatedRow.publish_date,
                description: validatedRow.description,
                author: validatedRow.author,
                targetAudience: validatedRow.target_audience,
                tags,
                source: "csv_import",
                createdByUserId: ctx.session.user.id,
              })
              .returning();

            if (!item) {
              throw new Error("Failed to create content item");
            }

            // Link campaigns
            if (campaignIds.length > 0) {
              await tx.insert(contentCampaigns).values(
                campaignIds.map((campaignId) => ({
                  contentItemId: item.id,
                  campaignId,
                }))
              );
            }
          });

          successful++;
        } catch (error) {
          failed++;

          if (error instanceof ZodError) {
            // Validation error - extract field-specific errors
            const fieldErrors = error.issues.map((err) => ({
              row: rowNumber,
              message: err.message,
              field: err.path.join("."),
            }));
            errors.push(...fieldErrors);
          } else if (error instanceof Error) {
            // Other errors (duplicate URL, database errors, etc.)
            errors.push({
              row: rowNumber,
              message: error.message,
            });
          } else {
            // Unknown error
            errors.push({
              row: rowNumber,
              message: "Unknown error occurred",
            });
          }
        }
      }

      return {
        successful,
        failed,
        errors,
      };
    }),
});
