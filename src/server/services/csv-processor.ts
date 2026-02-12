import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ZodError, z } from "zod";
import * as schema from "~/server/db/schema";
import { extractYouTubeVideoId } from "~/server/services/content-fetcher";
import {
  fetchUrlMetadata,
  fetchUrlMetadataBatch,
} from "~/server/services/publish-date-fetcher";
import { parseFlexibleDate } from "~/server/utils/date-parser";
import { indexContent } from "./indexing-orchestrator";

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

export interface MetadataEnrichmentStats {
  title: EnrichmentStats;
  date: EnrichmentStats;
  author: EnrichmentStats;
}

export interface ProcessResult {
  successful: number;
  failed: number;
  errors: ImportError[];
  enrichment: MetadataEnrichmentStats;
  indexed: number;
  indexingFailed: number;
}

export interface ProgressEvent {
  phase: "enriching" | "validating";
  current: number;
  total: number;
  message: string;
}

function isBlank(value: unknown): boolean {
  return !value || (typeof value === "string" && value.trim() === "");
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
  const successfulInserts: Array<{ id: string; currentUrl: string }> = [];

  // Fetch all content types and create slug-to-ID mapping
  const allContentTypes = await db.query.contentTypes.findMany();
  const contentTypeMap = new Map(allContentTypes.map((ct) => [ct.slug, ct.id]));
  const otherTypeId = allContentTypes.find((ct) => ct.isSystem)?.id;

  if (!otherTypeId) {
    throw new Error("System 'Other' content type not found");
  }

  const enrichmentStats: MetadataEnrichmentStats = {
    title: { attempted: 0, successful: 0, failed: 0 },
    date: { attempted: 0, successful: 0, failed: 0 },
    author: { attempted: 0, successful: 0, failed: 0 },
  };

  // Phase 1a: Batch YouTube pre-fetch
  // Collect YouTube URLs that need any metadata
  const youtubeRowIndices: number[] = [];
  const youtubeUrls: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const url = row.current_url;
    if (typeof url !== "string") continue;

    const videoId = extractYouTubeVideoId(url);
    if (
      videoId &&
      (isBlank(row.title) || isBlank(row.publish_date) || isBlank(row.author))
    ) {
      youtubeRowIndices.push(i);
      youtubeUrls.push(url);
    }
  }

  if (youtubeUrls.length > 0) {
    const ytMetadata = await fetchUrlMetadataBatch(youtubeUrls);

    for (let j = 0; j < youtubeRowIndices.length; j++) {
      const rowIdx = youtubeRowIndices[j]!;
      const row = rows[rowIdx]!;
      const url = youtubeUrls[j]!;
      const meta = ytMetadata.get(url);
      if (!meta) continue;

      if (isBlank(row.title)) {
        enrichmentStats.title.attempted++;
        if (meta.title) {
          row.title = meta.title;
          enrichmentStats.title.successful++;
        } else {
          enrichmentStats.title.failed++;
        }
      }

      if (isBlank(row.publish_date)) {
        enrichmentStats.date.attempted++;
        if (meta.publishDate) {
          row.publish_date = meta.publishDate;
          enrichmentStats.date.successful++;
        } else {
          enrichmentStats.date.failed++;
        }
      }

      if (isBlank(row.author)) {
        enrichmentStats.author.attempted++;
        if (meta.author) {
          row.author = meta.author;
          enrichmentStats.author.successful++;
        } else {
          enrichmentStats.author.failed++;
        }
      }
    }

    if (sendEvent) {
      sendEvent({
        phase: "enriching",
        current: youtubeUrls.length,
        total: rows.length,
        message: `Enriched ${youtubeUrls.length} YouTube URLs`,
      });
    }
  }

  // Phase 1b: Individual web page enrichment
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const url = row.current_url;
    if (typeof url !== "string") continue;

    // Skip YouTube URLs (already handled in batch)
    if (extractYouTubeVideoId(url)) continue;

    // Check if any metadata is needed
    const needsTitle = isBlank(row.title);
    const needsDate = isBlank(row.publish_date);
    const needsAuthor = isBlank(row.author);

    if (!needsTitle && !needsDate && !needsAuthor) continue;

    const meta = await fetchUrlMetadata(url);

    if (needsTitle) {
      enrichmentStats.title.attempted++;
      if (meta.title) {
        row.title = meta.title;
        enrichmentStats.title.successful++;
      } else {
        enrichmentStats.title.failed++;
      }
    }

    if (needsDate) {
      enrichmentStats.date.attempted++;
      if (meta.publishDate) {
        row.publish_date = meta.publishDate;
        enrichmentStats.date.successful++;
      } else {
        enrichmentStats.date.failed++;
      }
    }

    if (needsAuthor) {
      enrichmentStats.author.attempted++;
      if (meta.author) {
        row.author = meta.author;
        enrichmentStats.author.successful++;
      } else {
        enrichmentStats.author.failed++;
      }
    }

    // Send progress every 10 rows
    if (sendEvent && (i + 1) % 10 === 0) {
      sendEvent({
        phase: "enriching",
        current: i + 1,
        total: rows.length,
        message: `Enriching metadata: ${i + 1} of ${rows.length} rows`,
      });
    }
  }

  // Final enrichment progress
  const totalAttempted =
    enrichmentStats.title.attempted +
    enrichmentStats.date.attempted +
    enrichmentStats.author.attempted;
  if (sendEvent && totalAttempted > 0) {
    const totalSuccessful =
      enrichmentStats.title.successful +
      enrichmentStats.date.successful +
      enrichmentStats.author.successful;
    sendEvent({
      phase: "enriching",
      current: rows.length,
      total: rows.length,
      message: `Enrichment complete: ${totalSuccessful}/${totalAttempted} fields populated`,
    });
  }

  // Phase 2: Validation and insertion
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // Row 1 is headers, data starts at row 2
    const row = rows[i];
    if (!row) continue;

    try {
      // Normalize date format if present
      if (typeof row.publish_date === "string") {
        if (row.publish_date.trim() === "") {
          row.publish_date = undefined; // Empty → NULL
        } else {
          const parsedDate = parseFlexibleDate(row.publish_date);
          if (parsedDate) {
            row.publish_date = parsedDate;
          }
          // Leave unparseable dates for Zod to catch
        }
      }

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
        ? validatedRow.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
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

        // Map content type slug to ID
        const contentTypeId =
          contentTypeMap.get(validatedRow.content_type) ?? otherTypeId;

        // Create content item
        const [item] = await tx
          .insert(contentItems)
          .values({
            title: validatedRow.title || validatedRow.current_url,
            currentUrl: validatedRow.current_url,
            contentTypeId,
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

        // Track successful insert for indexing
        successfulInserts.push({
          id: item.id,
          currentUrl: item.currentUrl,
        });
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

  // Index content (sync for ≤10 items, async for 11+)
  let indexed = 0;
  let indexingFailed = 0;

  const itemsToIndex = successfulInserts.map((item) => ({
    id: item.id,
    url: item.currentUrl,
  }));

  if (itemsToIndex.length > 0) {
    try {
      const indexingResult = await indexContent(itemsToIndex);

      // Update stats with indexing results
      indexed = indexingResult.succeeded;
      indexingFailed = indexingResult.failed;
    } catch (error) {
      console.error("Content indexing failed:", error);
      // Don't fail import if indexing fails
      indexingFailed = itemsToIndex.length;
    }
  }

  return {
    successful,
    failed,
    errors,
    enrichment: enrichmentStats,
    indexed,
    indexingFailed,
  };
}
