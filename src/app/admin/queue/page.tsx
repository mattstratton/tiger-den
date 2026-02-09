"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { api } from "~/trpc/react";

export default function QueueDashboardPage() {
  const [isPaused, setIsPaused] = useState(false);
  const [reindexResult, setReindexResult] = useState<{
    message: string;
    errors?: string[];
  } | null>(null);
  const [enqueueDialogOpen, setEnqueueDialogOpen] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [reindexDialogOpen, setReindexDialogOpen] = useState(false);

  // Query queue stats with auto-refresh every 5 seconds
  const { data: stats, refetch } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Mutations
  const pauseMutation = api.queue.pause.useMutation({
    onSuccess: () => {
      setIsPaused(true);
      toast.success("Worker paused");
    },
    onError: (error) => {
      toast.error(`Failed to pause worker: ${error.message}`);
    },
  });

  const resumeMutation = api.queue.resume.useMutation({
    onSuccess: () => {
      setIsPaused(false);
      toast.success("Worker resumed (requires server restart if fully stopped)");
    },
    onError: (error) => {
      toast.error(`Failed to resume worker: ${error.message}`);
    },
  });

  const enqueuePendingMutation = api.queue.enqueuePending.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setEnqueueDialogOpen(false);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to enqueue pending items: ${error.message}`);
    },
  });

  const retryFailedMutation = api.queue.retryFailed.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setRetryDialogOpen(false);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to retry failed jobs: ${error.message}`);
    },
  });

  const reindexAllMutation = api.queue.reindexAll.useMutation({
    onSuccess: (data) => {
      setReindexResult({
        message: data.message,
        errors: data.errors && data.errors.length > 0 ? data.errors : undefined,
      });
      setReindexDialogOpen(false);
      void refetch();
    },
    onError: (error) => {
      setReindexResult({
        message: `Failed: ${error.message}`,
      });
      setReindexDialogOpen(false);
      toast.error(`Re-index failed: ${error.message}`);
    },
  });

  const handleEnqueuePending = () => {
    setEnqueueDialogOpen(true);
  };

  const handleRetryFailed = () => {
    setRetryDialogOpen(true);
  };

  const handleReindexAll = () => {
    setReindexResult(null);
    setReindexDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="font-bold text-3xl">Queue Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage the background indexing queue
        </p>
      </div>

      {/* Indexing Stats */}
      <div className="mb-4">
        <h2 className="mb-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">Content Indexing</h2>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Indexed</div>
          <div className="font-bold text-2xl text-green-600">{stats?.indexed ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Not Indexed</div>
          <div className="font-bold text-2xl text-orange-600">{stats?.notIndexed ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Failed Indexing</div>
          <div className="font-bold text-2xl text-red-600">{stats?.failedIndexing ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Pending</div>
          <div className="font-bold text-2xl">{stats?.pending ?? 0}</div>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="mb-4">
        <h2 className="mb-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">Queue Status</h2>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Queued</div>
          <div className="font-bold text-2xl">{stats?.queued ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Processing</div>
          <div className="font-bold text-2xl">{stats?.processing ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Completed</div>
          <div className="font-bold text-2xl">{stats?.completed ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Failed Jobs</div>
          <div className="font-bold text-2xl">{stats?.failed ?? 0}</div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-4">
        {/* Re-index Section */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 font-semibold text-lg">Bulk Re-index</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Index all content items that haven&apos;t been indexed yet or had failed indexing.
            Items with API content (Ghost/Contentful) are chunked and embedded directly.
            External URLs are fetched via web scraping as a fallback.
          </p>
          <Button
            disabled={
              reindexAllMutation.isPending ||
              ((stats?.notIndexed ?? 0) === 0 && (stats?.failedIndexing ?? 0) === 0)
            }
            onClick={handleReindexAll}
          >
            {reindexAllMutation.isPending
              ? "Re-indexing..."
              : `Re-index All (${(stats?.notIndexed ?? 0) + (stats?.failedIndexing ?? 0)} items)`}
          </Button>

          {reindexResult && (
            <div className="mt-4 rounded-md border p-4">
              <p className="font-medium">{reindexResult.message}</p>
              {reindexResult.errors && reindexResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    {reindexResult.errors.length} error(s)
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                    {reindexResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold text-lg">Worker Controls</h2>
          <div className="flex gap-4">
            <Button
              disabled={isPaused || pauseMutation.isPending}
              onClick={() => pauseMutation.mutate()}
            >
              {pauseMutation.isPending ? "Pausing..." : "Pause Worker"}
            </Button>
            <Button
              disabled={!isPaused || resumeMutation.isPending}
              onClick={() => resumeMutation.mutate()}
              variant="secondary"
            >
              {resumeMutation.isPending ? "Resuming..." : "Resume Worker"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold text-lg">Queue Management</h2>
          <div className="flex gap-4">
            <Button
              disabled={
                !stats?.pending ||
                stats.pending === 0 ||
                enqueuePendingMutation.isPending
              }
              onClick={handleEnqueuePending}
            >
              {enqueuePendingMutation.isPending
                ? "Enqueueing..."
                : `Enqueue All Pending Items (${stats?.pending ?? 0})`}
            </Button>
            <Button
              disabled={
                !stats?.failed ||
                stats.failed === 0 ||
                retryFailedMutation.isPending
              }
              onClick={handleRetryFailed}
              variant="secondary"
            >
              {retryFailedMutation.isPending
                ? "Retrying..."
                : `Retry Failed Jobs (${stats?.failed ?? 0})`}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation dialogs */}
      <AlertDialog onOpenChange={setEnqueueDialogOpen} open={enqueueDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enqueue pending items?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to enqueue {stats?.pending ?? 0} pending
              items? They will be processed by the worker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => enqueuePendingMutation.mutate()}
              disabled={enqueuePendingMutation.isPending}
            >
              {enqueuePendingMutation.isPending ? "Enqueueing..." : "Enqueue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setRetryDialogOpen} open={retryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry failed jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retry {stats?.failed ?? 0} failed jobs?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => retryFailedMutation.mutate()}
              disabled={retryFailedMutation.isPending}
            >
              {retryFailedMutation.isPending ? "Retrying..." : "Retry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setReindexDialogOpen} open={reindexDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-index all?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-index {(stats?.notIndexed ?? 0) + (stats?.failedIndexing ?? 0)}{" "}
              content items ({(stats?.notIndexed ?? 0)} not indexed,{" "}
              {stats?.failedIndexing ?? 0} failed). This will fetch and index
              content from URLs and may take a while.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reindexAllMutation.mutate()}
              disabled={reindexAllMutation.isPending}
            >
              {reindexAllMutation.isPending ? "Re-indexing..." : "Re-index All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-refresh indicator */}
      <div className="text-muted-foreground mt-8 text-center text-sm">
        Stats auto-refresh every 5 seconds
      </div>
    </div>
  );
}
