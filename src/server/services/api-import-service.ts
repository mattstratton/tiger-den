/**
 * API Import Service
 * Orchestrates preview, batching, and logging for Ghost and Contentful imports
 */

import { desc, eq } from "drizzle-orm";
import { apiConfig } from "~/server/config/api-config";
import { db } from "~/server/db";
import { apiImportLogs, users } from "~/server/db/schema";
import {
  contentSyncService,
  type PreviewResult,
  type SyncResult,
} from "./content-sync-service";
import {
  type CaseStudySkeleton,
  contentfulClient,
  type LearnPageSkeleton,
} from "./contentful-api-client";
import { ghostClient } from "./ghost-api-client";
import { youtubeClient } from "./youtube-api-client";

export type ImportSource =
  | "ghost"
  | "contentful_learn"
  | "contentful_case_study"
  | "youtube_channel";

export interface ConnectionStatus {
  ghost: { enabled: boolean; connected: boolean; error?: string };
  contentful: { enabled: boolean; connected: boolean; error?: string };
  youtube: { enabled: boolean; connected: boolean; error?: string };
}

export interface SingleItemResult {
  title: string;
  url: string;
  raw: unknown;
}

export interface ImportResult {
  source: ImportSource;
  dryRun: boolean;
  totalItems: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ item: string; error: string }>;
  preview?: PreviewResult;
}

export interface ImportLogEntry {
  id: string;
  sourceType: string;
  startedAt: Date;
  completedAt: Date | null;
  totalItems: number;
  createdCount: number | null;
  updatedCount: number | null;
  skippedCount: number | null;
  failedCount: number | null;
  errorDetails: unknown;
  dryRun: boolean | null;
  initiatedByUserId: string | null;
}

class ApiImportService {
  /**
   * Test connections to both Ghost and Contentful APIs
   */
  async testConnections(): Promise<ConnectionStatus> {
    const [ghostResult, contentfulResult, youtubeResult] = await Promise.all([
      ghostClient.isEnabled()
        ? ghostClient.testConnection()
        : Promise.resolve({ success: false, error: "Not configured" }),
      contentfulClient.isEnabled()
        ? contentfulClient.testConnection()
        : Promise.resolve({ success: false, error: "Not configured" }),
      youtubeClient.isEnabled()
        ? youtubeClient.testConnection()
        : Promise.resolve({ success: false, error: "Not configured" }),
    ]);

    return {
      ghost: {
        enabled: ghostClient.isEnabled(),
        connected: ghostResult.success,
        error: ghostResult.error,
      },
      contentful: {
        enabled: contentfulClient.isEnabled(),
        connected: contentfulResult.success,
        error: contentfulResult.error,
      },
      youtube: {
        enabled: youtubeClient.isEnabled(),
        connected: youtubeResult.success,
        error: youtubeResult.error,
      },
    };
  }

  /**
   * Fetch a single item by slug/ID from the appropriate API client
   */
  async fetchSingleItem(
    source: ImportSource,
    identifier: string,
  ): Promise<SingleItemResult | null> {
    switch (source) {
      case "ghost": {
        // Try slug first, then ID
        let post = await ghostClient.fetchPost(identifier);
        if (!post) {
          post = await ghostClient.fetchPostById(identifier);
        }
        if (!post) return null;
        return {
          title: post.title,
          url: post.url,
          raw: post,
        };
      }
      case "contentful_learn": {
        const entry =
          await contentfulClient.fetchEntry<LearnPageSkeleton>(identifier);
        if (!entry) return null;
        return {
          title: String(entry.fields.title),
          url: String(entry.fields.url),
          raw: entry,
        };
      }
      case "contentful_case_study": {
        const entry =
          await contentfulClient.fetchEntry<CaseStudySkeleton>(identifier);
        if (!entry) return null;
        return {
          title: String(entry.fields.name),
          url:
            (entry.fields.externalLink
              ? String(entry.fields.externalLink)
              : null) ?? `case-studies/${String(entry.fields.slug)}`,
          raw: entry,
        };
      }
      case "youtube_channel": {
        const video = await youtubeClient.fetchVideoById(identifier);
        if (!video) return null;
        return {
          title: video.title,
          url: video.url,
          raw: video,
        };
      }
    }
  }

  /**
   * Fetch all items from a source and run preview (read-only matching)
   */
  async fetchPreview(
    source: ImportSource,
    options?: { since?: Date },
  ): Promise<PreviewResult> {
    switch (source) {
      case "ghost": {
        const posts = options?.since
          ? await ghostClient.fetchPostsSince(options.since)
          : await ghostClient.fetchAllPostsPaginated();
        return contentSyncService.previewGhostPosts(posts);
      }
      case "contentful_learn": {
        const pages = options?.since
          ? await contentfulClient.fetchLearnPagesSince(options.since)
          : await contentfulClient.fetchAllLearnPages();
        return contentSyncService.previewLearnPages(pages);
      }
      case "contentful_case_study": {
        const studies = options?.since
          ? await contentfulClient.fetchCaseStudiesSince(options.since)
          : await contentfulClient.fetchAllCaseStudies();
        return contentSyncService.previewCaseStudies(studies);
      }
      case "youtube_channel": {
        const videos = await youtubeClient.fetchChannelVideos({
          since: options?.since,
        });
        return contentSyncService.previewYouTubeVideos(videos);
      }
    }
  }

