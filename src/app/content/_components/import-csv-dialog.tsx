"use client";

import {
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  SearchCheck,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Progress } from "~/components/ui/progress";
import { api } from "~/trpc/react";

const REQUIRED_COLUMNS = ["current_url", "content_type"];
const CONTENT_TYPES = [
  "youtube_video",
  "blog_post",
  "case_study",
  "website_content",
  "third_party",
  "other",
] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

function validateCsvRows(
  rows: Array<Record<string, unknown>>,
  headers: string[],
): Array<{ row: number; message: string; field?: string }> {
  const errors: Array<{ row: number; message: string; field?: string }> = [];
  const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingCols.length > 0) {
    errors.push({
      row: 0,
      message: `Missing required column(s): ${missingCols.join(", ")}`,
    });
    return errors;
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown> | undefined;
    if (!row) continue;
    const rowNum = i + 2;
    const url = row.current_url;
    if (url === undefined || url === null || String(url).trim() === "") {
      errors.push({
        row: rowNum,
        message: "current_url is required",
        field: "current_url",
      });
    } else if (!URL_REGEX.test(String(url).trim())) {
      errors.push({
        row: rowNum,
        message: "Invalid URL format",
        field: "current_url",
      });
    }
    const ct = row.content_type;
    if (ct === undefined || ct === null || String(ct).trim() === "") {
      errors.push({
        row: rowNum,
        message: "content_type is required",
        field: "content_type",
      });
    } else if (
      !CONTENT_TYPES.includes(
        String(ct).trim() as (typeof CONTENT_TYPES)[number],
      )
    ) {
      errors.push({
        row: rowNum,
        message: `content_type must be one of: ${CONTENT_TYPES.join(", ")}`,
        field: "content_type",
      });
    }
    const pub = row.publish_date;
    if (pub !== undefined && pub !== null && String(pub).trim() !== "") {
      if (!DATE_REGEX.test(String(pub).trim())) {
        errors.push({
          row: rowNum,
          message: "publish_date must be YYYY-MM-DD",
          field: "publish_date",
        });
      }
    }
  }
  return errors;
}

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
    title: { attempted: number; successful: number; failed: number };
    date: { attempted: number; successful: number; failed: number };
    author: { attempted: number; successful: number; failed: number };
  };
  indexed: number;
  indexingFailed: number;
  validationOnly?: boolean;
}

