import { ContentFilters } from "./_components/content-filters";
import { ContentTable } from "./_components/content-table";

export default function ContentPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Content Inventory</h1>
      </div>

      <ContentFilters />
      <ContentTable />
    </div>
  );
}
