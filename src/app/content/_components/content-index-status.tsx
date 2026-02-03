"use client";

import { api } from "~/trpc/react";

interface ContentIndexStatusProps {
  contentId: string;
}

export function ContentIndexStatus({ contentId }: ContentIndexStatusProps) {
  const { data: indexStatus, isLoading } = api.content.getIndexStatus.useQuery(
    { id: contentId },
    { refetchInterval: false },
  );

  if (isLoading) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        Loading...
      </span>
    );
  }

  if (!indexStatus) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        Not indexed
      </span>
    );
  }

  switch (indexStatus.indexStatus) {
    case "indexed":
      return (
        <span
          className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
          title={`Indexed ${indexStatus.wordCount} words, ${indexStatus.tokenCount} tokens`}
        >
          ✓ Indexed
        </span>
      );
    case "pending":
      return (
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
          ⏳ Pending
        </span>
      );
    case "failed":
      return (
        <span
          className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700"
          title={indexStatus.indexError ?? "Unknown error"}
        >
          ✗ Failed
        </span>
      );
    default:
      return null;
  }
}
