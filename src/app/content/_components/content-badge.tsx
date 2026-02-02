import { Badge } from "~/components/ui/badge";

const contentTypeLabels = {
  youtube_video: "YouTube Video",
  blog_post: "Blog Post",
  case_study: "Case Study",
  website_content: "Website Content",
  third_party: "Third Party",
  other: "Other",
} as const;

const contentTypeColors = {
  youtube_video: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  blog_post: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  case_study:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  website_content:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  third_party:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
} as const;

export function ContentTypeBadge({
  type,
}: {
  type: keyof typeof contentTypeLabels;
}) {
  return (
    <Badge className={contentTypeColors[type]} variant="secondary">
      {contentTypeLabels[type]}
    </Badge>
  );
}
