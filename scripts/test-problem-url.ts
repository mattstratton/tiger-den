/**
 * Test problematic URL
 */

import { fetchContent } from "../src/server/services/content-fetcher";

async function test() {
  const url = "https://www.timescale.com/learn/how-to-fix-transaction-id-wraparound/";

  console.log(`Testing: ${url}\n`);

  const result = await fetchContent(url);

  console.log(`Word count: ${result.wordCount}`);
  console.log(`\nFirst 600 chars:`);
  console.log(result.plainText.substring(0, 600));
}

test().catch(console.error);
