/**
 * YouTube Data API v3 Client
 * Fetches channel videos and metadata using raw fetch (no googleapis SDK)
 */

import { apiConfig } from "~/server/config/api-config";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelTitle: string;
  thumbnailUrl: string;
  tags: string[];
  duration: string;
  url: string;
}

interface PlaylistItemSnippet {
  publishedAt: string;
  title: string;
  description: string;
  resourceId: { videoId: string };
  channelTitle: string;
  thumbnails?: {
    high?: { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items: Array<{ snippet: PlaylistItemSnippet }>;
  pageInfo: { totalResults: number };
}

interface VideoSnippet {
  title: string;
  description: string;
  publishedAt: string;
  channelTitle: string;
  tags?: string[];
  thumbnails?: {
    high?: { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
}

interface VideoContentDetails {
  duration: string;
}

interface VideosResponse {
  items: Array<{
    id: string;
    snippet: VideoSnippet;
    contentDetails: VideoContentDetails;
  }>;
}

interface ChannelResponse {
  items: Array<{
    snippet: { title: string };
    statistics: { videoCount: string };
    contentDetails: {
      relatedPlaylists: { uploads: string };
    };
  }>;
}

class YouTubeAPIClient {
  private get apiKey(): string | undefined {
    return apiConfig.youtube.apiKey;
  }

  private get defaultChannelId(): string | undefined {
    return apiConfig.youtube.channelId;
  }

  private requireApiKey(): string {
    const key = this.apiKey;
    if (!key) throw new Error("YouTube API key not configured");
    return key;
  }

  isEnabled(): boolean {
    return apiConfig.youtube.enabled;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: "YouTube API not configured" };
    }

    try {
      const info = await this.fetchChannelInfo();
      if (!info) {
        return { success: false, error: "Channel not found" };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async fetchChannelInfo(
    channelId?: string,
  ): Promise<{ title: string; videoCount: number } | null> {
    const id = channelId ?? this.defaultChannelId;
    if (!id) throw new Error("No channel ID configured");

    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id,
      key: this.requireApiKey(),
    });

    const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);
    if (!response.ok) {
      throw new Error(
        `YouTube API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ChannelResponse;
    const channel = data.items?.[0];
    if (!channel) return null;

    return {
      title: channel.snippet.title,
      videoCount: parseInt(channel.statistics.videoCount, 10),
    };
  }

  async fetchChannelVideos(options?: {
    channelId?: string;
    since?: Date;
  }): Promise<YouTubeVideo[]> {
    const channelId = options?.channelId ?? this.defaultChannelId;
    if (!channelId) throw new Error("No channel ID configured");

    // Get uploads playlist ID by replacing UC prefix with UU
    const uploadsPlaylistId = channelId.startsWith("UC")
      ? `UU${channelId.slice(2)}`
      : await this.getUploadsPlaylistId(channelId);

    if (!uploadsPlaylistId) {
      throw new Error("Could not determine uploads playlist ID");
    }

    // Paginate through playlistItems
    const videoIds: Array<{ id: string; publishedAt: string }> = [];
    let pageToken: string | undefined;
    let stopPaginating = false;

    while (!stopPaginating) {
      const params = new URLSearchParams({
        part: "snippet",
        playlistId: uploadsPlaylistId,
        maxResults: "50",
        key: this.requireApiKey(),
      });
      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(
        `${YOUTUBE_API_BASE}/playlistItems?${params}`,
      );
      if (!response.ok) {
        throw new Error(
          `YouTube API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as PlaylistItemsResponse;

      for (const item of data.items) {
        const publishedAt = item.snippet.publishedAt;
        // Client-side date filtering (YouTube API doesn't support it on playlistItems)
        if (options?.since && new Date(publishedAt) < options.since) {
          stopPaginating = true;
          break;
        }
        videoIds.push({
          id: item.snippet.resourceId.videoId,
          publishedAt,
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;

      // Rate limiting: 200ms between pages
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Fetch full video details in batches of 50
    const videos: YouTubeVideo[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const batchVideos = await this.fetchVideoDetails(batch.map((v) => v.id));
      videos.push(...batchVideos);

      if (i + 50 < videoIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return videos;
  }

  async fetchVideoById(videoId: string): Promise<YouTubeVideo | null> {
    const videos = await this.fetchVideoDetails([videoId]);
    return videos[0] ?? null;
  }

  /**
   * Fetch metadata (title, publishDate, author) for multiple video IDs in batches of 50.
   * Returns a Map of videoId → metadata.
   */
  async fetchVideoMetadataBatch(
    videoIds: string[],
  ): Promise<
    Map<string, { title: string; publishDate: string | null; author: string }>
  > {
    const result = new Map<
      string,
      { title: string; publishDate: string | null; author: string }
    >();

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const videos = await this.fetchVideoDetails(batch);

      for (const video of videos) {
        result.set(video.id, {
          title: video.title,
          publishDate: video.publishedAt
            ? (video.publishedAt.split("T")[0] ?? null)
            : null,
          author: video.channelTitle,
        });
      }

      // Rate limiting between batches
      if (i + 50 < videoIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return result;
  }

  private async fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
    if (videoIds.length === 0) return [];

    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: videoIds.join(","),
      key: this.requireApiKey(),
    });

    const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
    if (!response.ok) {
      throw new Error(
        `YouTube API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as VideosResponse;

    return data.items.map((item) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        "",
      tags: item.snippet.tags ?? [],
      duration: item.contentDetails.duration,
      url: `https://www.youtube.com/watch?v=${item.id}`,
    }));
  }

  private async getUploadsPlaylistId(
    channelId: string,
  ): Promise<string | null> {
    const params = new URLSearchParams({
      part: "contentDetails",
      id: channelId,
      key: this.requireApiKey(),
    });

    const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);
    if (!response.ok) return null;

    const data = (await response.json()) as ChannelResponse;
    return data.items?.[0]?.contentDetails.relatedPlaylists.uploads ?? null;
  }
}

export const youtubeClient = new YouTubeAPIClient();
