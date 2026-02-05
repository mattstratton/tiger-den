import { Badge } from "~/components/ui/badge";

// Map color names to Tailwind classes
const colorClassMap: Record<string, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

export function ContentTypeBadge({
  type,
}: {
  type: { name: string; color: string };
}) {
  const colorClass = colorClassMap[type.color] ?? colorClassMap.gray;

  return (
    <Badge className={colorClass} variant="secondary">
      {type.name}
    </Badge>
  );
}
