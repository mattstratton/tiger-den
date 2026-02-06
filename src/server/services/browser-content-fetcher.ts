import { chromium, type Browser } from "playwright";
import * as cheerio from "cheerio";
import { encoding_for_model } from "tiktoken";
import { indexingConfig } from "~/server/config/indexing-config";
import type { FetchResult } from "./content-fetcher";
import { ContentFetchError } from "./content-fetcher";

// Singleton browser instance
let browserInstance: Browser | null = null;

/**
 * Get or create browser instance (reused across requests)
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserInstance;
}

/**
 * Close browser instance (cleanup)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Count tokens using tiktoken (OpenAI compatible)
 */
async function countTokens(text: string): Promise<number> {
  try {
    const encoding = encoding_for_model("text-embedding-3-small");
    const tokens = encoding.encode(text);
    encoding.free();
    return tokens.length;
  } catch (error) {
    console.error("Token counting failed:", error);
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count words (simple whitespace split)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Fetch and extract content using headless browser
 * Waits for JavaScript to render, then extracts content
 */
export async function fetchWebContentWithBrowser(
  url: string,
): Promise<FetchResult> {
  const startTime = Date.now();
  let context = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; TigerDen/1.0; +https://tigerdata.com)",
    });

    const page = await context.newPage();

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: indexingConfig.timeoutPerUrl * 2, // Give JS more time
    });

    // Wait a bit for any delayed rendering
    await page.waitForTimeout(1000);

    // Get rendered HTML
    const html = await page.content();

    // Use cheerio to clean and extract (same as static approach)
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script, style, nav, footer, aside").remove();

    // Remove by class patterns
    $(
      [
        '[class*="header"]',
        '[class*="navbar"]',
        '[class*="nav-"]',
        '[class*="navigation"]',
        '[class*="menu"]',
        '[class*="sidebar"]',
        '[class*="footer"]',
        '[class*="breadcrumb"]',
        '[id*="header"]',
        '[id*="nav"]',
        '[id*="menu"]',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]',
        ".advertisement",
        ".ad",
        '[class*="cookie"]',
        '[class*="consent"]',
      ].join(", "),
    ).remove();

    $("header").remove();

    // Extract main content with priority order
    let mainContent = "";
    const articleSelectors = [
      "main article",
      "article",
      'main [role="main"]',
      "main .content",
      "main .post-content",
      "main .article-content",
      ".markdown-body",
      "main",
    ];

    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        mainContent = element.text();
        if (mainContent.trim().length > 100) {
          break;
        }
      }
    }

    // Fallback to body
    if (!mainContent || mainContent.trim().length < 100) {
      mainContent = $("body").text();
    }

    // Clean whitespace
    const plainText = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .replace(/^\s+|\s+$/gm, "")
      .trim();

    // Validate content
    if (plainText.length < 50) {
      throw new ContentFetchError(
        "Insufficient content extracted (less than 50 characters)",
        url,
      );
    }

    const fullText = $.html();
    const wordCount = countWords(plainText);
    const tokenCount = await countTokens(plainText);
    const duration = Date.now() - startTime;

    await context.close();

    return {
      plainText,
      fullText,
      wordCount,
      tokenCount,
      duration,
      finalUrl: url, // Browser doesn't follow redirects the same way
      wasRedirected: false,
    };
  } catch (error) {
    if (context) {
      await context.close().catch(() => {
        /* ignore */
      });
    }

    const duration = Date.now() - startTime;

    if (error instanceof Error && error.message.includes("Timeout")) {
      throw new ContentFetchError(`Browser timeout after ${duration}ms`, url, error);
    }

    throw new ContentFetchError(
      error instanceof Error ? error.message : "Browser extraction failed",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}
