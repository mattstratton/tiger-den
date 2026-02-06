/**
 * Badge showing how a search result matched (keyword, semantic, or both)
 */

interface MatchTypeBadgeProps {
  type: "keyword" | "semantic" | "both";
}

export function MatchTypeBadge({ type }: MatchTypeBadgeProps) {
  const config = {
    keyword: {
      label: "Keyword",
      icon: "🔤",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    semantic: {
      label: "Semantic",
      icon: "🧠",
      className:
        "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    },
    both: {
      label: "Both",
      icon: "🔍",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
  };

  const { label, icon, className } = config[type];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
