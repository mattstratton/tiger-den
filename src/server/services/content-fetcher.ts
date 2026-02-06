import * as cheerio from "cheerio";
import { encoding_for_model } from "tiktoken";
import { indexingConfig } from "~/server/config/indexing-config";
import { fetchYouTubeTranscriptViaYtdlp } from "./youtube-transcript-ytdlp";

export interface FetchResult {
  plainText: string;
  fullText: string;
  wordCount: number;
  tokenCount: number;
  duration: number;
  finalUrl: string; // URL after following redirects
  wasRedirected: boolean; // True if URL redirected
}

export class ContentFetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ContentFetchError";
  }
}

/**
 * Extract YouTube video ID from URL
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Count tokens using tiktoken (OpenAI compatible)
 * Uses cl100k_base encoding (same as text-embedding-3-small)
 */
async function countTokens(text: string): Promise<number> {
  try {
    const encoding = encoding_for_model("text-embedding-3-small");
    const tokens = encoding.encode(text);
    encoding.free(); // Free memory
    return tokens.length;
  } catch (error) {
    console.error("Token counting failed:", error);
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count words (simple whitespace split)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Fetch and extract content from web page (static HTML only)
 * Uses cheerio for HTML parsing
 * 5-second timeout, strips nav/footer/ads
 */
async function fetchWebContentStatic(url: string): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      indexingConfig.timeoutPerUrl,
    );

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TigerDen/1.0; +https://tigerdata.com)",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check for redirects
    const finalUrl = response.url;
    const wasRedirected = finalUrl !== url;

    if (wasRedirected) {
      console.log(`[Redirect detected] ${url} → ${finalUrl}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Part 1: Remove unwanted elements by tag name
    $("script, style, nav, footer, aside").remove();

    // Part 2: Remove elements by common navigation/UI class patterns
    $(
      [
        '[class*="header"]',
        '[class*="navbar"]',
        '[class*="nav-"]',
        '[class*="navigation"]',
        '[class*="menu"]',
        '[class*="sidebar"]',
        '[class*="footer"]',
        '[class*="breadcrumb"]',
        '[id*="header"]',
        '[id*="nav"]',
        '[id*="menu"]',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]',
        ".advertisement",
        ".ad",
        '[class*="cookie"]',
        '[class*="consent"]',
      ].join(", "),
    ).remove();

    // Remove header tags (often contain navigation)
    $("header").remove();

    // Part 3: Remove common UI button elements
    $(
      [
        '[class*="share"]',
        '[class*="social"]',
        '[class*="copy"]',
        '[class*="button"]',
        '[class*="actions"]',
        '[class*="toolbar"]',
        '[id*="share"]',
        '[id*="copy"]',
        'button',
      ].join(", "),
    ).remove();

    // Part 4: Remove elements by common button text patterns
    $('*').filter(function() {
      const text = $(this).text().trim();
      const buttonPatterns = [
        /^Copy as /i,
        /^Open in /i,
        /^Share on /i,
        /^Download /i,
        /^Print$/i,
        /^Export /i,
      ];
      return buttonPatterns.some(pattern => pattern.test(text)) && text.length < 50;
    }).remove();

    // Part 5: Extract main content with priority order
    let mainContent = "";

    // Try to find article content first
    const articleSelectors = [
      "main article", // Article inside main tag
      "article", // Standalone article
      'main [role="main"]', // Main content by ARIA role
      "main .content", // Common content wrapper
      "main .post-content", // Blog post content
      "main .article-content", // Article content
      ".markdown-body", // GitHub/markdown content
      "main", // Fallback to main tag
    ];

    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        mainContent = element.text();
        // Only use this if we got substantial content (more than just a title)
        if (mainContent.trim().length > 100) {
          break;
        }
      }
    }

    // Ultimate fallback: body (but this should rarely be needed now)
    if (!mainContent || mainContent.trim().length < 100) {
      mainContent = $("body").text();
    }

    // Part 4: Clean up whitespace more aggressively
    const plainText = mainContent
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .replace(/\n\s*\n/g, "\n") // Remove empty lines
      .replace(/^\s+|\s+$/gm, "") // Trim each line
      .trim();

    const fullText = $.html();
    const wordCount = countWords(plainText);
    const tokenCount = await countTokens(plainText);
    const duration = Date.now() - startTime;

    return {
      plainText,
      fullText,
      wordCount,
      tokenCount,
      duration,
      finalUrl,
      wasRedirected,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ContentFetchError(`Timeout after ${duration}ms`, url, error);
    }

    throw new ContentFetchError(
      error instanceof Error ? error.message : "Unknown error",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Fetch and extract content from web page
 * Uses improved static HTML extraction with comprehensive filtering
 */
export async function fetchWebContent(url: string): Promise<FetchResult> {
  return fetchWebContentStatic(url);
}

/**
 * Fetch YouTube transcript using yt-dlp
 * Supports manual captions and auto-generated captions
 * Handles missing transcripts gracefully
 */
export async function fetchYouTubeTranscript(
  url: string,
): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      throw new ContentFetchError("Invalid YouTube URL", url);
    }

    // Fetch transcript using yt-dlp
    const result = await fetchYouTubeTranscriptViaYtdlp(videoId);

    // If no transcript available, return empty
    if (!result) {
      const duration = Date.now() - startTime;
      return {
        plainText: "",
        fullText: "",
        wordCount: 0,
        tokenCount: 0,
        duration,
        finalUrl: url, // YouTube URLs don't redirect
        wasRedirected: false,
      };
    }

    const plainText = result.text;
    const fullText = plainText; // No HTML for transcripts
    const wordCount = result.wordCount;
    const tokenCount = await countTokens(plainText);
    const duration = Date.now() - startTime;

    return {
      plainText,
      fullText,
      wordCount,
      tokenCount,
      duration,
      finalUrl: url, // YouTube URLs don't redirect
      wasRedirected: false,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    throw new ContentFetchError(
      error instanceof Error ? error.message : "Unknown error",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Fetch content from URL (auto-detect type)
 * Dispatches to web or YouTube fetcher based on URL
 */
export async function fetchContent(url: string): Promise<FetchResult> {
  // Check if YouTube URL
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return fetchYouTubeTranscript(url);
  }

  // Default to web content
  return fetchWebContent(url);
}
