"use client";

import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ContentTypeBadge } from "./content-badge";
import { ContentIndexStatus } from "./content-index-status";
import { HighlightedSnippet } from "./highlighted-snippet";
import { MatchTypeBadge } from "./match-type-badge";
import { ReindexButton } from "./reindex-button";

type SortColumn = "title" | "date" | "type" | "author" | "createdAt";
type SortOrder = "asc" | "desc";

interface ContentEnhancedTableProps {
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
  sortBy?: SortColumn;
  sortOrder?: SortOrder;
  onSort?: (column: SortColumn) => void;
  onEdit: (id: string) => void;
  onDelete: (item: { id: string; title: string }) => void;
  onReindex?: (id: string) => void;
}

export function ContentEnhancedTable({
  items,
  showRelevance,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  onReindex,
}: ContentEnhancedTableProps) {
  function SortableHeader({
    column,
    children,
    className,
  }: {
    column: SortColumn;
    children: React.ReactNode;
    className?: string;
  }) {
    const isActive = sortBy === column;
    const Icon = isActive
      ? sortOrder === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;

    return (
      <TableHead className={`sticky top-0 ${className ?? ""}`}>
        <button
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => onSort?.(column)}
          type="button"
        >
          {children}
          <Icon
            className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`}
          />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table aria-label="Content inventory" className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHeader className="w-[30%]" column="title">
              Title
            </SortableHeader>
            <SortableHeader className="w-[10%]" column="type">
              Type
            </SortableHeader>
            <SortableHeader className="w-[10%]" column="date">
              Date
            </SortableHeader>
            <TableHead className="sticky top-0 w-[12%]">Campaigns</TableHead>
            <SortableHeader className="w-[14%]" column="author">
              Author
            </SortableHeader>
            {showRelevance && (
              <TableHead className="sticky top-0 w-[8%]">Relevance</TableHead>
            )}
            <TableHead className="sticky top-0 w-[8%]">Index</TableHead>
            <TableHead className="sticky top-0 w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow className="group" key={item.id}>
              <TableCell className="whitespace-normal py-3">
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-start gap-2">
                    <Link
                      className="break-words font-medium hover:underline"
                      href={`/content/${item.id}`}
                    >
                      {item.title}
                    </Link>
                    <a
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      href={item.currentUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      title="Open external link"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <span className="truncate text-muted-foreground text-xs">
                    {item.currentUrl}
                  </span>
                  {showRelevance && item.matchedText && (
                    <div className="mt-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {item.matchType && (
                          <MatchTypeBadge type={item.matchType} />
                        )}
                      </div>
                      <HighlightedSnippet
                        matchedTerms={item.matchedTerms ?? []}
                        snippet={item.matchedText}
                      />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="overflow-hidden">
                <ContentTypeBadge type={item.contentTypeRel} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {item.lastModifiedAt
                  ? format(new Date(item.lastModifiedAt), "MMM d, yyyy")
                  : item.publishDate
                    ? format(new Date(item.publishDate), "MMM d, yyyy")
                    : "-"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {item.campaigns.map((cc) => (
                    <Badge
                      className="whitespace-normal text-xs"
                      key={cc.campaign.id}
                      variant="outline"
                    >
                      {cc.campaign.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="truncate text-sm">
                {item.author || "-"}
              </TableCell>
              {showRelevance && (
                <TableCell>
                  <span className="text-sm">
                    {item.relevanceScore
                      ? `${(item.relevanceScore * 100).toFixed(1)}%`
                      : "-"}
                  </span>
                </TableCell>
              )}
              <TableCell>
                <ContentIndexStatus contentId={item.id} />
              </TableCell>
              <TableCell>
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
                    <DropdownMenuItem onClick={() => onReindex?.(item.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh index
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        onDelete({ id: item.id, title: item.title })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
