/**
 * Data sources for the admin cockpit, all stubbed for now. Each panel loader
 * calls exactly one source, so going live means replacing a stubSource() call
 * with a real fetch against the named provider: the routes, components and
 * SourceResult contract stay untouched.
 */

import type {
  AdminDataSource,
  AdminTool,
  OverviewCard,
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

/**
 * The overview board. ONE CARD, and the reason there is only one is the point.
 *
 * It carried six. Five of them read "unknown" with a hint ending in "pending"
 * or "not wired": Portfolio sites, Site content, Deploys, Errors, and Capsid
 * memory. Two of those five pointed at `/admin/sites` and `/admin/content`,
 * which no longer exist. A status board where five of six cards say "no feed"
 * is not a status board, it is a roadmap rendered as instrumentation, and a
 * reader cannot tell a measured card from a decorated one at a glance.
 *
 * **`auth` is kept because its text is TRUE, and that is a weaker claim than
 * "measured". Read this before trusting the dot.** "Single admin, Better Auth,
 * Google, sessions in KV" is an accurate statement about how this plane works.
 * Its `status: "ok"` is a CONSTANT: it would render the same green dot with the
 * session store unreachable, because nothing here checks anything. The card
 * describes the design, it does not report on it.
 *
 * Nothing was invented to fill the space left by the other five. If this board
 * is to become real it wants facts the admin already computes and does not
 * show, which is a different piece of work.
 */
export const overviewSource = stubSource<OverviewCard[]>(
  "overview",
  "Status board",
  "aggregate",
  "One card, describing how this plane authenticates. Nothing here polls.",
  [
    {
      id: "auth",
      label: "Auth",
      value: "Single admin",
      hint: "Better Auth, Google, sessions in KV",
      status: "ok",
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
    /*
     * **`capsid-note` WAS HERE AND IS DELETED, NOT DEFERRED. Ruled 2026-08-22.**
     *
     * It read: "Capsid session note. Write an episodic entry to shared memory."
     * Building it would have put back in code a ritual that was withdrawn in
     * prose. Two standing rules say so, and they agree:
     * `dustinedwards/core.md` says sessions READ Capsid and never write it, and
     * `capsid/conventions.md` withdrew the end-of-session episodic
     * portfolio-wide on 2026-08-21, because that rule is what produced roughly
     * 100 episodics in recova and 49 here, which is what buried the rulings
     * filed beside them.
     *
     * So this was not an unfinished feature. It was a finished decision
     * pointing the other way, sitting in a list of things still to do. A stub
     * is a promise, and this one promised to reinstate the thing that was
     * removed.
     *
     * Recorded rather than silently dropped, because the id would otherwise
     * look like an oversight to the next reader with a spare afternoon.
     */
    {
      id: "secrets-audit",
      label: "Secrets audit",
      description: "Verify the five required wrangler secrets are set",
      provider: "Worker env",
      ready: false,
    },
  ],
);
