import { format, isValid, parse } from "date-fns";

/**
 * Parse a date string in various common formats and return YYYY-MM-DD format.
 * Tries multiple formats in priority order until one succeeds.
 *
 * @param dateString - Input date string in any supported format
 * @returns Normalized YYYY-MM-DD string, or null if unparseable
 *
 * Supported formats:
 * - YYYY-MM-DD (2024-02-15)
 * - MM/DD/YYYY (02/15/2024)
 * - M/D/YYYY (2/5/2024)
 * - MMMM D, YYYY (February 15, 2024)
 * - MMM D, YYYY (Feb 15, 2024)
 * - MMMM D. YYYY (January 20. 2026)
 * - MMM D. YYYY (Jan 20. 2026)
 * - D MMMM YYYY (15 February 2024)
 * - MM-DD-YYYY (02-15-2024)
 * - M-D-YYYY (2-5-2024)
 */
export function parseFlexibleDate(dateString: string): string | null {
  // Handle empty/null input
  if (!dateString || dateString.trim() === "") {
    return null;
  }

  const trimmed = dateString.trim();

  // Handle ISO 8601 datetime (e.g., "2024-02-15T10:30:00Z" from YouTube/meta tags)
  // Strip time component before running through format loop
  const normalized = trimmed.includes("T")
    ? (trimmed.split("T")[0] ?? trimmed)
    : trimmed;

  // Format strings in priority order
  // Most common formats first for performance
  const formats = [
    "yyyy-MM-dd", // 2024-02-15 (current format)
    "MM/dd/yyyy", // 02/15/2024 (US format)
    "M/d/yyyy", // 2/5/2024 (US short)
    "MMMM d, yyyy", // February 15, 2024
    "MMM d, yyyy", // Feb 15, 2024
    "MMMM d. yyyy", // January 20. 2026
    "MMM d. yyyy", // Jan 20. 2026
    "d MMMM yyyy", // 15 February 2024 (international)
    "MM-dd-yyyy", // 02-15-2024 (dashes)
    "M-d-yyyy", // 2-5-2024 (short dashes)
  ];

  // Try each format until one succeeds
  for (const formatString of formats) {
    try {
      const parsed = parse(normalized, formatString, new Date());

      // Check if the parsed date is valid
      if (isValid(parsed)) {
        // Return in YYYY-MM-DD format
        return format(parsed, "yyyy-MM-dd");
      }
    } catch {}
  }

  // No format matched
  return null;
}
