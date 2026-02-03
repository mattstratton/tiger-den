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
 */
async function countTokens(text: string): Promise<number> {
  // TODO: Implement in next task
  return 0;
}

/**
 * Count words (simple whitespace split)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
