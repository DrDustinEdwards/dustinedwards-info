/**
 * Data sources for the admin cockpit, all stubbed for now. Each panel loader
 * calls exactly one source, so going live means replacing a stubSource() call
 * with a real fetch against the named provider: the routes, components and
 * SourceResult contract stay untouched.
 */

import type {
  AdminDataSource,
  AdminTool,
  ContentSection,
  OverviewCard,
  SiteHealth,
} from "./types";

function stubSource<T>(
  id: string,
  label: string,
  provider: string,
  note: string,
  data: T,
): AdminDataSource<T> {
  return {
    id,
    label,
    provider,
    async fetch(_env) {
      return { status: "stub", data, note };
    },
  };
}

/** Overview status board: one card per signal the cockpit will aggregate. */
export const overviewSource = stubSource<OverviewCard[]>(
  "overview",
  "Status board",
  "aggregate",
  "Each card goes live as its integration is wired.",
  [
    {
      id: "sites",
      label: "Portfolio sites",
      value: "6 tracked",
      hint: "Per-site health checks not wired yet",
      status: "unknown",
    },
    {
      id: "content",
      label: "Site content",
      value: "Empty",
      hint: "Blog, protocols and CV counts land here",
      status: "unknown",
    },
    {
      id: "deploys",
      label: "Deploys",
      value: "Manual",
      hint: "Cloudflare and Vercel deploy feeds pending",
      status: "unknown",
    },
    {
      id: "errors",
      label: "Errors",
      value: "No feed",
      hint: "Sentry integration pending",
      status: "unknown",
    },
    {
      id: "capsid",
      label: "Capsid memory",
      value: "No feed",
      hint: "Namespace and document stats pending",
      status: "unknown",
    },
    {
      id: "auth",
      label: "Auth",
      value: "Single admin",
      hint: "Better Auth, Google, sessions in KV",
      status: "ok",
    },
  ],
);

/** Portfolio health: one card per site the cockpit watches. */
export const sitesSource = stubSource<SiteHealth[]>(
  "sites",
  "Portfolio health",
  "cloudflare + vercel",
  "Placeholder statuses until per-site checks are wired.",
  [
    {
      id: "germomics",
      name: "Germomics",
      blurb: "Microbiology media site",
      platform: "Cloudflare Workers",
      url: null,
      status: "unknown",
      summary: "Health check not wired",
    },
    {
      id: "txasm",
      name: "TXASM",
      blurb: "Texas branch of ASM",
      platform: "Cloudflare Workers",
      url: null,
      status: "unknown",
      summary: "Health check not wired",
    },
    {
      id: "foxing",
      name: "Foxing",
      blurb: "Journal app, web and mobile",
      platform: "Vercel",
      url: null,
      status: "unknown",
      summary: "Health check not wired",
    },
    {
      id: "recova",
      name: "Recova",
      blurb: "Payment recovery SaaS",
      platform: "Vercel",
      url: null,
      status: "unknown",
      summary: "Health check not wired",
    },
    {
      id: "julieedwards",
      name: "julieedwards.info",
      blurb: "Static personal site",
      platform: "Cloudflare (Astro)",
      url: "https://julieedwards.info",
      status: "unknown",
      summary: "Health check not wired",
    },
    {
      id: "capsid",
      name: "Capsid",
      blurb: "Shared memory MCP server",
      platform: "Cloudflare Workers",
      url: null,
      status: "unknown",
      summary: "Health check not wired",
    },
  ],
);

/** Content manager shell: the three managed areas of this site. */
export const contentSource = stubSource<ContentSection[]>(
  "content",
  "Site content",
  "d1",
  "Counts come from D1 once the editors exist.",
  [
    {
      id: "blog",
      label: "Blog",
      description: "Categorized posts with FTS5 search",
      count: null,
      status: "unknown",
    },
    {
      id: "protocols",
      label: "Protocols",
      description: "Lab protocols knowledgebase with HowTo schema",
      count: null,
      status: "unknown",
    },
    {
      id: "cv",
      label: "CV",
      description: "Interactive curriculum vitae sections",
      count: null,
      status: "unknown",
    },
  ],
);

/** Admin-side controls, listed now, wired later. */
export const toolsSource = stubSource<AdminTool[]>(
  "tools",
  "Controls",
  "cloudflare + capsid",
  "Controls activate as each backing API is wired.",
  [
    {
      id: "purge-cache",
      label: "Purge cache",
      description: "Purge the Cloudflare cache for this zone",
      provider: "Cloudflare",
      ready: false,
    },
    {
      id: "resubmit-sitemap",
      label: "Resubmit sitemap",
      description: "Ping search engines with the current sitemap",
      provider: "Local",
      ready: false,
    },
    {
      id: "media-library",
      label: "Media library",
      description: "Browse and prune the R2 media bucket",
      provider: "R2",
      ready: false,
    },
    {
      id: "capsid-note",
      label: "Capsid session note",
      description: "Write an episodic entry to shared memory",
      provider: "Capsid",
      ready: false,
    },
    {
      id: "secrets-audit",
      label: "Secrets audit",
      description: "Verify the five required wrangler secrets are set",
      provider: "Worker env",
      ready: false,
    },
  ],
);
