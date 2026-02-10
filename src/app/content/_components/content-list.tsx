"use client";

import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Loading } from "~/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { ContentCardGrid } from "./content-card-grid";
import { ContentEnhancedTable } from "./content-enhanced-table";
import { ContentFormDialog } from "./content-form-dialog";
import { DeleteContentDialog } from "./delete-content-dialog";

interface ContentListProps {
  filters: {
    search: string;
    searchMode: "metadata" | "keyword" | "fullContent";
    contentTypeIds: number[];
    campaignIds: string[];
    tags: string[];
    publishDateFrom: string;
    publishDateTo: string;
  };
  viewMode: "grid" | "table";
  onTotalChange?: (total: number) => void;
}

type SortColumn = "title" | "date" | "type" | "author" | "createdAt";
type SortOrder = "asc" | "desc";

const SORT_LABELS: Record<SortColumn, string> = {
  title: "Title",
  date: "Date",
  type: "Type",
  author: "Author",
  createdAt: "Date Added",
};

export function ContentList({
  filters,
  viewMode,
  onTotalChange,
}: ContentListProps) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deletingItem, setDeletingItem] = useState<
    { id: string; title: string } | undefined
  >();
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [sortBy, setSortBy] = useState<SortColumn>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const utils = api.useUtils();
  const reindexMutation = api.content.reindexContent.useMutation({
    onSuccess: () => {
      void utils.content.getIndexStatus.invalidate();
    },
  });

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(column === "title" ? "asc" : "desc");
    }
    setPage(0);
  };

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [
    filters.search,
    filters.contentTypeIds,
    filters.campaignIds,
    filters.tags,
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
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      publishDateFrom:
        filters.publishDateFrom.length > 0
          ? filters.publishDateFrom
          : undefined,
      publishDateTo:
        filters.publishDateTo.length > 0 ? filters.publishDateTo : undefined,
      sortBy,
      sortOrder,
      limit: pageSize,
      offset: page * pageSize,
    },
    { enabled: !useAdvancedSearch },
  );

  const { data: hybridSearchData, isLoading: hybridSearchLoading } =
    api.content.hybridSearch.useQuery(
      { query: debouncedSearch, limit: pageSize },
      { enabled: useHybridSearch },
    );

  const { data: keywordSearchData, isLoading: keywordSearchLoading } =
    api.content.keywordSearch.useQuery(
      { query: debouncedSearch, limit: pageSize },
      { enabled: useKeywordSearch },
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
    filters.tags.length > 0 ||
    filters.publishDateFrom.length > 0 ||
    filters.publishDateTo.length > 0;

  // Normalize data
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
            .filter(
              (item): item is NonNullable<typeof item> => item !== null,
            ) ?? [];

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
    : (listData?.items ?? []);

  const totalItems = useAdvancedSearch ? items.length : (listData?.total ?? 0);

  // Report total to parent
  useEffect(() => {
    onTotalChange?.(totalItems);
  }, [totalItems, onTotalChange]);

  if (isLoading) {
    return viewMode === "grid" ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="space-y-3 rounded-lg border p-4" key={i}>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    ) : (
      <div className="flex items-center justify-center py-12">
        <Loading message="Loading content..." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        message={
          hasActiveFilters
            ? "No results for this search or filter. Try adjusting your criteria."
            : "No content items yet. Add your first content item to get started."
        }
      />
    );
  }

  const totalPages = useAdvancedSearch
    ? 1
    : Math.ceil((listData?.total ?? 0) / pageSize);

  return (
    <div className="space-y-4">
      {viewMode === "grid" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Sort by</span>
            <Select
              onValueChange={(v) => {
                setSortBy(v as SortColumn);
                setPage(0);
              }}
              value={sortBy}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-8 w-8"
              onClick={() =>
                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              size="icon"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
              variant="ghost"
            >
              {sortOrder === "asc" ? (
                <ArrowUpAZ className="h-4 w-4" />
              ) : (
                <ArrowDownAZ className="h-4 w-4" />
              )}
            </Button>
          </div>
          <ContentCardGrid
            items={items}
            onDelete={(item) => setDeletingItem(item)}
            onEdit={(id) => setEditingId(id)}
            showRelevance={useAdvancedSearch}
          />
        </div>
      ) : (
        <ContentEnhancedTable
          items={items}
          onDelete={(item) => setDeletingItem(item)}
          onEdit={(id) => setEditingId(id)}
          onReindex={(id) => reindexMutation.mutate({ id })}
          onSort={handleSort}
          showRelevance={useAdvancedSearch}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      )}

      {/* Pagination */}
      {!useAdvancedSearch && listData && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-muted-foreground text-sm">
            Showing {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, listData.total)} of{" "}
            {listData.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              size="icon"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum =
                totalPages <= 5
                  ? i
                  : page <= 2
                    ? i
                    : page >= totalPages - 3
                      ? totalPages - 5 + i
                      : page - 2 + i;
              return (
                <Button
                  className="h-8 w-8"
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  size="icon"
                  variant={page === pageNum ? "default" : "outline"}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button
              disabled={!listData.hasMore}
              onClick={() => setPage((p) => p + 1)}
              size="icon"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {useAdvancedSearch && (
        <div className="text-muted-foreground text-sm">
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
