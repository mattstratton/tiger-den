import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface LoadingProps {
  /** Optional context, e.g. "campaigns" → "Loading campaigns" */
  message?: string;
  className?: string;
  /** Compact style for inline use (e.g. badges) */
  compact?: boolean;
}

export function Loading({
  message = "Loading",
  className,
  compact = false,
}: LoadingProps) {
  const Wrapper = compact ? "span" : "div";
  return (
    <Wrapper
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        compact ? "gap-1.5" : "justify-center py-8",
        className,
      )}
    >
      <Loader2
        className={cn("animate-spin text-muted-foreground", compact ? "h-3 w-3" : "h-5 w-5")}
        aria-hidden
      />
      <span className={compact ? "text-xs" : "text-sm"}>{message}</span>
    </Wrapper>
  );
}
