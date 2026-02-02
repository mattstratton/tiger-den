"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ContentFormDialog } from "./content-form-dialog";

export function ContentFilters() {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <Input
            type="search"
            placeholder="Search content..."
            className="max-w-sm"
          />
          <Button variant="outline">Filter</Button>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setShowAddDialog(true)}>
              Add Content
            </Button>
            <Button variant="outline">Import CSV</Button>
            <Button variant="outline">Export CSV</Button>
          </div>
        </div>
      </div>

      <ContentFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </>
  );
}
