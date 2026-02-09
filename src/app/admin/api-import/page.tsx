"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Loading } from "~/components/ui/loading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";

type ImportSource =
  | "ghost"
  | "contentful_learn"
  | "contentful_case_study"
  | "youtube_channel";

const SOURCE_LABELS: Record<ImportSource, string> = {
  ghost: "Ghost (Blog)",
  contentful_learn: "Contentful (Learn)",
  contentful_case_study: "Contentful (Case Studies)",
  youtube_channel: "YouTube (Channel)",
};

export default function ApiImportPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-bold text-2xl">API Import</h2>
        <p className="text-muted-foreground">
          Import content from Ghost, Contentful, and YouTube APIs
        </p>
      </div>

      <ConnectionStatusSection />
      <SingleItemTesterSection />
      <BulkImportSection />
      <ImportHistorySection />
    </div>
  );
}

// --- Section 1: Connection Status ---

function ConnectionStatusSection() {
  const connectionQuery = api.apiImport.testConnections.useQuery(undefined, {
    enabled: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Status</CardTitle>
        <CardDescription>
          Test connectivity to Ghost, Contentful, and YouTube APIs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          disabled={connectionQuery.isFetching}
          onClick={() => connectionQuery.refetch()}
        >
          {connectionQuery.isFetching ? "Testing..." : "Test Connections"}
        </Button>

        {connectionQuery.data && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-24 font-medium">Ghost</span>
              <Badge
                variant={
                  connectionQuery.data.ghost.connected
                    ? "default"
                    : connectionQuery.data.ghost.enabled
                      ? "destructive"
                      : "secondary"
                }
              >
                {connectionQuery.data.ghost.connected
                  ? "Connected"
                  : connectionQuery.data.ghost.enabled
                    ? "Failed"
                    : "Not configured"}
              </Badge>
              {connectionQuery.data.ghost.error && (
                <span className="text-muted-foreground text-sm">
                  {connectionQuery.data.ghost.error}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 font-medium">Contentful</span>
              <Badge
                variant={
                  connectionQuery.data.contentful.connected
                    ? "default"
                    : connectionQuery.data.contentful.enabled
                      ? "destructive"
                      : "secondary"
                }
              >
                {connectionQuery.data.contentful.connected
                  ? "Connected"
                  : connectionQuery.data.contentful.enabled
                    ? "Failed"
                    : "Not configured"}
              </Badge>
              {connectionQuery.data.contentful.error && (
                <span className="text-muted-foreground text-sm">
                  {connectionQuery.data.contentful.error}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 font-medium">YouTube</span>
              <Badge
                variant={
                  connectionQuery.data.youtube.connected
                    ? "default"
                    : connectionQuery.data.youtube.enabled
                      ? "destructive"
                      : "secondary"
                }
              >
                {connectionQuery.data.youtube.connected
                  ? "Connected"
                  : connectionQuery.data.youtube.enabled
                    ? "Failed"
                    : "Not configured"}
              </Badge>
              {connectionQuery.data.youtube.error && (
                <span className="text-muted-foreground text-sm">
                  {connectionQuery.data.youtube.error}
                </span>
              )}
            </div>
          </div>
        )}

        {connectionQuery.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{connectionQuery.error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// --- Section 2: Single Item Tester ---

function SingleItemTesterSection() {
  const [source, setSource] = useState<ImportSource>("ghost");
  const [identifier, setIdentifier] = useState("");
  const [result, setResult] = useState<{
    title: string;
    url: string;
    raw: unknown;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const utils = api.useUtils();

  const handleFetch = async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await utils.apiImport.fetchSingleItem.fetch({
        source,
        identifier: identifier.trim(),
      });
      if (data) {
        setResult(data);
      } else {
        setError("Item not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Single Item Tester</CardTitle>
        <CardDescription>
          Fetch a single item by slug or ID to verify API access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="w-56">
            <Select
              onValueChange={(v) => setSource(v as ImportSource)}
              value={source}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            className="max-w-sm"
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder={
              source === "ghost"
                ? "Enter slug or ID"
                : source === "youtube_channel"
                  ? "Enter video ID"
                  : "Enter Contentful entry ID"
            }
            value={identifier}
          />
          <Button
            disabled={loading || !identifier.trim()}
            onClick={handleFetch}
          >
            {loading ? "Fetching..." : "Fetch"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-2 rounded-md border p-4">
            <p>
              <span className="font-medium">Title:</span> {result.title}
            </p>
            <p>
              <span className="font-medium">URL:</span> {result.url}
            </p>
            <Button
              onClick={() => setShowRaw(!showRaw)}
              size="sm"
              variant="outline"
            >
              {showRaw ? "Hide" : "Show"} Raw Data
            </Button>
            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Section 3: Bulk Import ---

function BulkImportSection() {
  const [source, setSource] = useState<ImportSource>("ghost");
  const [sinceDate, setSinceDate] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [previewResult, setPreviewResult] = useState<{
    newItems: number;
    updatable: number;
    skipped: number;
    details: Array<{ title: string; url: string; status: string }>;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const utils = api.useUtils();

  const importMutation = api.apiImport.importItems.useMutation({
    onSuccess: () => {
      // Invalidate history query to show the new log
      void utils.apiImport.getImportHistory.invalidate();
    },
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);

    try {
      const data = await utils.apiImport.fetchPreview.fetch({
        source,
        since: sinceDate ? new Date(sinceDate).toISOString() : undefined,
      });
      setPreviewResult(data);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to fetch preview",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = () => {
    importMutation.mutate({
      source,
      since: sinceDate ? new Date(sinceDate).toISOString() : undefined,
      dryRun,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Import</CardTitle>
        <CardDescription>
          Preview and import content from API sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="mb-1 block text-sm">Source</Label>
            <Select
              onValueChange={(v) => setSource(v as ImportSource)}
              value={source}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-sm">
              Updated since (optional)
            </Label>
            <Input
              className="w-44"
              onChange={(e) => setSinceDate(e.target.value)}
              type="date"
              value={sinceDate}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={dryRun}
              id="dryRun"
              onCheckedChange={(checked) => setDryRun(checked === true)}
            />
            <Label className="text-sm" htmlFor="dryRun">
              Dry run
            </Label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            disabled={previewLoading}
            onClick={handlePreview}
            variant="outline"
          >
            {previewLoading ? "Loading preview..." : "Preview"}
          </Button>
          <Button disabled={importMutation.isPending} onClick={handleImport}>
            {importMutation.isPending ? "Importing..." : "Import"}
          </Button>
        </div>

        {previewError && (
          <Alert variant="destructive">
            <AlertTitle>Preview Error</AlertTitle>
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        )}

        {previewResult && (
          <div className="grid grid-cols-3 gap-4">
            <StatsCard
              color="text-green-600"
              label="New"
              value={previewResult.newItems}
            />
            <StatsCard
              color="text-blue-600"
              label="Updates"
              value={previewResult.updatable}
            />
            <StatsCard
              color="text-muted-foreground"
              label="Skipped"
              value={previewResult.skipped}
            />
          </div>
        )}

        {importMutation.isSuccess && (
          <Alert>
            <AlertTitle>
              {importMutation.data.dryRun
                ? "Dry Run Complete"
                : "Import Complete"}
            </AlertTitle>
            <AlertDescription>
              <p>
                Total: {importMutation.data.totalItems} | Created:{" "}
                {importMutation.data.created} | Updated:{" "}
                {importMutation.data.updated} | Skipped:{" "}
                {importMutation.data.skipped} | Failed:{" "}
                {importMutation.data.failed}
              </p>
              {importMutation.data.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium text-sm">
                    {importMutation.data.errors.length} error(s)
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {importMutation.data.errors.map((err, i) => (
                      <li key={i}>
                        {err.item}: {err.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </AlertDescription>
          </Alert>
        )}

        {importMutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>Import Error</AlertTitle>
            <AlertDescription>{importMutation.error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StatsCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className={`font-bold text-2xl ${color}`}>{value}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

// --- Section 4: Import History ---

function ImportHistorySection() {
  const historyQuery = api.apiImport.getImportHistory.useQuery(
    { limit: 20 },
    { refetchInterval: 30000 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import History</CardTitle>
        <CardDescription>Recent import operations and results</CardDescription>
      </CardHeader>
      <CardContent>
        {historyQuery.isLoading && (
          <Loading message="Loading history" className="py-6" />
        )}

        {historyQuery.data && historyQuery.data.length === 0 && !historyQuery.isLoading && (
          <EmptyState message="No imports yet. Run a bulk import above to get started." />
        )}

        {historyQuery.data && historyQuery.data.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyQuery.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(log.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {SOURCE_LABELS[log.sourceType as ImportSource] ??
                        log.sourceType}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.dryRun ? "secondary" : "default"}>
                        {log.dryRun ? "Dry Run" : "Import"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {log.totalItems}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.createdCount ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.updatedCount ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.skippedCount ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.failedCount ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {historyQuery.error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{historyQuery.error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
