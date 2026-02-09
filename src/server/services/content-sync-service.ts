/**
 * Content Sync Service
 * Handles matching and syncing content from Ghost and Contentful APIs to the database
 */

import crypto from "node:crypto";
import { documentToPlainTextString } from "@contentful/rich-text-plain-text-renderer";
import type { Document } from "@contentful/rich-text-types";
import { eq, or } from "drizzle-orm";
import { db } from "~/server/db";
import { contentItems, contentText, contentTypes } from "~/server/db/schema";
import { countTokens, fetchYouTubeTranscript } from "./content-fetcher";
import type { CaseStudyEntry, LearnPageEntry } from "./contentful-api-client";
import type { GhostPost } from "./ghost-api-client";
import { indexFromExistingContent } from "./indexing-orchestrator";
import type { YouTubeVideo } from "./youtube-api-client";

// Cache content type IDs
const contentTypeCache = new Map<string, number>();

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ item: string; error: string }>;
}

export interface PreviewResult {
  newItems: number;
  updatable: number;
  skipped: number;
  details: Array<{
    title: string;
    url: string;
    status: "new" | "update" | "skip";
  }>;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function calculateHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export class ContentSyncService {
  // System user ID for API imports when no user is specified
  private readonly SYSTEM_USER_ID = "system-api-import";

  /**
   * Get content type ID by slug, with caching
   */
  private async getContentTypeId(slug: string): Promise<number> {
    if (contentTypeCache.has(slug)) {
      return contentTypeCache.get(slug)!;
    }

    const contentType = await db.query.contentTypes.findFirst({
      where: eq(contentTypes.slug, slug),
    });

    if (!contentType) {
      throw new Error(`Content type not found: ${slug}`);
    }

    contentTypeCache.set(slug, contentType.id);
    return contentType.id;
  }

  /**
   * Write or update a content_text row with API-provided content.
   * This avoids scraping by storing the CMS content directly.
   * The row is created with indexStatus 'pending' so the chunker/embedder picks it up.
   */
  private async writeContentText(
    contentItemId: string,
    plainTextContent: string,
    fullTextContent?: string,
  ): Promise<void> {
    if (!plainTextContent) return;

    const wordCount = countWords(plainTextContent);
    const tokenCount = await countTokens(plainTextContent);
    const contentHash = calculateHash(plainTextContent);

    const [record] = await db
      .insert(contentText)
      .values({
        contentItemId,
        fullText: fullTextContent ?? plainTextContent,
        plainText: plainTextContent,
        wordCount,
        tokenCount,
        contentHash,
        crawlDurationMs: 0, // No crawl needed — content from API
        indexStatus: "pending",
      })
      .onConflictDoUpdate({
        target: contentText.contentItemId,
        set: {
          fullText: fullTextContent ?? plainTextContent,
          plainText: plainTextContent,
          wordCount,
          tokenCount,
          contentHash,
          crawlDurationMs: 0,
          indexStatus: "pending",
          indexError: null,
        },
      })
      .returning({ id: contentText.id });

    // Immediately chunk + embed so content is fully indexed
    if (record) {
      await indexFromExistingContent(record.id);
    }
  }

  /**
   * Extract plain text from a Contentful RichText document
   */
  private extractRichTextPlain(richText: unknown): string {
    if (!richText || typeof richText !== "object") return "";
    try {
      return documentToPlainTextString(richText as Document);
    } catch {
      return "";
    }
  }

  /**
   * Sync Ghost blog posts to the database
   */
  async syncGhostPosts(posts: GhostPost[]): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const post of posts) {
      try {
        await this.syncGhostPost(post, result);
      } catch (error) {
        result.failed++;
        result.errors.push({
          item: `Ghost post: ${post.title}`,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Sync a single Ghost post
   */
  private async syncGhostPost(
    post: GhostPost,
    result: SyncResult,
  ): Promise<void> {
    // Normalize URL (remove blog prefix if present)
    const normalizedUrl = this.normalizeGhostUrl(post.url);

    // Find existing content by Ghost ID or URL
    const [existing] = await db
      .select()
      .from(contentItems)
      .where(
        or(
          eq(contentItems.ghostId, post.id),
          eq(contentItems.currentUrl, normalizedUrl),
        ),
      )
      .limit(1);

    if (existing) {
      // Check if we should update
      if (!this.shouldUpdate(existing.source, "ghost_api")) {
        result.skipped++;
        return;
      }

      // Check if content has changed
      const lastModified = new Date(post.updated_at);
      if (existing.lastModifiedAt && existing.lastModifiedAt >= lastModified) {
        result.skipped++;
        return;
      }

      // Update existing record
      await this.updateGhostPost(existing.id, post, normalizedUrl);
      result.updated++;
    } else {
      // Create new record
      await this.createGhostPost(post, normalizedUrl);
      result.created++;
    }
  }

  /**
   * Create a new Ghost post record
   */
  private async createGhostPost(
    post: GhostPost,
    normalizedUrl: string,
  ): Promise<void> {
    const contentTypeId = await this.getContentTypeId("blog_post");

    const [inserted] = await db
      .insert(contentItems)
      .values({
        title: post.title,
        currentUrl: normalizedUrl,
        contentTypeId,
        publishDate: new Date(post.published_at).toISOString().split("T")[0]!, // Date only
        description: post.excerpt || post.custom_excerpt || undefined,
        author: post.primary_author?.name || undefined,
        tags: post.tags?.map((t) => t.name) || [],
        source: "ghost_api" as const,
        ghostId: post.id,
        lastModifiedAt: new Date(post.updated_at),
        createdByUserId: this.SYSTEM_USER_ID,
      })
      .returning({ id: contentItems.id });

    if (inserted && post.plaintext) {
      await this.writeContentText(inserted.id, post.plaintext, post.html);
    }
  }

  /**
   * Update an existing Ghost post record
   */
  private async updateGhostPost(
    itemId: string,
    post: GhostPost,
    normalizedUrl: string,
  ): Promise<void> {
    const existing = await db.query.contentItems.findFirst({
      where: eq(contentItems.id, itemId),
    });

    if (!existing) return;

    // Handle URL change
    const urlChanged = existing.currentUrl !== normalizedUrl;
    const previousUrls = urlChanged
      ? [...(existing.previousUrls || []), existing.currentUrl]
      : existing.previousUrls;

    // Update the record
    await db
      .update(contentItems)
      .set({
        title: post.title,
        currentUrl: normalizedUrl,
        publishDate: new Date(post.published_at).toISOString().split("T")[0]!, // Date only
        description: post.excerpt || post.custom_excerpt || undefined,
        author: post.primary_author?.name || undefined,
        tags: post.tags?.map((t) => t.name) || [],
        ghostId: post.id,
        lastModifiedAt: new Date(post.updated_at),
        ...(urlChanged && { previousUrls }),
      })
      .where(eq(contentItems.id, itemId));

    // Update content_text with latest API content
    if (post.plaintext) {
      await this.writeContentText(itemId, post.plaintext, post.html);
    }
  }

  /**
   * Sync Contentful learn pages to the database
   */
  async syncLearnPages(pages: LearnPageEntry[]): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const page of pages) {
      try {
        await this.syncLearnPage(page, result);
      } catch (error) {
        result.failed++;
        result.errors.push({
          item: `Learn page: ${String(page.fields.title)}`,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Sync a single Contentful learn page
   */
  private async syncLearnPage(
    page: LearnPageEntry,
    result: SyncResult,
  ): Promise<void> {
    // Normalize URL (add https://www.tigerdata.com/ prefix if needed)
    const normalizedUrl = this.normalizeContentfulUrl(String(page.fields.url));

    // Find existing content by Contentful ID or URL
    const existing = await db.query.contentItems.findFirst({
      where: or(
        eq(contentItems.contentfulId, page.sys.id),
        eq(contentItems.currentUrl, normalizedUrl),
      ),
    });

    if (existing) {
      // Check if we should update
      if (!this.shouldUpdate(existing.source, "contentful_api")) {
        result.skipped++;
        return;
      }

      // Check if content has changed
      const lastModified = new Date(page.sys.updatedAt);
      if (existing.lastModifiedAt && existing.lastModifiedAt >= lastModified) {
        result.skipped++;
        return;
      }

      // Update existing record
      await this.updateLearnPage(existing.id, page, normalizedUrl);
      result.updated++;
    } else {
      // Create new record
      await this.createLearnPage(page, normalizedUrl);
      result.created++;
    }
  }

  /**
   * Create a new learn page record
   */
  private async createLearnPage(
    page: LearnPageEntry,
    normalizedUrl: string,
  ): Promise<void> {
    const contentTypeId = await this.getContentTypeId("website_content");

    // Collect tags from section and subSection
    const tagNames: string[] = [];
    if (page.fields.section) {
      tagNames.push(String(page.fields.section));
    }
    if (page.fields.subSection) {
      tagNames.push(String(page.fields.subSection));
    }

    const [inserted] = await db
      .insert(contentItems)
      .values({
        title: String(page.fields.title),
        currentUrl: normalizedUrl,
        contentTypeId,
        description: page.fields.metaDescription
          ? String(page.fields.metaDescription)
          : undefined,
        tags: tagNames,
        source: "contentful_api",
        contentfulId: page.sys.id,
        lastModifiedAt: new Date(page.sys.updatedAt),
        createdByUserId: this.SYSTEM_USER_ID,
      })
      .returning({ id: contentItems.id });

    if (inserted && page.fields.content) {
      const plainText = this.extractRichTextPlain(page.fields.content);
      if (plainText) {
        await this.writeContentText(inserted.id, plainText);
      }
    }
  }

  /**
   * Update an existing learn page record
   */
  private async updateLearnPage(
    itemId: string,
    page: LearnPageEntry,
    normalizedUrl: string,
  ): Promise<void> {
    const existing = await db.query.contentItems.findFirst({
      where: eq(contentItems.id, itemId),
    });

    if (!existing) return;

    // Handle URL change
    const urlChanged = existing.currentUrl !== normalizedUrl;
    const previousUrls = urlChanged
      ? [...(existing.previousUrls || []), existing.currentUrl]
      : existing.previousUrls;

    // Collect tags from section and subSection
    const tagNames: string[] = [];
    if (page.fields.section) {
      tagNames.push(String(page.fields.section));
    }
    if (page.fields.subSection) {
      tagNames.push(String(page.fields.subSection));
    }

    // Update the record
    await db
      .update(contentItems)
      .set({
        title: String(page.fields.title),
        currentUrl: normalizedUrl,
        description: page.fields.metaDescription
          ? String(page.fields.metaDescription)
          : undefined,
        tags: tagNames,
        contentfulId: page.sys.id,
        lastModifiedAt: new Date(page.sys.updatedAt),
        ...(urlChanged && { previousUrls }),
      })
      .where(eq(contentItems.id, itemId));

    // Update content_text with latest API content
    if (page.fields.content) {
      const plainText = this.extractRichTextPlain(page.fields.content);
      if (plainText) {
        await this.writeContentText(itemId, plainText);
      }
    }
  }

  /**
   * Sync Contentful case studies to the database
   */
  async syncCaseStudies(studies: CaseStudyEntry[]): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const study of studies) {
      try {
        await this.syncCaseStudy(study, result);
      } catch (error) {
        result.failed++;
        result.errors.push({
          item: `Case study: ${String(study.fields.name)}`,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Sync a single Contentful case study
   */
  private async syncCaseStudy(
    study: CaseStudyEntry,
    result: SyncResult,
  ): Promise<void> {
    // Use externalLink if available, otherwise construct URL from slug
    const externalLink = study.fields.externalLink
      ? String(study.fields.externalLink)
      : null;
    const normalizedUrl = externalLink
      ? externalLink
      : this.normalizeContentfulUrl(
          `case-studies/${String(study.fields.slug)}`,
        );

    // Skip case studies that link to external (non-tigerdata.com) domains (#16)
    if (!this.isTigerDataUrl(normalizedUrl)) {
      result.skipped++;
      return;
    }

    // Find existing content by Contentful ID or URL
    const existing = await db.query.contentItems.findFirst({
      where: or(
        eq(contentItems.contentfulId, study.sys.id),
        eq(contentItems.currentUrl, normalizedUrl),
      ),
    });

    if (existing) {
      // If the existing item is from a different source (e.g., a Ghost blog post
      // that a case study links to), merge metadata instead of skipping (#16)
      if (!this.shouldUpdate(existing.source, "contentful_api")) {
        await this.mergeCaseStudyMetadata(existing.id, existing.tags, study);
        result.updated++;
        return;
      }

      // Check if content has changed
      const lastModified = new Date(study.sys.updatedAt);
      if (existing.lastModifiedAt && existing.lastModifiedAt >= lastModified) {
        result.skipped++;
        return;
      }

      // Update existing record
      await this.updateCaseStudy(existing.id, study, normalizedUrl);
      result.updated++;
    } else {
      // Create new record
      await this.createCaseStudy(study, normalizedUrl);
      result.created++;
    }
  }

  /**
   * Merge case study metadata onto an existing content item from a different source.
   * Adds the contentfulId and enriches tags with case study category.
   * Does not change source, content type, or overwrite existing content.
   */
  private async mergeCaseStudyMetadata(
    itemId: string,
    existingTags: string[] | null,
    study: CaseStudyEntry,
  ): Promise<void> {
    const newTags = new Set(existingTags ?? []);
    newTags.add("case-study");
    if (study.fields.category) {
      newTags.add(String(study.fields.category));
    }

    await db
      .update(contentItems)
      .set({
        contentfulId: study.sys.id,
        tags: [...newTags],
      })
      .where(eq(contentItems.id, itemId));
  }

  /**
   * Create a new case study record
   */
  private async createCaseStudy(
    study: CaseStudyEntry,
    normalizedUrl: string,
  ): Promise<void> {
    const contentTypeId = await this.getContentTypeId("case_study");

    const description = study.fields.overview
      ? String(study.fields.overview)
      : study.fields.metaDescription
        ? String(study.fields.metaDescription)
        : undefined;

    const [inserted] = await db
      .insert(contentItems)
      .values({
        title: String(study.fields.name),
        currentUrl: normalizedUrl,
        contentTypeId,
        description,
        tags: study.fields.category ? [String(study.fields.category)] : [],
        source: "contentful_api",
        contentfulId: study.sys.id,
        lastModifiedAt: new Date(study.sys.updatedAt),
        createdByUserId: this.SYSTEM_USER_ID,
      })
      .returning({ id: contentItems.id });

    if (inserted && study.fields.content) {
      const plainText = this.extractRichTextPlain(study.fields.content);
      if (plainText) {
        await this.writeContentText(inserted.id, plainText);
      }
    }
  }

  /**
   * Update an existing case study record
   */
  private async updateCaseStudy(
    itemId: string,
    study: CaseStudyEntry,
    normalizedUrl: string,
  ): Promise<void> {
    const existing = await db.query.contentItems.findFirst({
      where: eq(contentItems.id, itemId),
    });

    if (!existing) return;

    // Handle URL change
    const urlChanged = existing.currentUrl !== normalizedUrl;
    const previousUrls = urlChanged
      ? [...(existing.previousUrls || []), existing.currentUrl]
      : existing.previousUrls;

    const description = study.fields.overview
      ? String(study.fields.overview)
      : study.fields.metaDescription
        ? String(study.fields.metaDescription)
        : undefined;

    // Update the record
    await db
      .update(contentItems)
      .set({
        title: String(study.fields.name),
        currentUrl: normalizedUrl,
        description,
        tags: study.fields.category ? [String(study.fields.category)] : [],
        contentfulId: study.sys.id,
        lastModifiedAt: new Date(study.sys.updatedAt),
        ...(urlChanged && { previousUrls }),
      })
      .where(eq(contentItems.id, itemId));

    // Update content_text with latest API content
    if (study.fields.content) {
      const plainText = this.extractRichTextPlain(study.fields.content);
      if (plainText) {
        await this.writeContentText(itemId, plainText);
      }
    }
  }

  /**
   * Preview Ghost posts (read-only matching, no INSERT/UPDATE)
   */
  async previewGhostPosts(posts: GhostPost[]): Promise<PreviewResult> {
    const result: PreviewResult = {
      newItems: 0,
      updatable: 0,
      skipped: 0,
      details: [],
    };

    for (const post of posts) {
      const normalizedUrl = this.normalizeGhostUrl(post.url);
      const [existing] = await db
        .select()
        .from(contentItems)
        .where(
          or(
            eq(contentItems.ghostId, post.id),
            eq(contentItems.currentUrl, normalizedUrl),
          ),
        )
        .limit(1);

      if (existing) {
        if (!this.shouldUpdate(existing.source, "ghost_api")) {
          result.skipped++;
          result.details.push({
            title: post.title,
            url: normalizedUrl,
            status: "skip",
          });
        } else {
          const lastModified = new Date(post.updated_at);
          if (
            existing.lastModifiedAt &&
            existing.lastModifiedAt >= lastModified
          ) {
            result.skipped++;
            result.details.push({
              title: post.title,
              url: normalizedUrl,
              status: "skip",
            });
          } else {
            result.updatable++;
            result.details.push({
              title: post.title,
              url: normalizedUrl,
              status: "update",
            });
          }
        }
      } else {
        result.newItems++;
        result.details.push({
          title: post.title,
          url: normalizedUrl,
          status: "new",
        });
      }
    }

    return result;
  }

  /**
   * Preview Contentful learn pages (read-only matching, no INSERT/UPDATE)
   */
  async previewLearnPages(pages: LearnPageEntry[]): Promise<PreviewResult> {
    const result: PreviewResult = {
      newItems: 0,
      updatable: 0,
      skipped: 0,
      details: [],
    };

    for (const page of pages) {
      const title = String(page.fields.title);
      const normalizedUrl = this.normalizeContentfulUrl(
        String(page.fields.url),
      );
      const existing = await db.query.contentItems.findFirst({
        where: or(
          eq(contentItems.contentfulId, page.sys.id),
          eq(contentItems.currentUrl, normalizedUrl),
        ),
      });

      if (existing) {
        if (!this.shouldUpdate(existing.source, "contentful_api")) {
          result.skipped++;
          result.details.push({ title, url: normalizedUrl, status: "skip" });
        } else {
          const lastModified = new Date(page.sys.updatedAt);
          if (
            existing.lastModifiedAt &&
            existing.lastModifiedAt >= lastModified
          ) {
            result.skipped++;
            result.details.push({ title, url: normalizedUrl, status: "skip" });
          } else {
            result.updatable++;
            result.details.push({
              title,
              url: normalizedUrl,
              status: "update",
            });
          }
        }
      } else {
        result.newItems++;
        result.details.push({ title, url: normalizedUrl, status: "new" });
      }
    }

    return result;
  }

  /**
   * Preview Contentful case studies (read-only matching, no INSERT/UPDATE)
   */
  async previewCaseStudies(studies: CaseStudyEntry[]): Promise<PreviewResult> {
    const result: PreviewResult = {
      newItems: 0,
      updatable: 0,
      skipped: 0,
      details: [],
    };

    for (const study of studies) {
      const title = String(study.fields.name);
      const externalLink = study.fields.externalLink
        ? String(study.fields.externalLink)
        : undefined;
      const slug = String(study.fields.slug);
      const normalizedUrl = externalLink
        ? externalLink
        : this.normalizeContentfulUrl(`case-studies/${slug}`);

      // Skip case studies that link to external (non-tigerdata.com) domains (#16)
      if (!this.isTigerDataUrl(normalizedUrl)) {
        result.skipped++;
        result.details.push({ title, url: normalizedUrl, status: "skip" });
        continue;
      }

      const existing = await db.query.contentItems.findFirst({
        where: or(
          eq(contentItems.contentfulId, study.sys.id),
          eq(contentItems.currentUrl, normalizedUrl),
        ),
      });

      if (existing) {
        if (!this.shouldUpdate(existing.source, "contentful_api")) {
          result.skipped++;
          result.details.push({ title, url: normalizedUrl, status: "skip" });
        } else {
          const lastModified = new Date(study.sys.updatedAt);
          if (
            existing.lastModifiedAt &&
            existing.lastModifiedAt >= lastModified
          ) {
            result.skipped++;
            result.details.push({ title, url: normalizedUrl, status: "skip" });
          } else {
            result.updatable++;
            result.details.push({
              title,
              url: normalizedUrl,
              status: "update",
            });
          }
        }
      } else {
        result.newItems++;
        result.details.push({ title, url: normalizedUrl, status: "new" });
      }
    }

    return result;
  }

  /**
   * Sync YouTube videos to the database
   */
  async syncYouTubeVideos(videos: YouTubeVideo[]): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const video of videos) {
      try {
        await this.syncYouTubeVideo(video, result);
      } catch (error) {
        result.failed++;
        result.errors.push({
          item: `YouTube video: ${video.title}`,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Sync a single YouTube video
   */
  private async syncYouTubeVideo(
    video: YouTubeVideo,
    result: SyncResult,
  ): Promise<void> {
    // Find existing content by YouTube video ID or URL
    const existing = await db.query.contentItems.findFirst({
      where: or(
        eq(contentItems.youtubeVideoId, video.id),
        eq(contentItems.currentUrl, video.url),
      ),
    });

    if (existing) {
      if (!this.shouldUpdate(existing.source, "youtube_api")) {
        result.skipped++;
        return;
      }

      // Check if content has changed via publishedAt (YouTube doesn't have updatedAt)
      const publishedDate = new Date(video.publishedAt);
      if (
        existing.lastModifiedAt &&
        existing.lastModifiedAt >= publishedDate &&
        existing.youtubeVideoId === video.id
      ) {
        result.skipped++;
        return;
      }

      await this.updateYouTubeVideo(existing.id, video);
      result.updated++;
    } else {
      await this.createYouTubeVideo(video);
      result.created++;
    }
  }

  /**
   * Create a new YouTube video record and fetch transcript
   */
  private async createYouTubeVideo(video: YouTubeVideo): Promise<void> {
    const contentTypeId = await this.getContentTypeId("youtube_video");

    const [inserted] = await db
      .insert(contentItems)
      .values({
        title: video.title,
        currentUrl: video.url,
        contentTypeId,
        publishDate: new Date(video.publishedAt).toISOString().split("T")[0]!,
        description: video.description || undefined,
        author: video.channelTitle || undefined,
        tags: video.tags.length > 0 ? video.tags : [],
        source: "youtube_api" as const,
        youtubeVideoId: video.id,
        lastModifiedAt: new Date(video.publishedAt),
        createdByUserId: this.SYSTEM_USER_ID,
      })
      .returning({ id: contentItems.id });

    // Fetch transcript and write content_text so it gets chunked + embedded
    if (inserted) {
      await this.fetchAndWriteTranscript(inserted.id, video.url);
    }
  }

  /**
   * Update an existing YouTube video record
   */
  private async updateYouTubeVideo(
    itemId: string,
    video: YouTubeVideo,
  ): Promise<void> {
    const existing = await db.query.contentItems.findFirst({
      where: eq(contentItems.id, itemId),
    });
    if (!existing) return;

    const urlChanged = existing.currentUrl !== video.url;
    const previousUrls = urlChanged
      ? [...(existing.previousUrls || []), existing.currentUrl]
      : existing.previousUrls;

    await db
      .update(contentItems)
      .set({
        title: video.title,
        currentUrl: video.url,
        publishDate: new Date(video.publishedAt).toISOString().split("T")[0]!,
        description: video.description || undefined,
        author: video.channelTitle || undefined,
        tags: video.tags.length > 0 ? video.tags : [],
        youtubeVideoId: video.id,
        lastModifiedAt: new Date(video.publishedAt),
        ...(urlChanged && { previousUrls }),
      })
      .where(eq(contentItems.id, itemId));

    // Re-fetch transcript on update
    await this.fetchAndWriteTranscript(itemId, video.url);
  }

  /**
   * Preview YouTube videos (read-only matching, no INSERT/UPDATE)
   */
  async previewYouTubeVideos(videos: YouTubeVideo[]): Promise<PreviewResult> {
    const result: PreviewResult = {
      newItems: 0,
      updatable: 0,
      skipped: 0,
      details: [],
    };

    for (const video of videos) {
      const existing = await db.query.contentItems.findFirst({
        where: or(
          eq(contentItems.youtubeVideoId, video.id),
          eq(contentItems.currentUrl, video.url),
        ),
      });

      if (existing) {
        if (!this.shouldUpdate(existing.source, "youtube_api")) {
          result.skipped++;
          result.details.push({
            title: video.title,
            url: video.url,
            status: "skip",
          });
        } else {
          const publishedDate = new Date(video.publishedAt);
          if (
            existing.lastModifiedAt &&
            existing.lastModifiedAt >= publishedDate &&
            existing.youtubeVideoId === video.id
          ) {
            result.skipped++;
            result.details.push({
              title: video.title,
              url: video.url,
              status: "skip",
            });
          } else {
            result.updatable++;
            result.details.push({
              title: video.title,
              url: video.url,
              status: "update",
            });
          }
        }
      } else {
        result.newItems++;
        result.details.push({
          title: video.title,
          url: video.url,
          status: "new",
        });
      }
    }

    return result;
  }

  /**
   * Fetch transcript for a YouTube video and write it to content_text
   */
  private async fetchAndWriteTranscript(
    contentItemId: string,
    url: string,
  ): Promise<void> {
    try {
      const fetchResult = await fetchYouTubeTranscript(url);
      if (fetchResult.plainText) {
        await this.writeContentText(contentItemId, fetchResult.plainText);
      }
    } catch (error) {
      console.warn(
        `[YouTube] Failed to fetch transcript for ${url}:`,
        error instanceof Error ? error.message : error,
      );
      // Don't fail the sync — video is imported with metadata but not indexed
    }
  }

  /**
   * Check if a URL belongs to tigerdata.com
   */
  private isTigerDataUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === "www.tigerdata.com" ||
        parsed.hostname === "tigerdata.com"
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if we should update a content item based on its source
   */
  private shouldUpdate(
    existingSource: string,
    newSource: "ghost_api" | "contentful_api" | "youtube_api",
  ): boolean {
    // Only update if existing source is the same API or if it's manual/csv
    // Don't update if it's from a different API
    const apiSources = ["ghost_api", "contentful_api", "youtube_api"];
    if (
      apiSources.includes(existingSource) &&
      apiSources.includes(newSource) &&
      existingSource !== newSource
    ) {
      return false;
    }
    return true;
  }

  /**
   * Normalize Ghost blog post URL
   * Remove the blog domain prefix, keep just the path
   */
  private normalizeGhostUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Return pathname without trailing slash
      const path = parsed.pathname.replace(/\/+$/, "");
      return `https://www.tigerdata.com${path}`;
    } catch {
      return url;
    }
  }

  /**
   * Normalize Contentful URL
   * Add https://www.tigerdata.com/ prefix if not present
   */
  private normalizeContentfulUrl(url: string): string {
    let normalized: string;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      normalized = url;
    } else {
      // Remove leading slash if present
      const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
      normalized = `https://www.tigerdata.com/${cleanUrl}`;
    }
    // Strip trailing slash for consistency
    return normalized.replace(/\/+$/, "");
  }
}

// Export singleton instance
export const contentSyncService = new ContentSyncService();
