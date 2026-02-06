/**
 * Content Sync Service
 * Handles matching and syncing content from Ghost and Contentful APIs to the database
 */

import { eq, or } from "drizzle-orm";
import { db } from "~/server/db";
import { contentItems, contentTypes } from "~/server/db/schema";
import type { GhostPost } from "./ghost-api-client";
import type { LearnPageEntry, CaseStudyEntry } from "./contentful-api-client";

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
  details: Array<{ title: string; url: string; status: "new" | "update" | "skip" }>;
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
      if (
        existing.lastModifiedAt &&
        existing.lastModifiedAt >= lastModified
      ) {
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

    await db.insert(contentItems).values({
      title: post.title,
      currentUrl: normalizedUrl,
      contentTypeId,
      publishDate: new Date(post.published_at).toISOString().split('T')[0]!, // Date only
      description: post.excerpt || post.custom_excerpt || undefined,
      author: post.primary_author?.name || undefined,
      tags: post.tags?.map((t) => t.name) || [],
      source: "ghost_api" as const,
      ghostId: post.id,
      lastModifiedAt: new Date(post.updated_at),
      createdByUserId: this.SYSTEM_USER_ID,
    });
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
        publishDate: new Date(post.published_at).toISOString().split('T')[0]!, // Date only
        description: post.excerpt || post.custom_excerpt || undefined,
        author: post.primary_author?.name || undefined,
        tags: post.tags?.map((t) => t.name) || [],
        ghostId: post.id,
        lastModifiedAt: new Date(post.updated_at),
        ...(urlChanged && { previousUrls }),
      })
      .where(eq(contentItems.id, itemId));
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
    // Normalize URL (add https://www.timescale.com/ prefix if needed)
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
      if (
        existing.lastModifiedAt &&
        existing.lastModifiedAt >= lastModified
      ) {
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

    await db.insert(contentItems).values({
      title: String(page.fields.title),
      currentUrl: normalizedUrl,
      contentTypeId,
      description: page.fields.metaDescription ? String(page.fields.metaDescription) : undefined,
      tags: tagNames,
      source: "contentful_api",
      contentfulId: page.sys.id,
      lastModifiedAt: new Date(page.sys.updatedAt),
      createdByUserId: this.SYSTEM_USER_ID,
    });
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
        description: page.fields.metaDescription ? String(page.fields.metaDescription) : undefined,
        tags: tagNames,
        contentfulId: page.sys.id,
        lastModifiedAt: new Date(page.sys.updatedAt),
        ...(urlChanged && { previousUrls }),
      })
      .where(eq(contentItems.id, itemId));
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
    const externalLink = study.fields.externalLink ? String(study.fields.externalLink) : null;
    const normalizedUrl = externalLink
      ? externalLink
      : this.normalizeContentfulUrl(`customers/${String(study.fields.slug)}`);

    // Find existing content by Contentful ID or URL
    const existing = await db.query.contentItems.findFirst({
      where: or(
        eq(contentItems.contentfulId, study.sys.id),
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
      const lastModified = new Date(study.sys.updatedAt);
      if (
        existing.lastModifiedAt &&
        existing.lastModifiedAt >= lastModified
      ) {
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

    await db.insert(contentItems).values({
      title: String(study.fields.name),
      currentUrl: normalizedUrl,
      contentTypeId,
      description,
      tags: study.fields.category ? [String(study.fields.category)] : [],
      source: "contentful_api",
      contentfulId: study.sys.id,
      lastModifiedAt: new Date(study.sys.updatedAt),
      createdByUserId: this.SYSTEM_USER_ID,
    });
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
  }

  /**
   * Preview Ghost posts (read-only matching, no INSERT/UPDATE)
   */
  async previewGhostPosts(posts: GhostPost[]): Promise<PreviewResult> {
    const result: PreviewResult = { newItems: 0, updatable: 0, skipped: 0, details: [] };

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
          result.details.push({ title: post.title, url: normalizedUrl, status: "skip" });
        } else {
          const lastModified = new Date(post.updated_at);
          if (existing.lastModifiedAt && existing.lastModifiedAt >= lastModified) {
            result.skipped++;
            result.details.push({ title: post.title, url: normalizedUrl, status: "skip" });
          } else {
            result.updatable++;
            result.details.push({ title: post.title, url: normalizedUrl, status: "update" });
          }
        }
      } else {
        result.newItems++;
        result.details.push({ title: post.title, url: normalizedUrl, status: "new" });
      }
    }

    return result;
  }

  /**
   * Preview Contentful learn pages (read-only matching, no INSERT/UPDATE)
   */
  async previewLearnPages(pages: LearnPageEntry[]): Promise<PreviewResult> {
    const result: PreviewResult = { newItems: 0, updatable: 0, skipped: 0, details: [] };

    for (const page of pages) {
      const title = String(page.fields.title);
      const normalizedUrl = this.normalizeContentfulUrl(String(page.fields.url));
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
          if (existing.lastModifiedAt && existing.lastModifiedAt >= lastModified) {
            result.skipped++;
            result.details.push({ title, url: normalizedUrl, status: "skip" });
          } else {
            result.updatable++;
            result.details.push({ title, url: normalizedUrl, status: "update" });
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
    const result: PreviewResult = { newItems: 0, updatable: 0, skipped: 0, details: [] };

    for (const study of studies) {
      const title = String(study.fields.name);
      const externalLink = study.fields.externalLink ? String(study.fields.externalLink) : undefined;
      const slug = String(study.fields.slug);
      const normalizedUrl = externalLink
        ? externalLink
        : this.normalizeContentfulUrl(`customers/${slug}`);

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
          if (existing.lastModifiedAt && existing.lastModifiedAt >= lastModified) {
            result.skipped++;
            result.details.push({ title, url: normalizedUrl, status: "skip" });
          } else {
            result.updatable++;
            result.details.push({ title, url: normalizedUrl, status: "update" });
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
   * Check if we should update a content item based on its source
   */
  private shouldUpdate(
    existingSource: string,
    newSource: "ghost_api" | "contentful_api",
  ): boolean {
    // Only update if existing source is the same API or if it's manual/csv
    // Don't update if it's from a different API
    if (existingSource === "ghost_api" && newSource === "contentful_api") {
      return false;
    }
    if (existingSource === "contentful_api" && newSource === "ghost_api") {
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
      // Return just the pathname without leading slash
      return `https://www.timescale.com${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Normalize Contentful URL
   * Add https://www.timescale.com/ prefix if not present
   */
  private normalizeContentfulUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // Remove leading slash if present
    const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
    return `https://www.timescale.com/${cleanUrl}`;
  }
}

// Export singleton instance
export const contentSyncService = new ContentSyncService();
