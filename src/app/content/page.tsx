"use client";

import { useState } from "react";
import { ContentFilters } from "./_components/content-filters";
import { ContentTable } from "./_components/content-table";

export default function ContentPage() {
  const [filters, setFilters] = useState({
    search: "",
    searchMode: "metadata" as "metadata" | "keyword" | "fullContent",
    contentTypeIds: [] as number[],
    campaignIds: [] as string[],
    publishDateFrom: "",
    publishDateTo: "",
  });

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-bold text-3xl">Content Inventory</h1>
      </div>

      <ContentFilters filters={filters} onFiltersChange={setFilters} />
      <ContentTable filters={filters} />
    </div>
  );
}
