"use client";

import { Loading } from "~/components/ui/loading";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
        <Loading className="gap-1.5" compact message="Loading" />
      </span>
    );
  }

  if (!indexStatus) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600 text-xs">
        Not indexed
      </span>
    );
  }

  switch (indexStatus.indexStatus) {
    case "indexed":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-default rounded-full bg-green-100 px-2 py-1 text-green-700 text-xs"
            >
              Indexed
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {indexStatus.wordCount} words, {indexStatus.tokenCount} tokens
          </TooltipContent>
        </Tooltip>
      );
    case "pending":
      return (
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
          Pending
        </span>
      );
    case "failed":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-default rounded-full bg-red-100 px-2 py-1 text-red-700 text-xs"
            >
              Failed
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {indexStatus.indexError ?? "Unknown error"}
          </TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}
