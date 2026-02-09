import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface EmptyStateProps {
  /** Icon to show (default: Inbox) */
  icon?: LucideIcon;
  /** Short message, e.g. "No campaigns yet." */
  message: string;
  /** Optional primary CTA */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 text-center",
        className,
      )}
    >
      <Icon className="h-12 w-12 text-muted-foreground/60" aria-hidden />
      <p className="text-muted-foreground text-sm max-w-sm">{message}</p>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
