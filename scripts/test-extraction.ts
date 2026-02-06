/**
 * Test content extraction to debug why navigation text persists
 */

import * as cheerio from "cheerio";

async function testExtraction() {
  const url = "https://www.timescale.com/blog/when-boring-is-awesome";

  console.log(`Fetching: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TigerDen/1.0; +https://tigerdata.com)",
    },
  });

  const html = await response.text();
  console.log(`HTML length: ${html.length} characters\n`);

  const $ = cheerio.load(html);

  // Check what's in the page before removal
  const scriptCount = $("script").length;
  const headerCount = $("header").length;
  const navCount = $("nav").length;

  console.log(`Before removal:`);
  console.log(`- Script tags: ${scriptCount}`);
  console.log(`- Header tags: ${headerCount}`);
  console.log(`- Nav tags: ${navCount}\n`);

  // Remove scripts and other elements (Part 1)
  $("script, style, nav, footer, aside").remove();

  // Remove by class patterns (Part 2)
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

  // Remove header tags
  $("header").remove();

  console.log(`After ALL removals:`);
  console.log(`- Script tags: ${$("script").length}`);
  console.log(`- Header tags: ${$("header").length}`);
  console.log(`- Nav tags: ${$("nav").length}\n`);

  // Try different extraction methods
  console.log("=== Extraction Tests ===\n");

  const mainText = $("main").text();
  console.log(`main.text() - First 300 chars:`);
  console.log(mainText.substring(0, 300));
  console.log(`\n---\n`);

  const articleText = $("article").text();
  console.log(`article.text() - First 300 chars:`);
  console.log(articleText.substring(0, 300));
  console.log(`\n---\n`);

  const bodyText = $("body").text();
  console.log(`body.text() - First 300 chars:`);
  console.log(bodyText.substring(0, 300));
}

testExtraction().catch(console.error);
