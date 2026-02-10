"use client";

import { useCallback, useState } from "react";
import { Separator } from "~/components/ui/separator";
import { useViewPreference } from "~/hooks/use-view-preference";
import { api } from "~/trpc/react";
import { ContentFilters } from "./_components/content-filters";
import { ContentList } from "./_components/content-list";
import { ContentToolbar } from "./_components/content-toolbar";
import { SearchBar } from "./_components/search-bar";

export default function ContentPage() {
  const [filters, setFilters] = useState({
    search: "",
    searchMode: "metadata" as "metadata" | "keyword" | "fullContent",
    contentTypeIds: [] as number[],
    campaignIds: [] as string[],
    publishDateFrom: "",
    publishDateTo: "",
  });
  const [viewMode, setViewMode] = useViewPreference();
  const [totalItems, setTotalItems] = useState(0);
  const { data: myRole } = api.users.getMyRole.useQuery();
  const isAdmin = myRole?.role === "admin";

  const handleTotalChange = useCallback((total: number) => {
    setTotalItems(total);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-bold text-2xl">Content Inventory</h1>
        <p className="text-muted-foreground text-sm">
          Manage and search your published content
        </p>
      </div>

      <SearchBar
        onSearchChange={(value) => setFilters((f) => ({ ...f, search: value }))}
        onSearchModeChange={(mode) =>
          setFilters((f) => ({ ...f, searchMode: mode }))
        }
        search={filters.search}
        searchMode={filters.searchMode}
      />

      <ContentFilters filters={filters} onFiltersChange={setFilters} />

      <Separator />

      <ContentToolbar
        isAdmin={isAdmin}
        onViewModeChange={setViewMode}
        totalItems={totalItems}
        viewMode={viewMode}
      />

      <ContentList
        filters={filters}
        onTotalChange={handleTotalChange}
        viewMode={viewMode}
      />
    </div>
  );
}