  /**
   * Execute an import from a source with batching and logging
   */
  async executeImport(
    source: ImportSource,
    userId: string | null,
    options?: { since?: Date; dryRun?: boolean },
  ): Promise<ImportResult> {
    const dryRun = options?.dryRun ?? false;

    // If dry run, just do preview and log it
    if (dryRun) {
      const preview = await this.fetchPreview(source, {
        since: options?.since,
      });
      const totalItems = preview.newItems + preview.updatable + preview.skipped;

      // Log the dry run
      await db.insert(apiImportLogs).values({
        sourceType: source,
        totalItems,
        createdCount: preview.newItems,
        updatedCount: preview.updatable,
        skippedCount: preview.skipped,
        failedCount: 0,
        dryRun: true,
        initiatedByUserId: userId,
        completedAt: new Date(),
      });

      return {
        source,
        dryRun: true,
        totalItems,
        created: preview.newItems,
        updated: preview.updatable,
        skipped: preview.skipped,
        failed: 0,
        errors: [],
        preview,
      };
    }

    // Resolve a user ID for content attribution (createdByUserId is NOT NULL)
    const syncUserId = userId ?? (await this.getSystemUserId());

    // Fetch all items
    const items = await this.fetchItems(source, options?.since);
    const { batchSize, chunkDelayMs } = apiConfig.import;

    // Process in chunks
    const mergedResult: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const chunkResult = await this.syncChunk(source, chunk, syncUserId);

      mergedResult.created += chunkResult.created;
      mergedResult.updated += chunkResult.updated;
      mergedResult.skipped += chunkResult.skipped;
      mergedResult.failed += chunkResult.failed;
      mergedResult.errors.push(...chunkResult.errors);

      // Delay between chunks (skip after last chunk)
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, chunkDelayMs));
      }
    }

    // Log the import — initiatedByUserId is null for system-initiated imports
    await db.insert(apiImportLogs).values({
      sourceType: source,
      totalItems: items.length,
      createdCount: mergedResult.created,
      updatedCount: mergedResult.updated,
      skippedCount: mergedResult.skipped,
      failedCount: mergedResult.failed,
      errorDetails: mergedResult.errors.length > 0 ? mergedResult.errors : null,
      dryRun: false,
      initiatedByUserId: userId,
      completedAt: new Date(),
    });

    return {
      source,
      dryRun: false,
      totalItems: items.length,
      created: mergedResult.created,
      updated: mergedResult.updated,
      skipped: mergedResult.skipped,
      failed: mergedResult.failed,
      errors: mergedResult.errors,
    };
  }

  /**
   * Get import history logs
   */
  async getImportHistory(options?: {
    limit?: number;
    offset?: number;
  }): Promise<ImportLogEntry[]> {
    const rows = await db
      .select()
      .from(apiImportLogs)
      .orderBy(desc(apiImportLogs.startedAt))
      .limit(options?.limit ?? 20)
      .offset(options?.offset ?? 0);

    return rows;
  }

  // --- Private helpers ---

  /**
   * Find a system user (first admin) for scheduled import content attribution.
   */
  private async getSystemUserId(): Promise<string> {
    const adminUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (adminUser[0]) return adminUser[0].id;

    const anyUser = await db.select({ id: users.id }).from(users).limit(1);

    if (anyUser[0]) return anyUser[0].id;

    throw new Error("No users found in database for system imports");
  }

  private async fetchItems(
    source: ImportSource,
    since?: Date,
  ): Promise<unknown[]> {
    switch (source) {
      case "ghost":
        return since
          ? ghostClient.fetchPostsSince(since)
          : ghostClient.fetchAllPostsPaginated();
      case "contentful_learn":
        return since
          ? contentfulClient.fetchLearnPagesSince(since)
          : contentfulClient.fetchAllLearnPages();
      case "contentful_case_study":
        return since
          ? contentfulClient.fetchCaseStudiesSince(since)
          : contentfulClient.fetchAllCaseStudies();
      case "youtube_channel":
        return youtubeClient.fetchChannelVideos({ since });
    }
  }

  private async syncChunk(
    source: ImportSource,
    chunk: unknown[],
    userId: string,
  ): Promise<SyncResult> {
    switch (source) {
      case "ghost":
        return contentSyncService.syncGhostPosts(
          chunk as Parameters<typeof contentSyncService.syncGhostPosts>[0],
          userId,
        );
      case "contentful_learn":
        return contentSyncService.syncLearnPages(
          chunk as Parameters<typeof contentSyncService.syncLearnPages>[0],
          userId,
        );
      case "contentful_case_study":
        return contentSyncService.syncCaseStudies(
          chunk as Parameters<typeof contentSyncService.syncCaseStudies>[0],
          userId,
        );
      case "youtube_channel":
        return contentSyncService.syncYouTubeVideos(
          chunk as Parameters<typeof contentSyncService.syncYouTubeVideos>[0],
          userId,
        );
    }
  }
}

export const apiImportService = new ApiImportService();
