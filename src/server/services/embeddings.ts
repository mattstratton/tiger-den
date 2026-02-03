import OpenAI from "openai";
import { env } from "~/env";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for text using OpenAI text-embedding-3-small
 * Returns 1536-dimensional vector
 *
 * @param text Text to generate embedding for
 * @returns Embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });

  const embedding = response.data[0]?.embedding;

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  return embedding;
}
