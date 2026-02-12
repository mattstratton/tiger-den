export type ImportPhase = "enriching" | "validating" | "inserting";

export interface ProgressEvent {
  type: "progress";
  phase: ImportPhase;
  current: number;
  total: number;
  percentage: number;
  errorCount: number;
  message: string;
}

export interface CompleteEvent {
  type: "complete";
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
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

export type ImportEvent = ProgressEvent | CompleteEvent | ErrorEvent;
