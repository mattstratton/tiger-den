"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { ContentFormDialog } from "./content-form-dialog";
import { ImportCsvDialog } from "./import-csv-dialog";

interface ContentFiltersProps {
  filters: {
    search: string;
    searchMode: "metadata" | "keyword" | "fullContent";
    contentTypeIds: number[];
    campaignIds: string[];
    publishDateFrom: string;
    publishDateTo: string;
  };
  onFiltersChange: (filters: {
    search: string;
    searchMode: "metadata" | "keyword" | "fullContent";
    contentTypeIds: number[];
    campaignIds: string[];
    publishDateFrom: string;
    publishDateTo: string;
  }) => void;
}

export function ContentFilters({
  filters,
  onFiltersChange,
}: ContentFiltersProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const { data: campaigns } = api.campaigns.list.useQuery();
  const { data: contentTypes } = api.contentTypes.list.useQuery();
  const utils = api.useUtils();

  const deleteAllMutation = api.content.deleteAll.useMutation({
    onSuccess: () => {
      void utils.content.list.invalidate();
      setShowDeleteAllDialog(false);
    },
    onError: (error) => {
      console.error("Failed to delete all content:", error);
    },
  });

  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.contentTypeIds.length > 0 ||
    filters.campaignIds.length > 0 ||
    filters.publishDateFrom.length > 0 ||
    filters.publishDateTo.length > 0;

  const handleClearFilters = () => {
    onFiltersChange({
      search: "",
      searchMode: "metadata",
      contentTypeIds: [],
      campaignIds: [],
      publishDateFrom: "",
      publishDateTo: "",
    });
  };

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <Input
              aria-label="Search content by title, description, or URL"
              className="max-w-sm"
              onChange={(e) =>
                onFiltersChange({ ...filters, search: e.target.value })
              }
              placeholder={
                filters.searchMode === "fullContent"
                  ? "Search full content (AI)..."
                  : filters.searchMode === "keyword"
                    ? "Search keywords (BM25)..."
                    : "Search titles & metadata..."
              }
              type="search"
              value={filters.search}
            />
            {filters.search && (
              <div className="flex gap-2">
                <button
                  className={`rounded px-2 py-1 text-xs ${
                    filters.searchMode === "metadata"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={() =>
                    onFiltersChange({ ...filters, searchMode: "metadata" })
                  }
                  type="button"
                >
                  Titles/Metadata
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs ${
                    filters.searchMode === "keyword"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={() =>
                    onFiltersChange({ ...filters, searchMode: "keyword" })
                  }
                  title="BM25 keyword search - no AI cost"
                  type="button"
                >
                  Keywords (Free)
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs ${
                    filters.searchMode === "fullContent"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={() =>
                    onFiltersChange({ ...filters, searchMode: "fullContent" })
                  }
                  title="Hybrid search with AI embeddings - uses OpenAI"
                  type="button"
                >
                  Full Content (AI)
                </button>
              </div>
            )}
          </div>

          <Select
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                contentTypeIds: value === "all" ? [] : [parseInt(value, 10)],
              })
            }
            value={filters.contentTypeIds[0]?.toString() ?? "all"}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Content Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {contentTypes?.map((type) => (
                <SelectItem key={type.id} value={type.id.toString()}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                campaignIds: value === "all" ? [] : [value],
              })
            }
            value={filters.campaignIds[0] ?? "all"}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns?.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              aria-label="Publish date from"
              className="w-[140px]"
              onChange={(e) =>
                onFiltersChange({ ...filters, publishDateFrom: e.target.value })
              }
              placeholder="From (YYYY-MM-DD)"
              type="date"
              value={filters.publishDateFrom}
            />
            <Input
              aria-label="Publish date to"
              className="w-[140px]"
              onChange={(e) =>
                onFiltersChange({ ...filters, publishDateTo: e.target.value })
              }
              placeholder="To (YYYY-MM-DD)"
              type="date"
              value={filters.publishDateTo}
            />
          </div>

          {hasActiveFilters && (
            <Button
              aria-label="Clear all filters"
              onClick={handleClearFilters}
              variant="ghost"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}

          <div className="ml-auto flex gap-2">
            <Button onClick={() => setShowAddDialog(true)}>Add Content</Button>
            <Button onClick={() => setShowImportDialog(true)} variant="outline">
              Import CSV
            </Button>
            <span className="flex items-center gap-2">
              <Button disabled variant="outline">
                Export CSV
              </Button>
              <span className="text-muted-foreground text-xs">
                Coming soon
              </span>
            </span>
            <Button
              className="ml-2"
              onClick={() => setShowDeleteAllDialog(true)}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All
            </Button>
          </div>
        </div>
      </div>

      <ContentFormDialog onOpenChange={setShowAddDialog} open={showAddDialog} />

      <ImportCsvDialog
        onOpenChange={setShowImportDialog}
        open={showImportDialog}
      />

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>all content items</strong> from the database.
              <br />
              <br />
              This is a testing feature. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAllMutation.mutate()}
            >
              Delete All Content
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
