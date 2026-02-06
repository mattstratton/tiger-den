import axios from "axios";
import * as cheerio from "cheerio";

async function findNavLinks() {
  const url = "https://www.tigerdata.com/learn/how-to-choose-an-olap-database";
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Find all links and look for patterns
  const allLinks: string[] = [];
  $("a").each((i, elem) => {
    const text = $(elem).text().trim();
    if (text) {
      allLinks.push(text);
    }
  });

  console.log("Total links:", allLinks.length);
  console.log("\nFirst 30 links:");
  allLinks.slice(0, 30).forEach((link, i) => {
    console.log(`${i + 1}. "${link}"`);
  });

  // Check if we can find the navigation pattern
  const navPattern = [
    "Home",
    "AWS Time-Series Database",
    "Stationary Time-Series Analysis",
  ];

  console.log("\n=== Checking for navigation pattern ===");
  navPattern.forEach((pattern) => {
    const found = allLinks.some((link) => link.includes(pattern));
    console.log(`"${pattern}": ${found ? "FOUND" : "NOT FOUND"}`);
  });

  process.exit(0);
}

findNavLinks();
