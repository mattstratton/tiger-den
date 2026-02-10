import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accentColor?: "teal" | "orange" | "purple" | "yellow" | "red";
  className?: string;
}

const accentStyles: Record<string, string> = {
  teal: "border-l-4 border-l-[var(--pure-teal)]",
  orange: "border-l-4 border-l-[var(--tiger-blood)]",
  purple: "border-l-4 border-l-[var(--vivid-purple)]",
  yellow: "border-l-4 border-l-[var(--electric-yellow)]",
  red: "border-l-4 border-l-red-500",
};

const iconStyles: Record<string, string> = {
  teal: "text-[var(--pure-teal)]",
  orange: "text-[var(--tiger-blood)]",
  purple: "text-[var(--vivid-purple)]",
  yellow: "text-[var(--electric-yellow)]",
  red: "text-red-500",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accentColor,
  className,
}: StatCardProps) {
  return (
    <Card className={cn(accentColor && accentStyles[accentColor], className)}>
      <CardContent className="flex items-center gap-3 py-4">
        {Icon && (
          <Icon
            className={cn(
              "h-5 w-5 text-muted-foreground",
              accentColor && iconStyles[accentColor],
            )}
          />
        )}
        <div>
          <div className="font-bold text-2xl tabular-nums">{value}</div>
          <div className="text-muted-foreground text-sm">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
