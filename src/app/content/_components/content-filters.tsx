"use client";

import { X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

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
  const { data: campaigns } = api.campaigns.list.useQuery();
  const { data: contentTypes } = api.contentTypes.list.useQuery();

  const hasActiveFilters =
    filters.contentTypeIds.length > 0 ||
    filters.campaignIds.length > 0 ||
    filters.publishDateFrom.length > 0 ||
    filters.publishDateTo.length > 0;

  const handleClearFilters = () => {
    onFiltersChange({
      ...filters,
      contentTypeIds: [],
      campaignIds: [],
      publishDateFrom: "",
      publishDateTo: "",
    });
  };

  const activeContentType = contentTypes?.find(
    (t) => t.id === filters.contentTypeIds[0],
  );
  const activeCampaign = campaigns?.find(
    (c) => c.id === filters.campaignIds[0],
  );

  return (
    <div className="space-y-3">
      {/* Filter controls */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              contentTypeIds: value === "all" ? [] : [parseInt(value, 10)],
            })
          }
          value={filters.contentTypeIds[0]?.toString() ?? "all"}
        >
          <SelectTrigger className="w-[160px]">
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
          <SelectTrigger className="w-[160px]">
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

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground text-xs" htmlFor="date-from">
              From
            </Label>
            <Input
              aria-label="Publish date from"
              className="w-[140px]"
              id="date-from"
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  publishDateFrom: e.target.value,
                })
              }
              type="date"
              value={filters.publishDateFrom}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground text-xs" htmlFor="date-to">
              To
            </Label>
            <Input
              aria-label="Publish date to"
              className="w-[140px]"
              id="date-to"
              onChange={(e) =>
                onFiltersChange({ ...filters, publishDateTo: e.target.value })
              }
              type="date"
              value={filters.publishDateTo}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            aria-label="Clear all filters"
            className="h-9"
            onClick={handleClearFilters}
            size="sm"
            variant="ghost"
          >
            <X className="mr-1 h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {activeContentType && (
            <Badge
              className="cursor-pointer gap-1"
              onClick={() =>
                onFiltersChange({ ...filters, contentTypeIds: [] })
              }
              variant="secondary"
            >
              Type: {activeContentType.name}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {activeCampaign && (
            <Badge
              className="cursor-pointer gap-1"
              onClick={() => onFiltersChange({ ...filters, campaignIds: [] })}
              variant="secondary"
            >
              Campaign: {activeCampaign.name}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.publishDateFrom && (
            <Badge
              className="cursor-pointer gap-1"
              onClick={() =>
                onFiltersChange({ ...filters, publishDateFrom: "" })
              }
              variant="secondary"
            >
              From: {filters.publishDateFrom}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.publishDateTo && (
            <Badge
              className="cursor-pointer gap-1"
              onClick={() =>
                onFiltersChange({ ...filters, publishDateTo: "" })
              }
              variant="secondary"
            >
              To: {filters.publishDateTo}
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
