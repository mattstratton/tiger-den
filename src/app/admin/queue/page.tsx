"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export default function QueueDashboardPage() {
  const [isPaused, setIsPaused] = useState(false);
  const [reindexResult, setReindexResult] = useState<{
    message: string;
    errors?: string[];
  } | null>(null);

  // Query queue stats with auto-refresh every 5 seconds
  const { data: stats, refetch } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Mutations
  const pauseMutation = api.queue.pause.useMutation({
    onSuccess: () => {
      setIsPaused(true);
      alert("Worker paused");
    },
    onError: (error) => {
      alert(`Failed to pause worker: ${error.message}`);
    },
  });

  const resumeMutation = api.queue.resume.useMutation({
    onSuccess: () => {
      setIsPaused(false);
      alert("Worker resumed (requires server restart if fully stopped)");
    },
    onError: (error) => {
      alert(`Failed to resume worker: ${error.message}`);
    },
  });

  const enqueuePendingMutation = api.queue.enqueuePending.useMutation({
    onSuccess: (data) => {
      alert(data.message);
      void refetch();
    },
    onError: (error) => {
      alert(`Failed to enqueue pending items: ${error.message}`);
    },
  });

  const retryFailedMutation = api.queue.retryFailed.useMutation({
    onSuccess: (data) => {
      alert(data.message);
      void refetch();
    },
    onError: (error) => {
      alert(`Failed to retry failed jobs: ${error.message}`);
    },
  });

  const reindexAllMutation = api.queue.reindexAll.useMutation({
    onSuccess: (data) => {
      setReindexResult({
        message: data.message,
        errors: data.errors && data.errors.length > 0 ? data.errors : undefined,
      });
      void refetch();
    },
    onError: (error) => {
      setReindexResult({
        message: `Failed: ${error.message}`,
      });
    },
  });

  const handleEnqueuePending = () => {
    if (
      confirm(
        `Are you sure you want to enqueue ${stats?.pending ?? 0} pending items?`,
      )
    ) {
      enqueuePendingMutation.mutate();
    }
  };

  const handleRetryFailed = () => {
    if (
      confirm(
        `Are you sure you want to retry ${stats?.failed ?? 0} failed jobs?`,
      )
    ) {
      retryFailedMutation.mutate();
    }
  };

  const handleReindexAll = () => {
    const notIndexed = stats?.notIndexed ?? 0;
    const failedIndexing = stats?.failedIndexing ?? 0;
    const total = notIndexed + failedIndexing;
    if (
      confirm(
        `Re-index ${total} content items (${notIndexed} not indexed, ${failedIndexing} failed)?\n\nThis will fetch and index content from URLs, which may take a while.`,
      )
    ) {
      setReindexResult(null);
      reindexAllMutation.mutate();
    }
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
          <button
            onClick={handleReindexAll}
            disabled={
              reindexAllMutation.isPending ||
              ((stats?.notIndexed ?? 0) === 0 && (stats?.failedIndexing ?? 0) === 0)
            }
            className="rounded-md border bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reindexAllMutation.isPending
              ? "Re-indexing..."
              : `Re-index All (${(stats?.notIndexed ?? 0) + (stats?.failedIndexing ?? 0)} items)`}
          </button>

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
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={isPaused || pauseMutation.isPending}
              className="rounded-md border bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pauseMutation.isPending ? "Pausing..." : "Pause Worker"}
            </button>
            <button
              onClick={() => resumeMutation.mutate()}
              disabled={!isPaused || resumeMutation.isPending}
              className="rounded-md border bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resumeMutation.isPending ? "Resuming..." : "Resume Worker"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold text-lg">Queue Management</h2>
          <div className="flex gap-4">
            <button
              onClick={handleEnqueuePending}
              disabled={
                !stats?.pending ||
                stats.pending === 0 ||
                enqueuePendingMutation.isPending
              }
              className="rounded-md border bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enqueuePendingMutation.isPending
                ? "Enqueueing..."
                : `Enqueue All Pending Items (${stats?.pending ?? 0})`}
            </button>
            <button
              onClick={handleRetryFailed}
              disabled={
                !stats?.failed ||
                stats.failed === 0 ||
                retryFailedMutation.isPending
              }
              className="rounded-md border bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retryFailedMutation.isPending
                ? "Retrying..."
                : `Retry Failed Jobs (${stats?.failed ?? 0})`}
            </button>
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-muted-foreground mt-8 text-center text-sm">
        Stats auto-refresh every 5 seconds
      </div>
    </div>
  );
}
