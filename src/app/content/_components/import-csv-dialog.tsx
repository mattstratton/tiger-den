"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { Upload, Download, AlertCircle, CheckCircle, Loader2, CheckCircle2, Database } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    field?: string;
  }>;
  enrichment?: {
    attempted: number;
    successful: number;
    failed: number;
  };
  indexed: number;
  indexingFailed: number;
}

export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<{
    phase: 'enriching' | 'validating' | 'inserting' | null;
    current: number;
    total: number;
    percentage: number;
    errorCount: number;
    message: string;
  } | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);


  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setImporting(true);
      setResult(null);
      setProgress(null);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          // Parse the CSV data
          const rows = results.data as Array<Record<string, unknown>>;

          if (rows.length === 0) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [{ row: 0, message: "CSV file is empty" }],
              indexed: 0,
              indexingFailed: 0,
            });
            setImporting(false);
            return;
          }

          // Check row count limit
          if (rows.length > 1000) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [
                {
                  row: 0,
                  message:
                    "CSV exceeds 1000 row limit. Please split into smaller files.",
                },
              ],
              indexed: 0,
              indexingFailed: 0,
            });
            setImporting(false);
            return;
          }

          // Generate session ID and start SSE-based import
          const sessionId = crypto.randomUUID();

          try {
            // Send CSV rows to start-import endpoint
            const response = await fetch("/api/csv/start-import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, rows }),
            });

            if (!response.ok) {
              throw new Error("Failed to start import");
            }

            // Open EventSource connection to receive progress updates
            const es = new EventSource(
              `/api/csv/import-stream?session=${sessionId}`
            );
            setEventSource(es);

            // Handle all SSE messages
            es.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);

                if (data.type === 'progress') {
                  setProgress({
                    phase: data.phase,
                    current: data.current,
                    total: data.total,
                    percentage: data.percentage,
                    errorCount: data.errorCount,
                    message: data.message,
                  });
                } else if (data.type === 'complete') {
                  setResult({
                    successful: data.successful,
                    failed: data.failed,
                    errors: data.errors,
                    enrichment: data.enrichment,
                    indexed: data.indexed,
                    indexingFailed: data.indexingFailed,
                  });
                  setImporting(false);
                  setProgress(null);
                  es.close();
                  setEventSource(null);
                } else if (data.type === 'error') {
                  console.error('Import error:', data.message);
                  setResult({
                    successful: 0,
                    failed: 1,
                    errors: [{ row: 0, message: data.message }],
                    indexed: 0,
                    indexingFailed: 0,
                  });
                  setImporting(false);
                  setProgress(null);
                  es.close();
                  setEventSource(null);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE message:', parseError);
              }
            };

            // Handle connection errors
            es.onerror = () => {
              console.error("EventSource connection error");
              setResult({
                successful: 0,
                failed: 1,
                errors: [{ row: 0, message: "Import stream connection failed" }],
                indexed: 0,
                indexingFailed: 0,
              });
              setImporting(false);
              setProgress(null);
              es.close();
              setEventSource(null);
            };
          } catch (error) {
            console.error("Import error:", error);
            setResult({
              successful: 0,
              failed: 1,
              errors: [
                {
                  row: 0,
                  message:
                    error instanceof Error ? error.message : "Import failed",
                },
              ],
              indexed: 0,
              indexingFailed: 0,
            });
            setImporting(false);
            setProgress(null);
          }
        },
        error: (error) => {
          setResult({
            successful: 0,
            failed: 1,
            errors: [{ row: 0, message: `Failed to parse CSV: ${error.message}` }],
            indexed: 0,
            indexingFailed: 0,
          });
          setImporting(false);
        },
      });
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    multiple: false,
    disabled: importing,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection?.errors[0]?.code === "file-too-large") {
        setResult({
          successful: 0,
          failed: 0,
          errors: [
            {
              row: 0,
              message:
                "File size exceeds 5MB limit. Please split into smaller files.",
            },
          ],
          indexed: 0,
          indexingFailed: 0,
        });
      } else {
        setResult({
          successful: 0,
          failed: 0,
          errors: [
            {
              row: 0,
              message: rejection?.errors[0]?.message ?? "File rejected",
            },
          ],
          indexed: 0,
          indexingFailed: 0,
        });
      }
    },
  });

  const handleDownloadTemplate = () => {
    const template = [
      [
        "title",
        "current_url",
        "content_type",
        "publish_date",
        "description",
        "author",
        "target_audience",
        "tags",
        "campaigns",
      ],
      [
        "Sample Blog Post",
        "https://example.com/blog/sample-post",
        "blog_post",
        "2026-01-15",
        "This is a sample blog post description",
        "John Doe",
        "Developers",
        "tag1, tag2, tag3",
        "Q1 2026, Product Launch",
      ],
      [
        "Sample YouTube Video",
        "https://youtube.com/watch?v=sample123",
        "youtube_video",
        "2026-01-20",
        "This is a sample YouTube video description",
        "Jane Smith",
        "Technical Users",
        "video, tutorial",
        "Q1 2026",
      ],
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "content-import-template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    // Clean up EventSource if it exists
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    // Reset all state
    setResult(null);
    setProgress(null);
    setImporting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Content from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple content items at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={importing}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <p className="text-sm text-muted-foreground">
              Download a sample CSV file to see the expected format
            </p>
          </div>

          {/* Dropzone */}
          {!result && (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-colors
                ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                ${importing ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5"}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {importing ? (
                <div className="space-y-4 max-w-md mx-auto">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <Progress value={progress?.percentage ?? 0} className="h-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {progress?.current ?? 0} / {progress?.total ?? 0} items
                      </span>
                      <span>{progress?.percentage.toFixed(0) ?? 0}%</span>
                    </div>
                  </div>

                  {/* Status message */}
                  <div className="flex items-center justify-center gap-2">
                    {progress?.phase === 'enriching' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {progress?.phase === 'validating' && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {progress?.phase === 'inserting' && (
                      <Database className="h-4 w-4 text-primary" />
                    )}
                    <p className="text-sm font-medium">
                      {progress?.message ?? "Starting import..."}
                    </p>
                  </div>

                  {/* Error count badge */}
                  {progress && progress.errorCount > 0 && (
                    <div className="flex justify-center">
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {progress.errorCount} {progress.errorCount === 1 ? "error" : "errors"}
                      </Badge>
                    </div>
                  )}

                  {/* Phase indicators */}
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className={`flex items-center gap-1 ${progress?.phase === 'enriching' ? 'text-primary font-medium' : ''}`}>
                      {progress?.phase === 'enriching' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      <span>Enrich</span>
                    </div>
                    <span>→</span>
                    <div className={`flex items-center gap-1 ${progress?.phase === 'validating' ? 'text-primary font-medium' : ''}`}>
                      {progress?.phase === 'validating' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : progress?.phase === 'inserting' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <div className="h-3 w-3" />
                      )}
                      <span>Validate</span>
                    </div>
                    <span>→</span>
                    <div className={`flex items-center gap-1 ${progress?.phase === 'inserting' ? 'text-primary font-medium' : ''}`}>
                      {progress?.phase === 'inserting' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <div className="h-3 w-3" />
                      )}
                      <span>Insert</span>
                    </div>
                  </div>
                </div>
              ) : isDragActive ? (
                <p className="text-lg font-medium">Drop the CSV file here</p>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">
                    Drag and drop a CSV file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to select a file
                  </p>
                </>
              )}
            </div>
          )}

          {/* Import Results */}
          {result && (
            <div className="space-y-4">
              {/* Success Alert */}
              {result.successful > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Import Successful</AlertTitle>
                  <AlertDescription>
                    Successfully imported {result.successful} content{" "}
                    {result.successful === 1 ? "item" : "items"}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {result.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import Errors</AlertTitle>
                  <AlertDescription>
                    Failed to import {result.failed} content{" "}
                    {result.failed === 1 ? "item" : "items"}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Error List */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Error Details:</h4>
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-4 space-y-2">
                    {result.errors.map((error, index) => (
                      <div
                        key={index}
                        className="text-sm p-2 bg-destructive/10 rounded"
                      >
                        <span className="font-medium">Row {error.row}:</span>{" "}
                        {error.field && (
                          <span className="text-muted-foreground">
                            [{error.field}]
                          </span>
                        )}{" "}
                        {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enrichment Results */}
              {result.enrichment && result.enrichment.attempted > 0 && (
                <Alert>
                  <AlertTitle>Title Enrichment</AlertTitle>
                  <AlertDescription>
                    Fetched {result.enrichment.successful} of {result.enrichment.attempted} titles from URLs.
                    {result.enrichment.failed > 0 && ` (${result.enrichment.failed} failed)`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Indexing Results */}
              {result.successful > 0 && (
                <Alert>
                  <AlertTitle>Content Indexing</AlertTitle>
                  <AlertDescription>
                    Indexed {result.indexed} of {result.successful} items for search.
                    {result.indexingFailed > 0 && ` (${result.indexingFailed} failed - will retry automatically)`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setResult(null);
                    setImporting(false);
                  }}
                >
                  Import Another File
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
