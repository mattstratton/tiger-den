"use client";

import { X } from "lucide-react";
import { useState } from "react";
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

interface ContentFiltersProps {
  filters: {
    search: string;
    contentTypes: string[];
    campaignIds: string[];
  };
  onFiltersChange: (filters: {
    search: string;
    contentTypes: string[];
    campaignIds: string[];
  }) => void;
}

const CONTENT_TYPES = [
  { value: "youtube_video", label: "YouTube Video" },
  { value: "blog_post", label: "Blog Post" },
  { value: "case_study", label: "Case Study" },
  { value: "website_content", label: "Website Content" },
  { value: "third_party", label: "Third Party" },
  { value: "other", label: "Other" },
] as const;

export function ContentFilters({ filters, onFiltersChange }: ContentFiltersProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { data: campaigns } = api.campaigns.list.useQuery();

  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.contentTypes.length > 0 ||
    filters.campaignIds.length > 0;

  const handleClearFilters = () => {
    onFiltersChange({
      search: "",
      contentTypes: [],
      campaignIds: [],
    });
  };

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <Input
            type="search"
            placeholder="Search content..."
            className="max-w-sm"
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
          />

          <Select
            value={filters.contentTypes[0] ?? "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                contentTypes: value === "all" ? [] : [value],
              })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Content Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CONTENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.campaignIds[0] ?? "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                campaignIds: value === "all" ? [] : [value],
              })
            }
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

          {hasActiveFilters && (
            <Button variant="ghost" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}

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
