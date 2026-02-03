"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface ReindexButtonProps {
  contentId: string;
  indexStatus: "pending" | "failed" | "indexed" | null;
}

export function ReindexButton({
  contentId,
  indexStatus,
}: ReindexButtonProps) {
  const [isReindexing, setIsReindexing] = useState(false);
  const utils = api.useUtils();

  const reindexMutation = api.content.reindexContent.useMutation({
    onSuccess: async () => {
      // Refetch index status
      await utils.content.getIndexStatus.invalidate({ id: contentId });
      setIsReindexing(false);
    },
    onError: (error) => {
      console.error("Reindex failed:", error);
      setIsReindexing(false);
      alert(`Reindex failed: ${error.message}`);
    },
  });

  // Only show button for failed or pending items
  if (indexStatus !== "failed" && indexStatus !== "pending") {
    return null;
  }

  const handleReindex = () => {
    setIsReindexing(true);
    reindexMutation.mutate({ id: contentId });
  };

  return (
    <button
      onClick={handleReindex}
      disabled={isReindexing}
      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {isReindexing ? "Reindexing..." : "Re-index"}
    </button>
  );
}
