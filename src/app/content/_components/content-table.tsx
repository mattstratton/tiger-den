"use client";

import { format } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { ContentTypeBadge } from "./content-badge";
import { ContentFormDialog } from "./content-form-dialog";
import { ContentIndexStatus } from "./content-index-status";
import { DeleteContentDialog } from "./delete-content-dialog";
import { ReindexButton } from "./reindex-button";

interface ContentTableProps {
  filters: {
    search: string;
    contentTypes: string[];
    campaignIds: string[];
  };
}

export function ContentTable({ filters }: ContentTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deletingItem, setDeletingItem] = useState<
    { id: string; title: string } | undefined
  >();
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // Reset page to 0 when filters change
  useEffect(() => {
    setPage(0);
  }, []);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const { data, isLoading } = api.content.list.useQuery({
    search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
    contentTypes:
      filters.contentTypes.length > 0
        ? (filters.contentTypes as (
            | "youtube_video"
            | "blog_post"
            | "case_study"
            | "website_content"
            | "third_party"
            | "other"
          )[])
        : undefined,
    campaignIds:
      filters.campaignIds.length > 0 ? filters.campaignIds : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  if (isLoading) {
    return <div className="py-8 text-center">Loading...</div>;
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              <TableHead>Index Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                className="text-center text-muted-foreground"
                colSpan={7}
              >
                No content items yet. Add your first content item to get
                started.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Publish Date</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              <TableHead>Index Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <a
                    className="flex items-center gap-2 hover:underline"
                    href={item.currentUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell>
                  <ContentTypeBadge type={item.contentType} />
                </TableCell>
                <TableCell>
                  {item.publishDate
                    ? format(new Date(item.publishDate), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.campaigns.map((cc) => (
                      <Badge key={cc.campaign.id} variant="outline">
                        {cc.campaign.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{item.author || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setEditingId(item.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() =>
                        setDeletingItem({ id: item.id, title: item.title })
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ContentIndexStatus contentId={item.id} />
                    <ReindexButton contentId={item.id} indexStatus={null} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Showing {page * pageSize + 1} to{" "}
          {Math.min((page + 1) * pageSize, data.total)} of {data.total} items
        </div>
        <div className="flex gap-2">
          <Button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={!data.hasMore}
            onClick={() => setPage((p) => p + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <ContentFormDialog
        contentId={editingId}
        onOpenChange={(open) => !open && setEditingId(undefined)}
        open={!!editingId}
      />

      {deletingItem && (
        <DeleteContentDialog
          contentId={deletingItem.id}
          contentTitle={deletingItem.title}
          onOpenChange={(open) => !open && setDeletingItem(undefined)}
          open={!!deletingItem}
        />
      )}
    </div>
  );
}
