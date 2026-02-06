/**
 * Test problem URL from database
 */

import { fetchContent } from "../src/server/services/content-fetcher";

async function test() {
  const url = "https://www.tigerdata.com/learn/postgresql-performance-tuning-optimizing-database-indexes";

  console.log(`Testing: ${url}\n`);

  const result = await fetchContent(url);

  console.log(`Word count: ${result.wordCount}`);
  console.log(`\nFirst 500 chars:`);
  console.log(result.plainText.substring(0, 500));
}

test().catch(console.error);
