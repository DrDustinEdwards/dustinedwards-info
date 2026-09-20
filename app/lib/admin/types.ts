/**
 * Shared types for the admin cockpit data layer. Type-only module: it is
 * imported by both server sources and client components, so nothing here may
 * execute code or touch bindings.
 */

export type HealthStatus = "ok" | "warn" | "error" | "unknown";

/**
 * What a panel receives from a source that can fail.
 *
 * TWO ARMS, and the third is what was removed. It was `{ status: "stub"; data: T; note: string }`,
 * so a panel could render invented data while announcing that the real integration was pending.
 * AN ARM THAT SAYS "THIS NUMBER IS NOT REAL" IS A LICENCE TO SHOW A NUMBER THAT IS NOT REAL. Nothing
 * renders invented data any more.
 */
export type SourceResult<T> =
  | { status: "live"; data: T; fetchedAt: string }
  | { status: "error"; data: null; message: string };

/**
 * One row of the origin-requests panel.
 *
 * ORIGIN REQUESTS, not reads: with the Workers cache on, an edge HIT serves a reader without the
 * Worker running at all, so this is a FLOOR under readership rather than a measure of it, and every
 * label on this panel says so.
 *
 * SAMPLING WEIGHTED: `SUM(_sample_interval)`, not a row count, because Analytics Engine samples
 * under load. `rows` carries the unweighted count purely as the diagnostic for whether sampling is
 * on.
 */
export interface TrafficRow {
  path: string;
  originRequests: number;
  rows: number;
}

/** What the origin-requests panel renders. */
export interface TrafficReport {
  windowDays: number;
  rows: TrafficRow[];
  /** Sum across every path in the window, so the top N can state its remainder. */
  totalOriginRequests: number;
  /** How many paths the query returned, before the display cap. */
  pathsReturned: number;
}

/**
 * Origin requests for the whole window, indexed by path, for the post list.
 *
 * `byPath` carries only paths that HAD activity, so a missing slug means one of two different things
 * and `complete` is the difference: with it true a missing slug is a MEASURED ZERO; with it false the
 * query's limit cut the result and a missing slug is UNKNOWN. The column renders those differently
 * and must.
 *
 * The number is `SUM(_sample_interval)` and is a FLOOR under readership, for the reason `TrafficRow`
 * states.
 */
export interface PostReadership {
  /** Days of history behind every count. */
  windowDays: number;
  /** Origin requests by path. Absent path means zero or unknown; see `complete`. */
  byPath: Record<string, number>;
  /** Distinct paths with activity in the window, from the total query. */
  pathsReturned: number;
  /** Whether `byPath` holds every path with activity, or the limit cut it. */
  complete: boolean;
}
