"use client";

import { format } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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

export function ContentTable() {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [editingId, setEditingId] = useState<string | undefined>();

  const { data, isLoading } = api.content.list.useQuery({
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
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                className="text-center text-muted-foreground"
                colSpan={6}
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
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(item.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
        open={!!editingId}
        onOpenChange={(open) => !open && setEditingId(undefined)}
        contentId={editingId}
      />
    </div>
  );
}
