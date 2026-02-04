import * as cheerio from "cheerio";

/**
 * Fetches a webpage and extracts the title from the HTML <title> tag.
 *
 * @param url - The URL to fetch
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns The page title string, or null if fetch fails or no title found
 */
export async function fetchPageTitle(
  url: string,
  timeoutMs = 5000,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Fetch the URL with timeout
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TigerDen-MetadataBot/1.0",
      },
    });

    // Check if response is OK
    if (!response.ok) {
      return null;
    }

    // Check if content is HTML
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) {
      return null;
    }

    // Parse HTML and extract title
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $("title").text().trim();

    // Return title or null if empty
    return title || null;
  } catch (_error) {
    // Timeout, network error, parsing error, etc.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
