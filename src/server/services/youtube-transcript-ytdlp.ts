import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface YouTubeTranscriptResult {
  text: string;
  wordCount: number;
}

/**
 * Parse VTT (WebVTT) format to extract plain text
 * Removes timestamps and formatting, returns clean text
 */
function parseVTT(vttContent: string): string {
  const lines = vttContent.split("\n");
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();

    // Skip empty lines, WEBVTT header, metadata lines
    if (!line || line === "WEBVTT" || line.startsWith("Kind:") || line.startsWith("Language:")) {
      continue;
    }

    // Skip timestamp lines (format: 00:00:00.000 --> 00:00:00.000)
    if (line.includes("-->")) {
      continue;
    }

    // Skip cue settings lines (align:start, position:0%, etc.)
    if (line.includes("align:") || line.includes("position:")) {
      continue;
    }

    // Extract text content, removing inline timestamps like <00:00:04.000>
    const cleanedLine = line
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "") // Remove <00:00:00.000> timestamps
      .replace(/<c>/g, "")                        // Remove <c> tags
      .replace(/<\/c>/g, "")                      // Remove </c> tags
      .trim();

    if (cleanedLine) {
      textLines.push(cleanedLine);
    }
  }

  // Join lines with spaces, collapse multiple spaces
  return textLines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Fetch YouTube transcript using yt-dlp
 * Supports both manual and auto-generated captions
 *
 * @param videoId YouTube video ID (11 characters)
 * @returns Transcript text and word count, or null if unavailable
 */
export async function fetchYouTubeTranscriptViaYtdlp(
  videoId: string
): Promise<YouTubeTranscriptResult | null> {
  const tmpDir = tmpdir();
  const outputTemplate = join(tmpDir, `yt-transcript-${videoId}`);
  const vttPath = `${outputTemplate}.en.vtt`;

  try {
    // Use yt-dlp to download English subtitles (auto-generated or manual)
    // --write-auto-sub: Download auto-generated subs if manual subs aren't available
    // --skip-download: Don't download the video
    // --sub-lang en: Prefer English
    // --sub-format vtt: Use WebVTT format (easy to parse)
    const command = `yt-dlp --write-auto-sub --skip-download --sub-lang en --sub-format vtt -o "${outputTemplate}" "https://www.youtube.com/watch?v=${videoId}"`;

    await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Read the VTT file
    const vttContent = await fs.readFile(vttPath, "utf-8");

    // Parse VTT to extract text
    const text = parseVTT(vttContent);

    // Count words
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Clean up temp file
    await fs.unlink(vttPath).catch(() => {
      // Ignore cleanup errors
    });

    return {
      text,
      wordCount,
    };
  } catch (error) {
    // Clean up temp file if it exists
    await fs.unlink(vttPath).catch(() => {
      // Ignore cleanup errors
    });

    // Check if error indicates no subtitles available
    if (
      error instanceof Error &&
      (error.message.includes("Subtitles are disabled") ||
        error.message.includes("No subtitles") ||
        error.message.includes("no subtitles"))
    ) {
      return null; // Subtitles not available
    }

    // Re-throw other errors
    throw error;
  }
}
