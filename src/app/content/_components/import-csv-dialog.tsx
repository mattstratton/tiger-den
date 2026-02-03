"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { Upload, Download, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { api } from "~/trpc/react";

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

  const utils = api.useUtils();
  const importMutation = api.csv.import.useMutation({
    onSuccess: async (data) => {
      setResult(data);
      setImporting(false);
      // Refetch content list if any imports were successful
      if (data.successful > 0) {
        await utils.content.list.invalidate();
      }
    },
    onError: (error) => {
      setResult({
        successful: 0,
        failed: 1,
        errors: [{ row: 0, message: error.message }],
      });
      setImporting(false);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setImporting(true);
      setResult(null);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Parse the CSV data
          const rows = results.data as Array<Record<string, unknown>>;

          if (rows.length === 0) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [{ row: 0, message: "CSV file is empty" }],
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
            });
            setImporting(false);
            return;
          }

          // Call the import mutation
          importMutation.mutate({ rows });
        },
        error: (error) => {
          setResult({
            successful: 0,
            failed: 1,
            errors: [{ row: 0, message: `Failed to parse CSV: ${error.message}` }],
          });
          setImporting(false);
        },
      });
    },
    [importMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
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
    setResult(null);
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
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Importing content items...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fetching titles from URLs...
                  </p>
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
