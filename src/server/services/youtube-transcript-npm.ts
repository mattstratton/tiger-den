/**
 * YouTube transcript fetcher with Supadata fallback.
 *
 * Strategy:
 * 1. Try innertube ANDROID client (free, works locally / some cloud IPs)
 * 2. If that fails and SUPADATA_API_KEY is set, fall back to Supadata API
 */

import { env } from "~/env";
import type { YouTubeTranscriptResult } from "./youtube-transcript-ytdlp";

const WATCH_URL = "https://www.youtube.com/watch?v=";
const INNERTUBE_API_URL =
  "https://www.youtube.com/youtubei/v1/player?key=";
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
  },
};
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

/**
 * Fetch YouTube transcript — tries innertube first, then Supadata fallback.
 */
export async function fetchYouTubeTranscriptViaNpm(
  videoId: string,
): Promise<YouTubeTranscriptResult | null> {
  // If Supadata is configured, use it directly (innertube is blocked on cloud IPs)
  if (env.SUPADATA_API_KEY) {
    console.log(`[SUPADATA] Using Supadata for ${videoId} (API key configured)`);
    const supadataResult = await fetchViaSupadata(videoId);
    if (supadataResult) return supadataResult;
    // If Supadata fails, still try innertube as last resort
  }

  // Try innertube (works locally, blocked on most cloud IPs)
  const innertubeResult = await fetchViaInnertube(videoId);
  if (innertubeResult) return innertubeResult;

  console.warn(`[YouTube] All transcript methods failed for ${videoId}`);
  return null;
}

/**
 * Fetch transcript via YouTube innertube ANDROID client.
 */
async function fetchViaInnertube(
  videoId: string,
): Promise<YouTubeTranscriptResult | null> {
  try {
    // Step 1: Get innertube API key from watch page
    const pageResp = await fetch(`${WATCH_URL}${videoId}`, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await pageResp.text();

    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (!apiKeyMatch?.[1]) {
      console.warn(`[YouTube] Could not extract innertube API key for ${videoId} (page status: ${pageResp.status}, html length: ${html.length})`);
      return null;
    }
    const apiKey = apiKeyMatch[1];

    // Step 2: Call innertube player API with ANDROID client
    const playerResp = await fetch(`${INNERTUBE_API_URL}${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        context: INNERTUBE_CONTEXT,
        videoId,
      }),
    });

    if (!playerResp.ok) {
      console.warn(
        `[YouTube] Innertube player API returned ${playerResp.status} for ${videoId}`,
      );
      return null;
    }

    const playerData = (await playerResp.json()) as {
      playabilityStatus?: { status?: string; reason?: string };
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{
            baseUrl: string;
            languageCode: string;
            kind?: string;
          }>;
        };
      };
    };

    const playabilityStatus = playerData.playabilityStatus?.status;
    if (playabilityStatus && playabilityStatus !== "OK") {
      console.warn(
        `[YouTube] Player status ${playabilityStatus} for ${videoId}: ${playerData.playabilityStatus?.reason ?? "no reason"}`,
      );
      return null;
    }

    const captionTracks =
      playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      console.warn(`[YouTube] No caption tracks for ${videoId} (playability: ${playabilityStatus ?? "unknown"})`);
      return null;
    }

    // Find English track (prefer manual over auto-generated)
    const enManual = captionTracks.find(
      (t) => t.languageCode === "en" && t.kind !== "asr",
    );
    const enAuto = captionTracks.find((t) => t.languageCode === "en");
    const track = enManual ?? enAuto ?? captionTracks[0];
    if (!track) return null;

    // Step 3: Fetch caption XML (strip &fmt=srv3 if present)
    const captionUrl = track.baseUrl.replace("&fmt=srv3", "");
    const captionResp = await fetch(captionUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!captionResp.ok) {
      console.warn(
        `[YouTube] Caption fetch returned ${captionResp.status} for ${videoId}`,
      );
      return null;
    }

    const xml = await captionResp.text();
    if (!xml) return null;

    // Step 4: Parse XML to extract text
    const text = parseTranscriptXml(xml);
    if (!text) return null;

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return { text, wordCount };
  } catch (error) {
    console.warn(
      `[YouTube] Innertube error for ${videoId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Track last Supadata request time for rate limiting (1 req/sec on free plan) */
let lastSupadataRequestMs = 0;
const SUPADATA_MIN_INTERVAL_MS = 1_100; // 1.1s between requests
const SUPADATA_MAX_RETRIES = 2;

async function supadataRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSupadataRequestMs;
  if (elapsed < SUPADATA_MIN_INTERVAL_MS) {
    const waitMs = SUPADATA_MIN_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastSupadataRequestMs = Date.now();
}

/**
 * Fetch transcript via Supadata API (reliable from cloud environments).
 * See: https://docs.supadata.ai/get-transcript
 */
async function fetchViaSupadata(
  videoId: string,
): Promise<YouTubeTranscriptResult | null> {
  try {
    const youtubeUrl = encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    );
    const url = `https://api.supadata.ai/v1/transcript?url=${youtubeUrl}&text=true`;

    let resp: Response | null = null;
    for (let attempt = 0; attempt <= SUPADATA_MAX_RETRIES; attempt++) {
      await supadataRateLimit();

      if (attempt > 0) {
        console.log(`[SUPADATA] retry ${attempt} for ${videoId}`);
      }
      console.log(`[SUPADATA] request: ${videoId}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        resp = await fetch(url, {
          headers: {
            "x-api-key": env.SUPADATA_API_KEY!,
          },
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          console.warn(`[SUPADATA] timeout (30s) for ${videoId}`);
          return null;
        }
        throw fetchErr;
      }
      clearTimeout(timeout);

      if (resp.status === 429) {
        console.warn(`[SUPADATA] rate limited (429) for ${videoId}, waiting 2s`);
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        continue;
      }
      break;
    }

    if (!resp || !resp.ok) {
      const body = resp ? await resp.text().catch(() => "") : "no response";
      console.warn(`[SUPADATA] returned ${resp?.status ?? "?"} for ${videoId}: ${body}`);
      return null;
    }

    const data = (await resp.json()) as {
      content?: string;
      lang?: string;
    };

    if (!data.content) {
      console.warn(`[SUPADATA] empty content for ${videoId}`);
      return null;
    }

    const text = data.content.replace(/\s+/g, " ").trim();
    if (!text) {
      console.warn(`[SUPADATA] blank transcript for ${videoId}`);
      return null;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log(
      `[SUPADATA] OK for ${videoId}: ${wordCount} words (lang: ${data.lang ?? "unknown"})`,
    );
    return { text, wordCount };
    return null;
  } catch (error) {
    console.warn(
      `[SUPADATA] error for ${videoId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Parse transcript XML and extract plain text.
 * Handles both legacy XML format and srv3 format.
 */
function parseTranscriptXml(xml: string): string | null {
  // Match <text ...>content</text> segments
  const segments = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)];
  if (segments.length === 0) return null;

  const text = segments
    .map((m) =>
      (m[1] ?? "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<[^>]+>/g, "") // Strip any inline HTML tags
        .replace(/\n/g, " "),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}
