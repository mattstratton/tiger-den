"use client";

import { format } from "date-fns";
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ContentTypeBadge } from "./content-badge";
import { ContentIndexStatus } from "./content-index-status";
import { HighlightedSnippet } from "./highlighted-snippet";
import { MatchTypeBadge } from "./match-type-badge";

interface ContentCardGridProps {
  items: Array<{
    id: string;
    title: string;
    currentUrl: string;
    description: string | null;
    author: string | null;
    publishDate: string | null;
    lastModifiedAt: Date | null;
    contentTypeRel: { name: string; color: string };
    campaigns: Array<{ campaign: { id: string; name: string } }>;
    relevanceScore?: number;
    matchedText?: string;
    matchType?: "keyword" | "semantic" | "both";
    matchedTerms?: string[];
  }>;
  showRelevance: boolean;
  onEdit: (id: string) => void;
  onDelete: (item: { id: string; title: string }) => void;
}

export function ContentCardGrid({
  items,
  showRelevance,
  onEdit,
  onDelete,
}: ContentCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card
          className="group relative transition-shadow hover:shadow-md"
          key={item.id}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ContentTypeBadge type={item.contentTypeRel} />
                <ContentIndexStatus contentId={item.id} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Actions for ${item.title}`}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(item.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete({ id: item.id, title: item.title })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Link
              className="font-semibold text-sm leading-tight hover:underline"
              href={`/content/${item.id}`}
            >
              {item.title}
            </Link>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {item.description && !showRelevance && (
              <p className="line-clamp-2 text-muted-foreground text-sm">
                {item.description}
              </p>
            )}

            {showRelevance && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {item.relevanceScore != null && (
                    <span className="font-mono text-[var(--vivid-purple)] text-xs">
                      {(item.relevanceScore * 100).toFixed(1)}%
                    </span>
                  )}
                  {item.matchType && <MatchTypeBadge type={item.matchType} />}
                </div>
                {item.matchedText && (
                  <HighlightedSnippet
                    matchedTerms={item.matchedTerms ?? []}
                    snippet={item.matchedText}
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              {(item.lastModifiedAt ?? item.publishDate) && (
                <span>
                  {format(
                    new Date(
                      (item.lastModifiedAt ?? item.publishDate) as
                        | Date
                        | string,
                    ),
                    "MMM d, yyyy",
                  )}
                </span>
              )}
              {item.author && <span>{item.author}</span>}
              <a
                className="ml-auto hover:text-foreground"
                href={item.currentUrl}
                rel="noopener noreferrer"
                target="_blank"
                title="Open external link"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {item.campaigns.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.campaigns.map((cc) => (
                  <Badge
                    className="text-xs"
                    key={cc.campaign.id}
                    variant="outline"
                  >
                    {cc.campaign.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
