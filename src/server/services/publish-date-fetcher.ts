import * as cheerio from "cheerio";
import { extractYouTubeVideoId } from "~/server/services/content-fetcher";
import { youtubeClient } from "~/server/services/youtube-api-client";
import { parseFlexibleDate } from "~/server/utils/date-parser";

export interface UrlMetadata {
  title: string | null;
  publishDate: string | null;
  author: string | null;
}

/**
 * Fetch metadata (title, publish date, author) from a single URL.
 * YouTube URLs use the YouTube Data API; web URLs parse HTML meta tags.
 * Never throws — returns nulls on any error.
 */
export async function fetchUrlMetadata(
  url: string,
  timeoutMs = 5000,
): Promise<UrlMetadata> {
  try {
    // YouTube URL → use API
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return fetchYouTubeMetadata(videoId);
    }

    // Web URL → parse HTML
    return fetchWebMetadata(url, timeoutMs);
  } catch {
    return { title: null, publishDate: null, author: null };
  }
}

/**
 * Fetch metadata for multiple URLs, batching YouTube API calls.
 * Returns a Map of URL → UrlMetadata.
 */
export async function fetchUrlMetadataBatch(
  urls: string[],
): Promise<Map<string, UrlMetadata>> {
  const result = new Map<string, UrlMetadata>();

  // Separate YouTube and web URLs
  const youtubeEntries: Array<{ url: string; videoId: string }> = [];
  const webUrls: string[] = [];

  for (const url of urls) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      youtubeEntries.push({ url, videoId });
    } else {
      webUrls.push(url);
    }
  }

  // Batch fetch YouTube metadata
  if (youtubeEntries.length > 0 && youtubeClient.isEnabled()) {
    try {
      const videoIds = youtubeEntries.map((e) => e.videoId);
      const ytMetadata = await youtubeClient.fetchVideoMetadataBatch(videoIds);

      for (const entry of youtubeEntries) {
        const meta = ytMetadata.get(entry.videoId);
        if (meta) {
          result.set(entry.url, {
            title: meta.title,
            publishDate: meta.publishDate,
            author: meta.author,
          });
        } else {
          result.set(entry.url, {
            title: null,
            publishDate: null,
            author: null,
          });
        }
      }
    } catch {
      // YouTube API failed — set nulls for all YouTube URLs
      for (const entry of youtubeEntries) {
        result.set(entry.url, {
          title: null,
          publishDate: null,
          author: null,
        });
      }
    }
  } else {
    // YouTube API not enabled — set nulls
    for (const entry of youtubeEntries) {
      result.set(entry.url, {
        title: null,
        publishDate: null,
        author: null,
      });
    }
  }

  // Fetch web URLs individually
  for (const url of webUrls) {
    const metadata = await fetchWebMetadata(url);
    result.set(url, metadata);
  }

  return result;
}

async function fetchYouTubeMetadata(videoId: string): Promise<UrlMetadata> {
  if (!youtubeClient.isEnabled()) {
    return { title: null, publishDate: null, author: null };
  }

  try {
    const video = await youtubeClient.fetchVideoById(videoId);
    if (!video) {
      return { title: null, publishDate: null, author: null };
    }

    return {
      title: video.title,
      publishDate: video.publishedAt
        ? (video.publishedAt.split("T")[0] ?? null)
        : null,
      author: video.channelTitle || null,
    };
  } catch {
    return { title: null, publishDate: null, author: null };
  }
}

