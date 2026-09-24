// Type-only: imported by client components too, so nothing here may execute code or touch bindings.

export type HealthStatus = "ok" | "warn" | "error" | "unknown";

export type SourceResult<T> =
  | { status: "live"; data: T; fetchedAt: string }
  | { status: "error"; data: null; message: string };

// Origin requests, not reads: a cache HIT never runs the Worker, so this is a floor under readership.
// Weighted by SUM(_sample_interval) because Analytics Engine samples under load; `rows` shows whether it did.
export interface TrafficRow {
  path: string;
  originRequests: number;
  rows: number;
}

export interface TrafficReport {
  windowDays: number;
  rows: TrafficRow[];
  totalOriginRequests: number;
  pathsReturned: number;
}

// `byPath` holds only paths with activity: a missing slug is a measured zero when `complete`,
// and unknown when the query's limit cut the result.
export interface PostReadership {
  windowDays: number;
  byPath: Record<string, number>;
  pathsReturned: number;
  complete: boolean;
}
