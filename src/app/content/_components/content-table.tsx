"use client";

import { format } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { ContentTypeBadge } from "./content-badge";
import { ContentFormDialog } from "./content-form-dialog";
import { ContentIndexStatus } from "./content-index-status";
import { DeleteContentDialog } from "./delete-content-dialog";
import { ReindexButton } from "./reindex-button";
import { MatchTypeBadge } from "./match-type-badge";
import { HighlightedSnippet } from "./highlighted-snippet";

interface ContentTableProps {
  filters: {
    search: string;
    searchMode: "metadata" | "keyword" | "fullContent";
    contentTypeIds: number[];
    campaignIds: string[];
    publishDateFrom: string;
    publishDateTo: string;
  };
}

export function ContentTable({ filters }: ContentTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deletingItem, setDeletingItem] = useState<
    { id: string; title: string } | undefined
  >();
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [
    filters.search,
    filters.contentTypeIds,
    filters.campaignIds,
    filters.publishDateFrom,
    filters.publishDateTo,
  ]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Determine which search mode to use
  const useHybridSearch =
    filters.searchMode === "fullContent" && debouncedSearch.length > 0;
  const useKeywordSearch =
    filters.searchMode === "keyword" && debouncedSearch.length > 0;
  const useAdvancedSearch = useHybridSearch || useKeywordSearch;

  const { data: listData, isLoading: listLoading } = api.content.list.useQuery(
    {
      search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      contentTypeIds:
        filters.contentTypeIds.length > 0 ? filters.contentTypeIds : undefined,
      campaignIds:
        filters.campaignIds.length > 0 ? filters.campaignIds : undefined,
      publishDateFrom:
        filters.publishDateFrom.length > 0 ? filters.publishDateFrom : undefined,
      publishDateTo:
        filters.publishDateTo.length > 0 ? filters.publishDateTo : undefined,
      limit: pageSize,
      offset: page * pageSize,
    },
    {
      enabled: !useAdvancedSearch,
    },
  );

  const {
    data: hybridSearchData,
    isLoading: hybridSearchLoading,
  } = api.content.hybridSearch.useQuery(
    {
      query: debouncedSearch,
      limit: pageSize,
    },
    {
      enabled: useHybridSearch,
    },
  );

  const {
    data: keywordSearchData,
    isLoading: keywordSearchLoading,
  } = api.content.keywordSearch.useQuery(
    {
      query: debouncedSearch,
      limit: pageSize,
    },
    {
      enabled: useKeywordSearch,
    },
  );

  const isLoading = useHybridSearch
    ? hybridSearchLoading
    : useKeywordSearch
      ? keywordSearchLoading
      : listLoading;

  const hasActiveFilters =
    (debouncedSearch?.length ?? 0) > 0 ||
    filters.contentTypeIds.length > 0 ||
    filters.campaignIds.length > 0 ||
    filters.publishDateFrom.length > 0 ||
    filters.publishDateTo.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              <TableHead>Index Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-28 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="ml-auto h-8 w-8 animate-pulse rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Normalize data structure for all modes
  type ItemWithSearch = NonNullable<typeof listData>["items"][number] & {
    relevanceScore?: number;
    matchedText?: string;
    matchType?: "keyword" | "semantic" | "both";
    matchedTerms?: string[];
  };

  const searchData = useHybridSearch
    ? hybridSearchData
    : useKeywordSearch
      ? keywordSearchData
      : null;

  const items: ItemWithSearch[] = useAdvancedSearch
    ? (() => {
        // Map search results to items
        const allItems =
          searchData
            ?.map((result) =>
              result.contentItem
                ? {
                    ...result.contentItem,
                    relevanceScore: result.relevanceScore,
                    matchedText: result.snippet,
                    matchType: result.matchType,
                    matchedTerms: result.matchedTerms,
                  }
                : null,
            )
            .filter((item): item is NonNullable<typeof item> => item !== null) ??
          [];

        // Deduplicate: keep highest scoring result per content item
        const itemMap = new Map<string, ItemWithSearch>();
        for (const item of allItems) {
          const existing = itemMap.get(item.id);
          if (
            !existing ||
            (item.relevanceScore ?? 0) > (existing.relevanceScore ?? 0)
          ) {
            itemMap.set(item.id, item);
          }
        }

        return Array.from(itemMap.values());
      })()
    : listData?.items ?? [];

  const hasItems = items.length > 0;

  if (!hasItems) {
    const emptyMessage = hasActiveFilters
      ? "No results for this search or filter. Clear filters above to see all content."
      : "No content items yet. Add your first content item to get started.";
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Author</TableHead>
              {useAdvancedSearch && <TableHead>Relevance</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
              <TableHead>Index Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                className="text-center text-muted-foreground"
                colSpan={useAdvancedSearch ? 8 : 7}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Author</TableHead>
              {useAdvancedSearch && <TableHead>Relevance</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
              <TableHead>Index Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-md">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Link
                        className="hover:underline"
                        href={`/content/${item.id}`}
                      >
                        {item.title}
                      </Link>
                      <a
                        className="text-muted-foreground hover:text-foreground"
                        href={item.currentUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                        title="Open external link"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                    {useAdvancedSearch && item.matchedText && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          {item.matchType && (
                            <MatchTypeBadge type={item.matchType} />
                          )}
                          {item.relevanceScore && (
                            <span className="text-muted-foreground text-xs">
                              {(item.relevanceScore * 100).toFixed(1)}% relevant
                            </span>
                          )}
                        </div>
                        <HighlightedSnippet
                          snippet={item.matchedText}
                          matchedTerms={item.matchedTerms || []}
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ContentTypeBadge type={item.contentTypeRel} />
                </TableCell>
                <TableCell>
                  {item.publishDate
                    ? format(new Date(item.publishDate), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.campaigns.map((cc) => (
                      <Badge key={cc.campaign.id} variant="outline">
                        {cc.campaign.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{item.author || "-"}</TableCell>
                {useAdvancedSearch && (
                  <TableCell>
                    <div className="text-sm">
                      {item.relevanceScore
                        ? `${(item.relevanceScore * 100).toFixed(1)}%`
                        : "-"}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setEditingId(item.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() =>
                        setDeletingItem({ id: item.id, title: item.title })
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ContentIndexStatus contentId={item.id} />
                    <ReindexButton contentId={item.id} indexStatus={null} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!useAdvancedSearch && listData && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            Showing {page * pageSize + 1} to{" "}
            {Math.min((page + 1) * pageSize, listData.total)} of{" "}
            {listData.total} items
          </div>
          <div className="flex gap-2">
            <Button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={!listData.hasMore}
              onClick={() => setPage((p) => p + 1)}
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {useAdvancedSearch && (
        <div className="mt-4 text-muted-foreground text-sm">
          Showing top {items.length} most relevant results
        </div>
      )}

      <ContentFormDialog
        contentId={editingId}
        onOpenChange={(open) => !open && setEditingId(undefined)}
        open={!!editingId}
      />

      {deletingItem && (
        <DeleteContentDialog
          contentId={deletingItem.id}
          contentTitle={deletingItem.title}
          onOpenChange={(open) => !open && setDeletingItem(undefined)}
          open={!!deletingItem}
        />
      )}
    </div>
  );
}