async function fetchWebMetadata(
  url: string,
  timeoutMs = 5000,
): Promise<UrlMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TigerDen-MetadataBot/1.0",
      },
    });

    if (!response.ok) {
      return { title: null, publishDate: null, author: null };
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) {
      return { title: null, publishDate: null, author: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = extractTitle($);
    const publishDate = extractPublishDate($);
    const author = extractAuthor($);

    return { title, publishDate, author };
  } catch {
    return { title: null, publishDate: null, author: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle($: cheerio.CheerioAPI): string | null {
  // Try OG title first, then <title> tag
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) return ogTitle;

  const titleTag = $("title").text().trim();
  return titleTag || null;
}

function extractPublishDate($: cheerio.CheerioAPI): string | null {
  // Priority 1: JSON-LD datePublished / dateCreated
  const jsonLdDate = extractDateFromJsonLd($);
  if (jsonLdDate) return jsonLdDate;

  // Priority 2: <meta property="article:published_time">
  const articlePublished = $('meta[property="article:published_time"]')
    .attr("content")
    ?.trim();
  if (articlePublished) {
    const parsed = parseFlexibleDate(articlePublished);
    if (parsed) return parsed;
  }

  // Priority 3: <meta property="og:article:published_time">
  const ogArticlePublished = $('meta[property="og:article:published_time"]')
    .attr("content")
    ?.trim();
  if (ogArticlePublished) {
    const parsed = parseFlexibleDate(ogArticlePublished);
    if (parsed) return parsed;
  }

  // Priority 4: <meta name="date"> / <meta name="publish-date">
  for (const name of ["date", "publish-date"]) {
    const val = $(`meta[name="${name}"]`).attr("content")?.trim();
    if (val) {
      const parsed = parseFlexibleDate(val);
      if (parsed) return parsed;
    }
  }

  // Priority 5: <meta name="DC.date.issued"> / <meta name="dcterms.date">
  for (const name of ["DC.date.issued", "dcterms.date"]) {
    const val = $(`meta[name="${name}"]`).attr("content")?.trim();
    if (val) {
      const parsed = parseFlexibleDate(val);
      if (parsed) return parsed;
    }
  }

  // Priority 6: <time datetime> inside <article>
  const articleTime = $("article time[datetime]")
    .first()
    .attr("datetime")
    ?.trim();
  if (articleTime) {
    const parsed = parseFlexibleDate(articleTime);
    if (parsed) return parsed;
  }

  // Priority 7: First <time datetime> on page
  const firstTime = $("time[datetime]").first().attr("datetime")?.trim();
  if (firstTime) {
    const parsed = parseFlexibleDate(firstTime);
    if (parsed) return parsed;
  }

  return null;
}

function extractDateFromJsonLd($: cheerio.CheerioAPI): string | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const text = $(scripts[i]).text();
      const data = JSON.parse(text) as Record<string, unknown>;

      // Check for direct datePublished/dateCreated
      const directDate = extractDateFromObject(data);
      if (directDate) return directDate;

      // Check @graph arrays
      if (Array.isArray(data["@graph"])) {
        for (const item of data["@graph"] as Record<string, unknown>[]) {
          const graphDate = extractDateFromObject(item);
          if (graphDate) return graphDate;
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }
  return null;
}

function extractDateFromObject(obj: Record<string, unknown>): string | null {
  for (const key of ["datePublished", "dateCreated"]) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) {
      const parsed = parseFlexibleDate(val.trim());
      if (parsed) return parsed;
    }
  }
  return null;
}

function extractAuthor($: cheerio.CheerioAPI): string | null {
  // <meta name="author">
  const metaAuthor = $('meta[name="author"]').attr("content")?.trim();
  if (metaAuthor) return metaAuthor;

  // <meta property="article:author">
  const articleAuthor = $('meta[property="article:author"]')
    .attr("content")
    ?.trim();
  if (articleAuthor) return articleAuthor;

  // JSON-LD author.name
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const text = $(scripts[i]).text();
      const data = JSON.parse(text) as Record<string, unknown>;

      const authorName = extractAuthorFromObject(data);
      if (authorName) return authorName;

      if (Array.isArray(data["@graph"])) {
        for (const item of data["@graph"] as Record<string, unknown>[]) {
          const graphAuthor = extractAuthorFromObject(item);
          if (graphAuthor) return graphAuthor;
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return null;
}

function extractAuthorFromObject(obj: Record<string, unknown>): string | null {
  const author = obj.author;
  if (!author) return null;

  if (typeof author === "string" && author.trim()) {
    return author.trim();
  }

  if (typeof author === "object" && author !== null) {
    const authorObj = author as Record<string, unknown>;
    if (typeof authorObj.name === "string" && authorObj.name.trim()) {
      return authorObj.name.trim();
    }
  }

  if (Array.isArray(author) && author.length > 0) {
    const first = author[0] as Record<string, unknown>;
    if (typeof first?.name === "string" && first.name.trim()) {
      return first.name.trim();
    }
  }

  return null;
}
