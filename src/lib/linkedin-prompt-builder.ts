import { LINKEDIN_SKILL_INSTRUCTIONS } from "./linkedin-prompt-template";

export interface VoiceProfile {
  displayName: string;
  title: string | null;
  company: string | null;
  voiceNotes: string;
  antiPatterns: string[] | null;
  topics: string[] | null;
  writingSamples: {
    label: string;
    content: string;
  }[];
}

export interface SuggestedLink {
  title: string;
  url: string;
  contentType: string;
  description: string | null;
}

export interface PromptBuilderInput {
  /** The blog post / content text to convert */
  contentText: string | null;
  /** Title of the content */
  contentTitle: string;
  /** URL of the content (for fallback when text unavailable) */
  contentUrl?: string;
  /** Description of the content (for fallback) */
  contentDescription?: string;
  /** Voice profile for the poster */
  author: VoiceProfile;
  /** CTA type label */
  ctaType: string;
  /** CTA URL */
  ctaUrl: string;
  /** Target audience override */
  audience?: string;
  /** Word count target */
  wordCount?: number;
  /** Specific angle or emphasis */
  angle?: string;
  /** Related content from search */
  suggestedLinks: SuggestedLink[];
}

export function buildLinkedInPrompt(input: PromptBuilderInput): string {
  const {
    contentText,
    contentTitle,
    contentUrl,
    contentDescription,
    author,
    ctaType,
    ctaUrl,
    audience,
    wordCount = 1000,
    angle,
    suggestedLinks,
  } = input;

  const sections: string[] = [];

  // 1. Instructions
  sections.push(LINKEDIN_SKILL_INSTRUCTIONS);

  // 2. Author voice profile
  const authorSection = [
    `## Author Voice Profile`,
    ``,
    `Name: ${author.displayName}`,
    author.title
      ? `Title: ${author.title}${author.company ? ` at ${author.company}` : ""}`
      : null,
    ``,
    `Voice and style notes:`,
    author.voiceNotes,
  ].filter(Boolean);

  if (author.antiPatterns && author.antiPatterns.length > 0) {
    authorSection.push(
      ``,
      `Anti-patterns (never use these in any output):`,
      ...author.antiPatterns.map((p) => `- ${p}`),
    );
  }

  sections.push(authorSection.join("\n"));

  // 3. Writing samples
  if (author.writingSamples.length > 0) {
    const samplesSection = [`## Writing Samples`, ``];
    author.writingSamples.forEach((sample, i) => {
      samplesSection.push(
        `### Sample ${i + 1}: ${sample.label}`,
        sample.content,
        ``,
      );
    });
    sections.push(samplesSection.join("\n"));
  }

  // 4. Blog post content
  if (contentText) {
    sections.push(
      [`## Blog Post to Convert`, ``, contentText].join("\n"),
    );
  } else {
    // Fallback for unindexed content
    const fallback = [
      `## Blog Post to Convert`,
      ``,
      `Title: ${contentTitle}`,
    ];
    if (contentDescription) {
      fallback.push(`Description: ${contentDescription}`);
    }
    if (contentUrl) {
      fallback.push(`URL: ${contentUrl}`);
    }
    fallback.push(
      ``,
      `NOTE: The full blog post text could not be retrieved automatically. Please paste the full content of the blog post below this line before submitting this prompt to Claude.`,
      ``,
      `[PASTE BLOG POST CONTENT HERE]`,
    );
    sections.push(fallback.join("\n"));
  }

  // 5. Target details
  const targetSection = [
    `## Target Details`,
    ``,
    `- Poster: ${author.displayName}`,
    `- Audience: ${audience || "infer from content"}`,
    `- CTA: ${ctaType} - ${ctaUrl}`,
    `- Word count: ${wordCount}`,
  ];
  if (angle) {
    targetSection.push(`- Specific angle: ${angle}`);
  }
  sections.push(targetSection.join("\n"));

  // 6. Suggested links
  if (suggestedLinks.length > 0) {
    const linksSection = [
      `## Suggested Links for Social Post and Comments`,
      ``,
      `These are related content from our library. Pick the most relevant for CTA links in the social post:`,
    ];
    suggestedLinks.forEach((link, i) => {
      linksSection.push(`${i + 1}. ${link.title} (${link.contentType}) - ${link.url}`);
      if (link.description) {
        linksSection.push(`   ${link.description}`);
      }
    });
    sections.push(linksSection.join("\n"));
  }

  // 7. Final instruction
  sections.push(
    `---\n\nProduce all four outputs in order: LinkedIn SEO title, LinkedIn SEO description, article body (${wordCount - 100}-${wordCount + 100} words), social post with hashtags.`,
  );

  return sections.join("\n\n");
}
