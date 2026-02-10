"use client";

import { CheckCircle, CircleDashed, Clock, TriangleAlert, XCircle } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PageHeader } from "~/components/page-header";
import { StatCard } from "~/components/stat-card";
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

  const { data: stats, refetch } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 5000,
  });

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
      setReindexResult({ message: `Failed: ${error.message}` });
      setReindexDialogOpen(false);
      toast.error(`Re-index failed: ${error.message}`);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        description="Monitor and manage the background indexing queue"
        title="Queue Dashboard"
      />

      {/* Content Indexing Stats */}
      <div>
        <h2 className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Content Indexing
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            accentColor="teal"
            icon={CheckCircle}
            label="Indexed"
            value={stats?.indexed ?? 0}
          />
          <StatCard
            accentColor="orange"
            icon={CircleDashed}
            label="Not Indexed"
            value={stats?.notIndexed ?? 0}
          />
          <StatCard
            accentColor="red"
            icon={XCircle}
            label="Failed"
            value={stats?.failedIndexing ?? 0}
          />
          <StatCard
            accentColor="yellow"
            icon={Clock}
            label="Pending"
            value={stats?.pending ?? 0}
          />
        </div>
      </div>

      {/* Queue Stats */}
      <div>
        <h2 className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Queue Status
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Queued" value={stats?.queued ?? 0} />
          <StatCard label="Processing" value={stats?.processing ?? 0} />
          <StatCard label="Completed" value={stats?.completed ?? 0} />
          <StatCard label="Failed Jobs" value={stats?.failed ?? 0} />
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bulk Re-index</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Index all content items that haven&apos;t been indexed yet or had
              failed indexing. API content is chunked directly; external URLs are
              fetched via scraping.
            </p>
            <Button
              disabled={
                reindexAllMutation.isPending ||
                ((stats?.notIndexed ?? 0) === 0 &&
                  (stats?.failedIndexing ?? 0) === 0)
              }
              onClick={() => {
                setReindexResult(null);
                setReindexDialogOpen(true);
              }}
            >
              {reindexAllMutation.isPending
                ? "Re-indexing..."
                : `Re-index All (${(stats?.notIndexed ?? 0) + (stats?.failedIndexing ?? 0)} items)`}
            </Button>
            {reindexResult && (
              <div className="rounded-md border p-4">
                <p className="font-medium">{reindexResult.message}</p>
                {reindexResult.errors && reindexResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground text-sm">
                      {reindexResult.errors.length} error(s)
                    </summary>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground text-sm">
                      {reindexResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Worker Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
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
            <div className="flex gap-3">
              <Button
                disabled={
                  !stats?.pending ||
                  stats.pending === 0 ||
                  enqueuePendingMutation.isPending
                }
                onClick={() => setEnqueueDialogOpen(true)}
                variant="outline"
              >
                {enqueuePendingMutation.isPending
                  ? "Enqueueing..."
                  : `Enqueue Pending (${stats?.pending ?? 0})`}
              </Button>
              <Button
                disabled={
                  !stats?.failed ||
                  stats.failed === 0 ||
                  retryFailedMutation.isPending
                }
                onClick={() => setRetryDialogOpen(true)}
                variant="outline"
              >
                {retryFailedMutation.isPending
                  ? "Retrying..."
                  : `Retry Failed (${stats?.failed ?? 0})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-muted-foreground text-xs">
        Stats auto-refresh every 5 seconds
      </p>

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
              disabled={enqueuePendingMutation.isPending}
              onClick={() => enqueuePendingMutation.mutate()}
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
              disabled={retryFailedMutation.isPending}
              onClick={() => retryFailedMutation.mutate()}
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
              content items ({stats?.notIndexed ?? 0} not indexed,{" "}
              {stats?.failedIndexing ?? 0} failed). This will fetch and index
              content from URLs and may take a while.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reindexAllMutation.isPending}
              onClick={() => reindexAllMutation.mutate()}
            >
              {reindexAllMutation.isPending ? "Re-indexing..." : "Re-index All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
