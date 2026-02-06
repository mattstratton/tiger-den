import axios from "axios";
import * as cheerio from "cheerio";

async function findRelatedSection() {
  const url = "https://www.tigerdata.com/learn/how-to-choose-an-olap-database";
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Find containers that have many time-series related links
  console.log("=== Looking for containers with multiple TS links ===\n");

  $("div, section, aside, nav").each((i, elem) => {
    const links = $(elem).find("a");
    const linkTexts: string[] = [];

    links.each((j, link) => {
      linkTexts.push($(link).text().trim());
    });

    // Check if this container has our navigation pattern
    const hasHome = linkTexts.some((t) => t === "Home");
    const hasAwsTS = linkTexts.some((t) => t.includes("AWS Time-Series"));
    const hasStationary = linkTexts.some((t) => t.includes("Stationary"));

    if (hasHome && hasAwsTS && hasStationary) {
      const tag = $(elem).prop("tagName");
      const classes = $(elem).attr("class") || "none";
      const id = $(elem).attr("id") || "none";

      console.log(`\n=== FOUND CONTAINER ===`);
      console.log(`Tag: <${tag}>`);
      console.log(`Classes: ${classes}`);
      console.log(`ID: ${id}`);
      console.log(`Number of links: ${links.length}`);
      console.log(`\nFirst 10 link texts:`);
      linkTexts.slice(0, 10).forEach((text, i) => {
        console.log(`  ${i + 1}. ${text.substring(0, 60)}`);
      });
    }
  });

  process.exit(0);
}

findRelatedSection();
