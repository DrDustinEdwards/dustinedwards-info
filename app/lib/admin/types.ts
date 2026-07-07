/**
 * Shared types for the admin cockpit data layer. Type-only module: it is
 * imported by both server sources and client components, so nothing here may
 * execute code or touch bindings.
 */

export type HealthStatus = "ok" | "warn" | "error" | "unknown";

/**
 * What every panel receives from its data source. "stub" carries placeholder
 * data plus a note about what real integration is pending; "live" carries the
 * real thing once the source is wired.
 */
export type SourceResult<T> =
  | { status: "live"; data: T; fetchedAt: string }
  | { status: "stub"; data: T; note: string }
  | { status: "error"; data: null; message: string };

/**
 * A cockpit data source. Panels render a SourceResult and never care whether
 * it came from a stub or a real fetch, so wiring Cloudflare, Vercel, Sentry,
 * Recova, Foxing or Capsid later is a change to one fetch body.
 */
export interface AdminDataSource<T> {
  /** Stable id for caching and logging. */
  id: string;
  /** Human label shown in panel chrome. */
  label: string;
  /** Where live data will come from once wired. */
  provider: string;
  fetch(env: Env): Promise<SourceResult<T>>;
}

/** One card on the overview status board. */
export interface OverviewCard {
  id: string;
  label: string;
  value: string;
  hint: string;
  status: HealthStatus;
}

/** One portfolio site on the sites panel. */
export interface SiteHealth {
  id: string;
  name: string;
  blurb: string;
  platform: string;
  url: string | null;
  status: HealthStatus;
  summary: string;
}

/** One managed content area of this site (blog, protocols, CV). */
export interface ContentSection {
  id: string;
  label: string;
  description: string;
  count: number | null;
  status: HealthStatus;
}

/** One admin-side control on the tools panel. */
export interface AdminTool {
  id: string;
  label: string;
  description: string;
  provider: string;
  ready: boolean;
}
