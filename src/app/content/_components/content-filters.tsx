"use client";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function ContentFilters() {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex gap-4">
        <Input
          className="max-w-sm"
          placeholder="Search content..."
          type="search"
        />
        <Button variant="outline">Filter</Button>
        <div className="ml-auto flex gap-2">
          <Button>Add Content</Button>
          <Button variant="outline">Import CSV</Button>
          <Button variant="outline">Export CSV</Button>
        </div>
      </div>
    </div>
  );
}
