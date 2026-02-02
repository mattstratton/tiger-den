"use client";

import { useState } from "react";
import { ContentFilters } from "./_components/content-filters";
import { ContentTable } from "./_components/content-table";

export default function ContentPage() {
  const [filters, setFilters] = useState({
    search: "",
    contentTypes: [] as string[],
    campaignIds: [] as string[],
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Content Inventory</h1>
      </div>

      <ContentFilters filters={filters} onFiltersChange={setFilters} />
      <ContentTable filters={filters} />
    </div>
  );
}
