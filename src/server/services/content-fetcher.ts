import { encoding_for_model } from "tiktoken";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { indexingConfig } from "~/server/config/indexing-config";

export interface FetchResult {
  plainText: string;
  fullText: string;
  wordCount: number;
  tokenCount: number;
  duration: number;
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
 * Fetch and extract content from web page
 * Uses cheerio for HTML parsing
 * 5-second timeout, strips nav/footer/ads
 */
export async function fetchWebContent(url: string): Promise<FetchResult> {
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

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script, style, nav, footer, aside, .advertisement, .ad").remove();

    // Extract main content
    const mainContent =
      $("main").text() || $("article").text() || $("body").text();

    // Clean up whitespace
    const plainText = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
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
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ContentFetchError(
        `Timeout after ${duration}ms`,
        url,
        error,
      );
    }

    throw new ContentFetchError(
      error instanceof Error ? error.message : "Unknown error",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Fetch YouTube transcript
 * Uses youtube-transcript package
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

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    // Combine all text segments (strip timestamps)
    const plainText = transcript.map((segment) => segment.text).join(" ");

    const fullText = plainText; // No HTML for transcripts
    const wordCount = countWords(plainText);
    const tokenCount = await countTokens(plainText);
    const duration = Date.now() - startTime;

    return {
      plainText,
      fullText,
      wordCount,
      tokenCount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Transcript not available - return empty (don't fail)
    if (
      error instanceof Error &&
      error.message.includes("Could not find transcript")
    ) {
      return {
        plainText: "",
        fullText: "",
        wordCount: 0,
        tokenCount: 0,
        duration,
      };
    }

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
