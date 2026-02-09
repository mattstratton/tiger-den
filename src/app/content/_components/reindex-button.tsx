"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
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
      await utils.content.getIndexStatus.invalidate({ id: contentId });
      setIsReindexing(false);
      toast.success("Re-indexed successfully");
    },
    onError: (error) => {
      console.error("Reindex failed:", error);
      setIsReindexing(false);
      toast.error(`Reindex failed: ${error.message}`);
    },
  });

  // Determine effective status
  const effectiveStatus = indexStatus ?? fetchedStatus?.indexStatus ?? null;

  // Show nothing while we don't know status (e.g. still loading when indexStatus was null)
  if (effectiveStatus === null) {
    return null;
  }

  const handleReindex = () => {
    setIsReindexing(true);
    reindexMutation.mutate({ id: contentId });
  };

  const isIndexed = effectiveStatus === "indexed";
  const label = isIndexed ? "Refresh index" : "Re-index";
  const busyLabel = isReindexing ? "Reindexing..." : label;

  return (
    <Button
      disabled={isReindexing}
      size="sm"
      variant="secondary"
      onClick={handleReindex}
      title={
        isIndexed
          ? "Re-run indexing when the source content has changed"
          : undefined
      }
    >
      {busyLabel}
    </Button>
  );
}
