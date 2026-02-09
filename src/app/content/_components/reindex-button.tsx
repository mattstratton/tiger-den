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

  // Only show button for failed or pending items
  if (effectiveStatus !== "failed" && effectiveStatus !== "pending") {
    return null;
  }

  const handleReindex = () => {
    setIsReindexing(true);
    reindexMutation.mutate({ id: contentId });
  };

  return (
    <Button
      disabled={isReindexing}
      size="sm"
      variant="secondary"
      onClick={handleReindex}
    >
      {isReindexing ? "Reindexing..." : "Re-index"}
    </Button>
  );
}
