"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { PageHeader } from "~/components/page-header";
import { SubmitTranscriptDialog } from "~/app/content/_components/submit-transcript-dialog";
import { api } from "~/trpc/react";

export default function TranscriptsQueuePage() {
  const { data: items, isLoading } = api.content.youtubeNeedingTranscripts.useQuery();

  const count = items?.length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader
          description="YouTube videos that need manual transcript upload"
          title="Transcript Queue"
        />
        {count > 0 && (
          <Badge variant="secondary" className="ml-2">
            {count}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : count === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            All YouTube videos have transcripts. Nothing to do!
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-[180px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/content/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                      <a
                        href={item.currentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-muted-foreground text-xs hover:underline"
                      >
                        {item.currentUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.indexStatus === "failed" ? "destructive" : "outline"}
                    >
                      {item.indexStatus ?? "not indexed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.indexError && (
                      <p className="max-w-xs truncate text-muted-foreground text-xs" title={item.indexError}>
                        {item.indexError}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <SubmitTranscriptDialog
                      contentId={item.id}
                      contentUrl={item.currentUrl}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
