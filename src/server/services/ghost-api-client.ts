/**
 * Ghost API Client
 * Fetches blog posts from Ghost CMS
 */

import GhostContentAPI from "@tryghost/content-api";
import { apiConfig } from "~/server/config/api-config";

export interface GhostPost {
  id: string;
  title: string;
  slug: string;
  html: string;
  plaintext: string;
  excerpt: string | null;
  custom_excerpt: string | null;
  published_at: string;
  updated_at: string;
  primary_author: {
    name: string;
  } | null;
  tags: Array<{
    name: string;
  }>;
  url: string;
}

export interface GhostPostsResponse {
  posts: GhostPost[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      pages: number;
      total: number;
      next: number | null;
      prev: number | null;
    };
  };
}

class GhostAPIClient {
  private api: GhostContentAPI | null = null;

  constructor() {
    if (apiConfig.ghost.enabled) {
      this.api = new GhostContentAPI({
        url: apiConfig.ghost.apiUrl!,
        key: apiConfig.ghost.contentApiKey!,
        version: "v5.0",
      });
    }
  }

  /**
   * Check if Ghost API is configured and available
   */
  isEnabled(): boolean {
    return apiConfig.ghost.enabled && this.api !== null;
  }

  /**
   * Test connection to Ghost API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: "Ghost API not configured" };
    }

    try {
      // Try to fetch one post to verify connection
      await this.api!.posts.browse({ limit: 1 });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch a single post by slug
   */
  async fetchPost(slug: string): Promise<GhostPost | null> {
    if (!this.isEnabled()) {
      throw new Error("Ghost API not configured");
    }

    try {
      const post = await this.api!.posts.read(
        { slug },
        { include: ["tags", "authors"] },
      );
      return post as GhostPost;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch a single post by ID
   */
  async fetchPostById(id: string): Promise<GhostPost | null> {
    if (!this.isEnabled()) {
      throw new Error("Ghost API not configured");
    }

    try {
      const post = await this.api!.posts.read(
        { id },
        { include: ["tags", "authors"] },
      );
      return post as GhostPost;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch all posts with pagination
   */
  async fetchAllPosts(options?: {
    limit?: number;
    page?: number;
  }): Promise<GhostPostsResponse> {
    if (!this.isEnabled()) {
      throw new Error("Ghost API not configured");
    }

    const response = await this.api!.posts.browse({
      limit: options?.limit ?? 50,
      page: options?.page ?? 1,
      include: ["tags", "authors"],
    });

    return response as unknown as GhostPostsResponse;
  }

  /**
   * Fetch posts updated since a specific date
   */
  async fetchPostsSince(
    date: Date,
    options?: { limit?: number },
  ): Promise<GhostPost[]> {
    if (!this.isEnabled()) {
      throw new Error("Ghost API not configured");
    }

    // Ghost uses ISO 8601 format for date filters
    const isoDate = date.toISOString();

    const response = await this.api!.posts.browse({
      limit: options?.limit ?? "all",
      filter: `updated_at:>'${isoDate}'`,
      include: ["tags", "authors"],
    });

    return response as unknown as GhostPost[];
  }

  /**
   * Fetch all posts (handles pagination automatically)
   */
  async fetchAllPostsPaginated(): Promise<GhostPost[]> {
    if (!this.isEnabled()) {
      throw new Error("Ghost API not configured");
    }

    const allPosts: GhostPost[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchAllPosts({ limit: 50, page });
      allPosts.push(...response.posts);

      hasMore = response.meta.pagination.next !== null;
      page++;
    }

    return allPosts;
  }
}

// Export singleton instance
export const ghostClient = new GhostAPIClient();
