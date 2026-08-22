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

/**
 * The admin controls. ONE, and the four that went are recorded here.
 *
 * This list rendered five rows, each with a disabled button reading "Not
 * wired", and had done since it was written. That is honest labelling of a
 * promise, but a promise nobody kept is still a promise, and one of the five
 * had stopped being true.
 *
 * **`media-library`** ("Browse and prune the R2 media bucket") was not pending.
 * It SHIPPED. `/admin/media` is fully built, sits in the sidebar above this
 * page with a live count badge, and has a trash, a tag filter and a usage lens.
 * This row advertised as unbuilt a page the reader had just walked past.
 *
 * **`resubmit-sitemap`** ("Ping search engines with the current sitemap") aimed
 * at endpoints that no longer exist. VERIFIED BY PROBE on 2026-08-22 rather
 * than from documentation: `google.com/ping?sitemap=` answers **404** and
 * `bing.com/ping?sitemap=` answers **410 Gone**. Google announced the removal
 * in June 2023 and Bing's went in May 2022. The live successor is IndexNow, a
 * different protocol needing a key file at the domain root, and this site's
 * apex still resolves to the legacy WordPress install, so the ownership proof
 * would be against the wrong host. Worth reconsidering after the DNS cutover;
 * not worth building against a 410 now.
 *
 * **`purge-cache`** would need a Cloudflare API token with account-level purge
 * scope living in this Worker, which is real new attack surface, to solve a
 * problem the seven cached routes already solve with `s-maxage=600` and a
 * redeploy.
 *
 * **`capsid-note`** ("Write an episodic entry to shared memory") was deleted on
 * 2026-08-22 and this paragraph replaces its longer note. Building it would
 * have put back in code a ritual withdrawn in prose: `dustinedwards/core.md`
 * says sessions READ Capsid and never write it, and `capsid/conventions.md`
 * withdrew the end-of-session episodic portfolio-wide on 2026-08-21 because it
 * had produced roughly 100 episodics in recova and 49 here, burying the rulings
 * filed beside them. It was not an unfinished feature, it was a finished
 * decision pointing the other way.
 *
 * All four are recorded rather than silently dropped, because four absences
 * look like an oversight to the next reader with a spare afternoon.
 */
export const toolsSource = stubSource<AdminTool[]>(
  "tools",
  "Controls",
  "worker env",
  "One control. The four that were listed here and never built are recorded above.",
  [
    {
      id: "secrets-audit",
      label: "Secrets audit",
      description: "Verify the five required wrangler secrets are set",
      provider: "Worker env",
      ready: false,
    },
  ],
);
