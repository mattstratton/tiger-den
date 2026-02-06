/**
 * Smart snippet extraction for search results
 * Finds where search terms appear and extracts surrounding context
 */

export interface SnippetResult {
  snippet: string;
  matchedTerms: string[];
}

/**
 * Extract a smart snippet showing where search terms appear
 * Centers the first match with surrounding context
 */
export function extractSmartSnippet(
  chunkText: string,
  searchQuery: string,
  maxLength: number = 200,
): SnippetResult {
  // 1. Parse search query into individual terms
  const queryTerms = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2); // Ignore short words like "a", "an", "the"

  // 2. Find first occurrence of any search term
  let firstMatchPos = -1;
  const matchedTerms: string[] = [];

  for (const term of queryTerms) {
    const pos = chunkText.toLowerCase().indexOf(term);
    if (pos !== -1) {
      if (firstMatchPos === -1 || pos < firstMatchPos) {
        firstMatchPos = pos;
      }
      matchedTerms.push(term);
    }
  }

  // 3. If no match found, fallback to start of text (e.g., semantic matches)
  if (firstMatchPos === -1) {
    return {
      snippet: chunkText.substring(0, maxLength),
      matchedTerms: [],
    };
  }

  // 4. Extract context around first match (centering the match)
  // Show ~60 chars before and ~140 chars after
  const start = Math.max(0, firstMatchPos - 60);
  const end = Math.min(chunkText.length, start + maxLength);
  let snippet = chunkText.substring(start, end);

  // 5. Add ellipsis if truncated
  if (start > 0) snippet = "..." + snippet;
  if (end < chunkText.length) snippet = snippet + "...";

  return { snippet, matchedTerms };
}
