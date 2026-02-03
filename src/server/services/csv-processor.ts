import { z, ZodError } from "zod";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { fetchPageTitle } from "~/server/services/title-fetcher";

const { contentItems, contentCampaigns, campaigns } = schema;

// CSV row schema with snake_case column names
const csvRowSchema = z.object({
  title: z.string().optional().or(z.literal("")),
  current_url: z.string().url("Invalid URL format"),
  content_type: z.enum([
    "youtube_video",
    "blog_post",
    "case_study",
    "website_content",
    "third_party",
    "other",
  ]),
  publish_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional()
    .or(z.literal("")),
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

interface EnrichmentStats {
  attempted: number;
  successful: number;
  failed: number;
}

export interface ProcessResult {
  successful: number;
  failed: number;
  errors: ImportError[];
  enrichment: EnrichmentStats;
}

export interface ProgressEvent {
  phase: "enriching" | "validating";
  current: number;
  total: number;
  message: string;
}

/**
 * Process CSV import with optional progress event emission
 * @param rows Raw CSV rows
 * @param userId User ID for created content
 * @param db Database instance
 * @param sendEvent Optional callback to send progress events
 */
export async function processImportWithProgress(
  rows: Array<Record<string, unknown>>,
  userId: string,
  db: PostgresJsDatabase<typeof schema>,
  sendEvent?: (event: ProgressEvent) => void,
): Promise<ProcessResult> {
  let successful = 0;
  let failed = 0;
  const errors: ImportError[] = [];
  const processedUrls = new Set<string>();

  // Enrich blank titles by fetching from URLs
  const enrichmentStats: EnrichmentStats = {
    attempted: 0,
    successful: 0,
    failed: 0,
  };

  // Phase 1: Enrichment
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Only attempt enrichment if title is blank
    if (
      !row.title ||
      (typeof row.title === "string" && row.title.trim() === "")
    ) {
      enrichmentStats.attempted++;
      const fetchedTitle = await fetchPageTitle(row.current_url as string);

      if (fetchedTitle) {
        row.title = fetchedTitle;
        enrichmentStats.successful++;
      } else {
        enrichmentStats.failed++;
      }
    }

    // Send progress every 10 rows
    if (sendEvent && (i + 1) % 10 === 0) {
      sendEvent({
        phase: "enriching",
        current: i + 1,
        total: rows.length,
        message: `Enriched ${i + 1} of ${rows.length} titles`,
      });
    }
  }

  // Final enrichment progress
  if (sendEvent && enrichmentStats.attempted > 0) {
    sendEvent({
      phase: "enriching",
      current: rows.length,
      total: rows.length,
      message: `Enrichment complete: ${enrichmentStats.successful}/${enrichmentStats.attempted} successful`,
    });
  }

  // Phase 2: Validation and insertion
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // Row 1 is headers, data starts at row 2
    const row = rows[i];
    if (!row) continue;

    try {
      // Validate row
      const validatedRow = csvRowSchema.parse(row);

      // Check for duplicate URL within CSV
      if (processedUrls.has(validatedRow.current_url)) {
        throw new Error("Duplicate URL in this CSV file");
      }

      // Check for duplicate URL in database
      const existing = await db.query.contentItems.findFirst({
        where: eq(contentItems.currentUrl, validatedRow.current_url),
      });

      if (existing) {
        throw new Error("URL already exists in database");
      }

      // Parse tags (comma-separated)
      const tags = validatedRow.tags
        ? validatedRow.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : undefined;

      // Parse campaign names (comma-separated)
      const campaignNames = validatedRow.campaigns
        ? validatedRow.campaigns
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
        : [];

      // Insert content item and link campaigns in a single transaction
      await db.transaction(async (tx) => {
        // Get or create campaigns INSIDE transaction
        const campaignIds: string[] = [];
        for (const campaignName of campaignNames) {
          // Check if campaign exists
          let campaign = await tx.query.campaigns.findFirst({
            where: eq(campaigns.name, campaignName),
          });

          // Create campaign if it doesn't exist
          if (!campaign) {
            const [newCampaign] = await tx
              .insert(campaigns)
              .values({ name: campaignName })
              .returning();
            campaign = newCampaign;
          }

          if (campaign) {
            campaignIds.push(campaign.id);
          }
        }

        // Create content item
        const [item] = await tx
          .insert(contentItems)
          .values({
            title: validatedRow.title || validatedRow.current_url,
            currentUrl: validatedRow.current_url,
            contentType: validatedRow.content_type,
            publishDate: validatedRow.publish_date,
            description: validatedRow.description,
            author: validatedRow.author,
            targetAudience: validatedRow.target_audience,
            tags,
            source: "csv_import",
            createdByUserId: userId,
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
            })),
          );
        }
      });

      // Track processed URL after successful transaction
      processedUrls.add(validatedRow.current_url);
      successful++;

      // Send progress every 10 rows
      if (sendEvent && (i + 1) % 10 === 0) {
        sendEvent({
          phase: "validating",
          current: i + 1,
          total: rows.length,
          message: `Processed ${i + 1} of ${rows.length} rows`,
        });
      }
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

  // Final processing progress
  if (sendEvent) {
    sendEvent({
      phase: "validating",
      current: rows.length,
      total: rows.length,
      message: `Processing complete: ${successful} successful, ${failed} failed`,
    });
  }

  return {
    successful,
    failed,
    errors,
    enrichment: enrichmentStats,
  };
}
