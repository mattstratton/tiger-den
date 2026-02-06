/**
 * Displays a text snippet with search terms highlighted
 */

interface HighlightedSnippetProps {
  snippet: string;
  matchedTerms: string[];
}

export function HighlightedSnippet({
  snippet,
  matchedTerms,
}: HighlightedSnippetProps) {
  // If no matched terms, just show plain text
  if (!matchedTerms || matchedTerms.length === 0) {
    return (
      <div className="text-muted-foreground leading-relaxed text-sm">
        {snippet}
      </div>
    );
  }

  // Create regex to match all terms (case-insensitive)
  // Escape special regex characters in terms
  const escapedTerms = matchedTerms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  // Split text by matched terms
  const parts = snippet.split(pattern);

  return (
    <div className="text-muted-foreground leading-relaxed text-sm">
      {parts.map((part, i) => {
        // Check if this part matches any search term
        const isMatch = matchedTerms.some(
          (term) => part.toLowerCase() === term.toLowerCase(),
        );

        return isMatch ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 font-semibold dark:bg-yellow-800"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </div>
  );
}
