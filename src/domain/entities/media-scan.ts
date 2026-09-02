export type MediaScanPhase =
  | "preparing"
  | "discovering"
  | "comparing"
  | "analyzing"
  | "persisting"
  | "pruning"
  | "completed";

export type MediaScanJobStatus =
  | "running"
  | "cancelling"
  | "completed"
  | "cancelled"
  | "failed";

export interface MediaScanProgress {
  phase: MediaScanPhase;
  current: number;
  total: number;
  fileName?: string;
  message?: string;
}

export interface MediaScanResult {
  roots: string[];
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  saved: number;
  matched: number;
  unmatched: number;
  removed: number;
  probed: number;
  hashed: number;
  sidecarUpdated: number;
  warnings: string[];
}

export interface MediaScanJobSnapshot {
  id: string;
  status: MediaScanJobStatus;
  startedAt: string;
  finishedAt?: string;
  progress: MediaScanProgress;
  options: {
    probeMedia: boolean;
    computeSha256: boolean;
    pruneMissing: boolean;
  };
  result?: MediaScanResult;
  error?: string;
}