export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const utils = api.useUtils();
  const validateOnlyInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<{
    phase: "enriching" | "validating" | "inserting" | null;
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

  const handleDrop = useCallback((acceptedFiles: File[]) => {
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
            `/api/csv/import-stream?session=${sessionId}`,
          );
          setEventSource(es);

          // Handle all SSE messages
          es.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              if (data.type === "progress") {
                setProgress({
                  phase: data.phase,
                  current: data.current,
                  total: data.total,
                  percentage: data.percentage,
                  errorCount: data.errorCount,
                  message: data.message,
                });
              } else if (data.type === "complete") {
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
              } else if (data.type === "error") {
                console.error("Import error:", data.message);
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
              console.error("Failed to parse SSE message:", parseError);
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
          errors: [
            { row: 0, message: `Failed to parse CSV: ${error.message}` },
          ],
          indexed: 0,
          indexingFailed: 0,
        });
        setImporting(false);
      },
    });
  }, []);

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
    // Refresh content list so new items appear when they return (6.2)
    void utils.content.list.invalidate();
    // Reset all state
    setResult(null);
    setProgress(null);
    setImporting(false);
    setValidating(false);
    onOpenChange(false);
  };

  const handleValidateOnly = () => {
    validateOnlyInputRef.current?.click();
  };

  const handleValidateOnlyFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setValidating(true);
      setResult(null);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setValidating(false);
          const rows = results.data as Array<Record<string, unknown>>;
          const headers = results.meta.fields ?? [];
          if (rows.length === 0) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [{ row: 0, message: "CSV file is empty" }],
              indexed: 0,
              indexingFailed: 0,
              validationOnly: true,
            });
            return;
          }
          if (rows.length > 1000) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [
                {
                  row: 0,
                  message:
                    "CSV exceeds 1000 row limit. Split into smaller files.",
                },
              ],
              indexed: 0,
              indexingFailed: 0,
              validationOnly: true,
            });
            return;
          }
          const errors = validateCsvRows(rows, headers);
          if (errors.length > 0) {
            setResult({
              successful: 0,
              failed: 0,
              errors,
              indexed: 0,
              indexingFailed: 0,
              validationOnly: true,
            });
            toast.error(`Validation found ${errors.length} issue(s)`);
          } else {
            setResult({
              successful: rows.length,
              failed: 0,
              errors: [],
              indexed: 0,
              indexingFailed: 0,
              validationOnly: true,
            });
            toast.success(
              `Validation passed: ${rows.length} row(s) ready to import`,
            );
          }
        },
      });
    },
    [],
  );

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Content from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple content items at once. Max 1000
            rows, 5MB. Use the template for column format.
          </DialogDescription>
        </DialogHeader>

        <input
          accept=".csv"
          aria-label="Choose CSV file to validate only (no import)"
          className="hidden"
          onChange={handleValidateOnlyFile}
          ref={validateOnlyInputRef}
          type="file"
        />

        <div className="space-y-4">
          {/* Download Template + Validate only */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={importing}
              onClick={handleDownloadTemplate}
              size="sm"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button
              disabled={importing || validating}
              onClick={handleValidateOnly}
              size="sm"
              variant="outline"
            >
              {validating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SearchCheck className="mr-2 h-4 w-4" />
              )}
              Validate only
            </Button>
            <p className="text-muted-foreground text-sm">
              Check structure and required columns before importing
            </p>
          </div>

          {/* Dropzone */}
          {!result && (
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                ${importing ? "cursor-not-allowed opacity-50" : "hover:border-primary hover:bg-primary/5"}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              {importing ? (
                <div className="mx-auto max-w-md space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <Progress
                      className="h-3"
                      value={progress?.percentage ?? 0}
                    />
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                      <span>
                        {progress?.current ?? 0} / {progress?.total ?? 0} items
                      </span>
                      <span>{progress?.percentage.toFixed(0) ?? 0}%</span>
                    </div>
                  </div>

                  {/* Status message */}
                  <div className="flex items-center justify-center gap-2">
                    {progress?.phase === "enriching" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {progress?.phase === "validating" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {progress?.phase === "inserting" && (
                      <Database className="h-4 w-4 text-primary" />
                    )}
                    <p className="font-medium text-sm">
                      {progress?.message ?? "Starting import..."}
                    </p>
                  </div>

                  {/* Error count badge */}
                  {progress && progress.errorCount > 0 && (
                    <div className="flex justify-center">
                      <Badge className="gap-1" variant="destructive">
                        <AlertCircle className="h-3 w-3" />
                        {progress.errorCount}{" "}
                        {progress.errorCount === 1 ? "error" : "errors"}
                      </Badge>
                    </div>
                  )}

                  {/* Phase indicators */}
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                    <div
                      className={`flex items-center gap-1 ${progress?.phase === "enriching" ? "font-medium text-primary" : ""}`}
                    >
                      {progress?.phase === "enriching" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      <span>Enrich</span>
                    </div>
                    <span>→</span>
                    <div
                      className={`flex items-center gap-1 ${progress?.phase === "validating" ? "font-medium text-primary" : ""}`}
                    >
                      {progress?.phase === "validating" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : progress?.phase === "inserting" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <div className="h-3 w-3" />
                      )}
                      <span>Validate</span>
                    </div>
                    <span>→</span>
                    <div
                      className={`flex items-center gap-1 ${progress?.phase === "inserting" ? "font-medium text-primary" : ""}`}
                    >
                      {progress?.phase === "inserting" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <div className="h-3 w-3" />
                      )}
                      <span>Insert</span>
                    </div>
                  </div>
                </div>
              ) : isDragActive ? (
                <p className="font-medium text-lg">Drop the CSV file here</p>
              ) : (
                <>
                  <p className="mb-2 font-medium text-lg">
                    Drag and drop a CSV file here
                  </p>
                  <p className="text-muted-foreground text-sm">
                    or click to select a file
                  </p>
                </>
              )}
            </div>
          )}

          {/* Import Results / Validation Results */}
          {result && (
            <div className="space-y-4">
              {/* Success Alert */}
              {result.successful > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>
                    {result.validationOnly
                      ? "Validation passed"
                      : "Import Successful"}
                  </AlertTitle>
                  <AlertDescription>
                    {result.validationOnly
                      ? `${result.successful} row(s) are valid and ready to import.`
                      : `Successfully imported ${result.successful} content ${result.successful === 1 ? "item" : "items"}.`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {result.failed > 0 && !result.validationOnly && (
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
                  <h4 className="font-medium text-sm">
                    {result.validationOnly
                      ? "Validation issues:"
                      : "Error Details:"}
                  </h4>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-4">
                    {result.errors.map((error, index) => (
                      <div
                        className="rounded bg-destructive/10 p-2 text-sm"
                        key={index}
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

              {/* Enrichment Results (import only) */}
              {result.enrichment &&
                !result.validationOnly &&
                (result.enrichment.title.attempted > 0 ||
                  result.enrichment.date.attempted > 0 ||
                  result.enrichment.author.attempted > 0) && (
                  <Alert>
                    <AlertTitle>Metadata Enrichment</AlertTitle>
                    <AlertDescription className="space-y-1">
                      {result.enrichment.title.attempted > 0 && (
                        <div>
                          Titles: fetched {result.enrichment.title.successful}{" "}
                          of {result.enrichment.title.attempted}
                          {result.enrichment.title.failed > 0 &&
                            ` (${result.enrichment.title.failed} failed)`}
                        </div>
                      )}
                      {result.enrichment.date.attempted > 0 && (
                        <div>
                          Publish dates: fetched{" "}
                          {result.enrichment.date.successful} of{" "}
                          {result.enrichment.date.attempted}
                          {result.enrichment.date.failed > 0 &&
                            ` (${result.enrichment.date.failed} failed)`}
                        </div>
                      )}
                      {result.enrichment.author.attempted > 0 && (
                        <div>
                          Authors: fetched {result.enrichment.author.successful}{" "}
                          of {result.enrichment.author.attempted}
                          {result.enrichment.author.failed > 0 &&
                            ` (${result.enrichment.author.failed} failed)`}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

              {/* Indexing Results (import only) */}
              {result.successful > 0 && !result.validationOnly && (
                <Alert>
                  <AlertTitle>Content Indexing</AlertTitle>
                  <AlertDescription>
                    Indexed {result.indexed} of {result.successful} items for
                    search.
                    {result.indexingFailed > 0 &&
                      ` (${result.indexingFailed} failed - will retry automatically)`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button onClick={handleClose} variant="outline">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setResult(null);
                    setImporting(false);
                    setValidating(false);
                  }}
                >
                  {result.validationOnly
                    ? "Validate another file"
                    : "Import Another File"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
