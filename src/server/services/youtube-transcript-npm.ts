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
  // Try innertube first
  const innertubeResult = await fetchViaInnertube(videoId);
  if (innertubeResult) return innertubeResult;

  // Fall back to Supadata if configured
  if (env.SUPADATA_API_KEY) {
    console.log(`[YouTube] Innertube failed for ${videoId}, trying Supadata`);
    return fetchViaSupadata(videoId);
  }

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

/**
 * Fetch transcript via Supadata API (reliable from cloud environments).
 * See: https://docs.supadata.ai/get-transcript
 */
async function fetchViaSupadata(
  videoId: string,
): Promise<YouTubeTranscriptResult | null> {
  try {
    const url = `https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=${videoId}&lang=en&text=true`;
    const resp = await fetch(url, {
      headers: {
        "x-api-key": env.SUPADATA_API_KEY!,
      },
    });

    if (!resp.ok) {
      console.warn(`[YouTube] Supadata returned ${resp.status} for ${videoId}`);
      return null;
    }

    const data = (await resp.json()) as {
      content?: string;
      lang?: string;
    };

    if (!data.content) {
      console.warn(`[YouTube] Supadata returned empty content for ${videoId}`);
      return null;
    }

    const text = data.content.replace(/\s+/g, " ").trim();
    if (!text) return null;

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    console.log(`[YouTube] Supadata OK for ${videoId}: ${wordCount} words`);
    return { text, wordCount };
  } catch (error) {
    console.warn(
      `[YouTube] Supadata error for ${videoId}:`,
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
