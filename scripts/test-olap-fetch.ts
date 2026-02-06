import { fetchContent } from "../src/server/services/content-fetcher";

async function testFetch() {
  const url = "https://www.tigerdata.com/learn/how-to-choose-an-olap-database";

  console.log("Fetching:", url);
  console.log("=".repeat(70));

  try {
    const result = await fetchContent(url);

    console.log("\nFetch successful!");
    console.log("Word count:", result.wordCount);
    console.log("Token count:", result.tokenCount);
    console.log("\nFirst 1000 characters of plain text:");
    console.log("=".repeat(70));
    console.log(result.plainText.substring(0, 1000));
    console.log("=".repeat(70));

    // Check if navigation text is present
    if (result.plainText.includes("HomeAWS Time-Series Database")) {
      console.log("\n❌ PROBLEM: Navigation text is still present!");
    } else {
      console.log("\n✅ Navigation text successfully removed");
    }
  } catch (error) {
    console.error("Fetch failed:", error);
  }

  process.exit(0);
}

testFetch();
