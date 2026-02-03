import { encoding_for_model } from "tiktoken";
import { indexingConfig } from "~/server/config/indexing-config";

export interface Chunk {
  text: string;
  index: number;
  tokenCount: number;
}

/**
 * Split text into chunks at paragraph boundaries
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Split text into sentences (simple period/question/exclamation split)
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Chunk content into 500-800 token pieces with 50-token overlap
 * Preserves paragraph and sentence boundaries where possible
 */
export async function chunkContent(
  plainText: string,
  maxTokens: number = indexingConfig.chunkMaxTokens,
): Promise<Chunk[]> {
  const encoding = encoding_for_model("text-embedding-3-small");
  const chunks: Chunk[] = [];

  try {
    // If text is small enough, return single chunk
    const totalTokens = encoding.encode(plainText).length;
    if (totalTokens <= maxTokens) {
      encoding.free();
      return [
        {
          text: plainText,
          index: 0,
          tokenCount: totalTokens,
        },
      ];
    }

    // Split into paragraphs
    const paragraphs = splitIntoParagraphs(plainText);
    let currentChunk = "";
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = encoding.encode(paragraph).length;

      // If adding this paragraph exceeds limit
      if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
        // Save current chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: currentTokens,
        });

        // Start new chunk with overlap
        // Take last ~50 tokens from current chunk
        const sentences = splitIntoSentences(currentChunk);
        const overlapSentences = sentences.slice(-2); // Last 2 sentences ≈ 50 tokens
        currentChunk = `${overlapSentences.join(". ")}. ${paragraph}`;
        currentTokens = encoding.encode(currentChunk).length;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Add final chunk if any content remains
    if (currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: currentTokens,
      });
    }

    encoding.free();
    return chunks;
  } catch (error) {
    encoding.free();
    throw error;
  }
}
