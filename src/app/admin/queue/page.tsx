"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export default function QueueDashboardPage() {
  const [isPaused, setIsPaused] = useState(false);

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

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="font-bold text-3xl">Queue Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage the background indexing queue
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
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
          <div className="text-muted-foreground text-sm">Failed</div>
          <div className="font-bold text-2xl">{stats?.failed ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="text-muted-foreground text-sm">Pending</div>
          <div className="font-bold text-2xl">{stats?.pending ?? 0}</div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-4">
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
