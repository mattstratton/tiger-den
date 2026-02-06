/**
 * Contentful API Client
 * Fetches learn pages and case studies from Contentful CMS
 */

import {
  createClient,
  type Entry,
  type EntryCollection,
  type EntrySkeletonType,
} from "contentful";
import { apiConfig } from "~/server/config/api-config";

// Learn Page content type skeleton
export interface LearnPageSkeleton extends EntrySkeletonType {
  contentTypeId: "learnPage";
  fields: {
    Title: string;
    Url: string;
    Content: any; // RichText document
    "Meta Title"?: string;
    "Meta Description"?: string;
    Section?: string;
  };
}

// Case Study content type skeleton
export interface CaseStudySkeleton extends EntrySkeletonType {
  contentTypeId: "successStoriesCompany";
  fields: {
    name: string;
    slug: string;
    externalLink?: string;
    content: any; // RichText document
    overview?: string;
    category?: string;
    metaTitle?: string;
    metaDescription?: string;
  };
}

export type LearnPageEntry = Entry<LearnPageSkeleton>;
export type CaseStudyEntry = Entry<CaseStudySkeleton>;

class ContentfulAPIClient {
  private client: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (apiConfig.contentful.enabled) {
      this.client = createClient({
        space: apiConfig.contentful.spaceId!,
        accessToken: apiConfig.contentful.accessToken!,
        environment: apiConfig.contentful.environment,
      });
    }
  }

  /**
   * Check if Contentful API is configured and available
   */
  isEnabled(): boolean {
    return apiConfig.contentful.enabled && this.client !== null;
  }

  /**
   * Test connection to Contentful API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: "Contentful API not configured" };
    }

    try {
      // Try to fetch space info to verify connection
      await this.client!.getSpace();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch a single entry by ID
   */
  async fetchEntry<T extends EntrySkeletonType>(
    entryId: string,
  ): Promise<Entry<T> | null> {
    if (!this.isEnabled()) {
      throw new Error("Contentful API not configured");
    }

    try {
      const entry = await this.client!.getEntry<T>(entryId);
      return entry;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch entries by content type
   */
  async fetchEntriesByType<T extends EntrySkeletonType>(
    contentType: string,
    options?: {
      limit?: number;
      skip?: number;
    },
  ): Promise<EntryCollection<T>> {
    if (!this.isEnabled()) {
      throw new Error("Contentful API not configured");
    }

    return await this.client!.getEntries<T>({
      content_type: contentType,
      limit: options?.limit ?? 100,
      skip: options?.skip ?? 0,
    });
  }

  /**
   * Fetch entries updated since a specific date
   */
  async fetchEntriesUpdatedSince<T extends EntrySkeletonType>(
    contentType: string,
    date: Date,
    options?: { limit?: number },
  ): Promise<EntryCollection<T>> {
    if (!this.isEnabled()) {
      throw new Error("Contentful API not configured");
    }

    return await this.client!.getEntries<T>({
      content_type: contentType,
      limit: options?.limit ?? 100,
      "sys.updatedAt[gt]":
        date.toISOString() as `${number}-${number}-${number}T${number}:${number}:${number}Z`,
    });
  }

  /**
   * Fetch all entries of a content type (handles pagination automatically)
   */
  async fetchAllEntries<T extends EntrySkeletonType>(
    contentType: string,
  ): Promise<Entry<T>[]> {
    if (!this.isEnabled()) {
      throw new Error("Contentful API not configured");
    }

    const allEntries: Entry<T>[] = [];
    let skip = 0;
    const limit = 100; // Contentful's max per request
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchEntriesByType<T>(contentType, {
        limit,
        skip,
      });

      allEntries.push(...response.items);

      // Check if there are more pages
      hasMore = skip + limit < response.total;
      skip += limit;
    }

    return allEntries;
  }

  // Convenience methods for specific content types

  /**
   * Fetch all learn pages
   */
  async fetchLearnPages(options?: {
    limit?: number;
    skip?: number;
  }): Promise<EntryCollection<LearnPageSkeleton>> {
    return await this.fetchEntriesByType<LearnPageSkeleton>(
      "learnPage",
      options,
    );
  }

  /**
   * Fetch all learn pages (paginated)
   */
  async fetchAllLearnPages(): Promise<LearnPageEntry[]> {
    return await this.fetchAllEntries<LearnPageSkeleton>("learnPage");
  }

  /**
   * Fetch learn pages updated since date
   */
  async fetchLearnPagesSince(date: Date): Promise<LearnPageEntry[]> {
    const response =
      await this.fetchEntriesUpdatedSince<LearnPageSkeleton>("learnPage", date);
    return response.items;
  }

  /**
   * Fetch all case studies
   */
  async fetchCaseStudies(options?: {
    limit?: number;
    skip?: number;
  }): Promise<EntryCollection<CaseStudySkeleton>> {
    return await this.fetchEntriesByType<CaseStudySkeleton>(
      "successStoriesCompany",
      options,
    );
  }

  /**
   * Fetch all case studies (paginated)
   */
  async fetchAllCaseStudies(): Promise<CaseStudyEntry[]> {
    return await this.fetchAllEntries<CaseStudySkeleton>(
      "successStoriesCompany",
    );
  }

  /**
   * Fetch case studies updated since date
   */
  async fetchCaseStudiesSince(date: Date): Promise<CaseStudyEntry[]> {
    const response = await this.fetchEntriesUpdatedSince<CaseStudySkeleton>(
      "successStoriesCompany",
      date,
    );
    return response.items;
  }
}

// Export singleton instance
export const contentfulClient = new ContentfulAPIClient();
