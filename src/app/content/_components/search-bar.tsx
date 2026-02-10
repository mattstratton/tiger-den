"use client";

import { Search, Sparkles, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";

interface SearchBarProps {
  search: string;
  searchMode: "metadata" | "keyword" | "fullContent";
  onSearchChange: (value: string) => void;
  onSearchModeChange: (mode: "metadata" | "keyword" | "fullContent") => void;
}

export function SearchBar({
  search,
  searchMode,
  onSearchChange,
  onSearchModeChange,
}: SearchBarProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search content"
          className={cn(
            "h-11 pr-10 pl-10 text-base",
            searchMode === "fullContent" &&
              search.length > 0 &&
              "ring-2 ring-[var(--vivid-purple)]/40",
          )}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={
            searchMode === "fullContent"
              ? "Search full content with AI..."
              : searchMode === "keyword"
                ? "Search keywords (BM25)..."
                : "Search titles & metadata..."
          }
          type="search"
          value={search}
        />
        {search.length > 0 && (
          <button
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onSearchChange("")}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <ToggleGroup
        className="justify-start"
        onValueChange={(value) => {
          if (value) onSearchModeChange(value as typeof searchMode);
        }}
        type="single"
        value={searchMode}
      >
        <ToggleGroupItem
          className="text-xs"
          disabled={!search}
          value="metadata"
        >
          Titles/Metadata
        </ToggleGroupItem>
        <ToggleGroupItem className="text-xs" disabled={!search} value="keyword">
          Keywords (Free)
        </ToggleGroupItem>
        <ToggleGroupItem
          className={cn(
            "text-xs",
            searchMode === "fullContent" &&
              search.length > 0 &&
              "data-[state=on]:bg-[var(--vivid-purple)]/10 data-[state=on]:text-[var(--vivid-purple)]",
          )}
          disabled={!search}
          value="fullContent"
        >
          <Sparkles className="mr-1 h-3 w-3" />
          Full Content (AI)
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
