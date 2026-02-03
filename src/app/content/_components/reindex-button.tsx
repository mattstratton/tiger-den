"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface ReindexButtonProps {
  contentId: string;
  indexStatus: "pending" | "failed" | "indexed" | null;
}

export function ReindexButton({ contentId, indexStatus }: ReindexButtonProps) {
  const [isReindexing, setIsReindexing] = useState(false);
  const utils = api.useUtils();

  // Fetch index status if not provided
  const { data: fetchedStatus } = api.content.getIndexStatus.useQuery(
    { id: contentId },
    {
      enabled: indexStatus === null,
      refetchInterval: false,
    },
  );

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

  // Determine effective status
  const effectiveStatus = indexStatus ?? fetchedStatus?.indexStatus ?? null;

  // Only show button for failed or pending items
  if (effectiveStatus !== "failed" && effectiveStatus !== "pending") {
    return null;
  }

  const handleReindex = () => {
    setIsReindexing(true);
    reindexMutation.mutate({ id: contentId });
  };

  return (
    <button
      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      disabled={isReindexing}
      onClick={handleReindex}
    >
      {isReindexing ? "Reindexing..." : "Re-index"}
    </button>
  );
}
