import axios from "axios";
import * as cheerio from "cheerio";

async function inspectHTML() {
  const url = "https://www.tigerdata.com/learn/how-to-choose-an-olap-database";
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Find elements containing "HomeAWS"
  const homeElement = $("*:contains('HomeAWS')").filter(function () {
    return $(this).children().length === 0; // Leaf nodes only
  });

  console.log("Found", homeElement.length, "elements containing 'HomeAWS'");

  if (homeElement.length > 0) {
    const first = homeElement.first();
    console.log("\n=== Element Info ===");
    console.log("Tag:", first.prop("tagName"));
    console.log("Classes:", first.attr("class"));
    console.log("ID:", first.attr("id"));
    console.log("Text:", first.text().substring(0, 200));

    // Get parent structure
    console.log("\n=== Parent Chain ===");
    let parent = first.parent();
    for (let i = 0; i < 5 && parent.length > 0; i++) {
      console.log(
        `Level ${i + 1}: <${parent.prop("tagName")}> class="${parent.attr("class") || "none"}" id="${parent.attr("id") || "none"}"`
      );
      parent = parent.parent();
    }
  }

  // Also check if there's a nav element
  console.log("\n=== Nav Elements ===");
  $("nav").each((i, elem) => {
    const navText = $(elem).text();
    console.log(`Nav ${i + 1}:`, navText.substring(0, 100));
  });

  process.exit(0);
}

inspectHTML();
