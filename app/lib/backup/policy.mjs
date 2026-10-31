// PURE on purpose, like verdicts.mjs: check:tests cannot reach a module that imports a binding, and
// the rules that decide whether a dump may be marked complete must be provable by `node --test`.

/**
 * The D1 tables that are NOT derived from the repository or the bucket, so the dump
 * is the only copy of their rows. Read off drizzle/*.sql on 2026-10-11; the reason names the source
 * of each. Every other table converges toward the repository or a bucket and is repaired through
 * its derivation, so its absence from a dump would cost a rebuild, not data.
 *
 * `settings` is not here: its one key, llms.txt, is derived from the repository by sync_llms.
 */
export const NON_DERIVED_TABLES = Object.freeze({
  webmentions: "rows came from strangers' POSTs and the moderation decisions on them (migration 0014)",
  zero_result_queries: "search demand signal, swept by retention, converges toward nothing (0015)",
  procedure_versions: "the sealed frozen copy of every published procedure version, never rewritten (0027)",
  kb_locations: "Knowledge Base inventory locations, written through site-api (0029)",
  kb_lots: "Knowledge Base inventory lots, written through site-api (0029)",
  kb_audit: "the audit trail of the two inventory tables (0029)",
  members: "lab members and their titles (0030)",
  member_audit: "the audit trail of membership changes (0030)",
  member_terms: "lab term end dates (0030)",
  scheduled_updates: "updates Carrel scheduled on live posts, waiting for their time (0033)",
  webmention_targets: "the pages each post last sent a webmention to, so a removed link is told too (0037)",
  content_trash: "the posts in Carrel's trash and since when (0038)",
  post_redirects: "the old addresses of renamed posts, each answered with a 301 (0038)",
  scheduled_publishes: "posts scheduled before they were ever live, for the cron to announce (0038)",
});

/** A dump that lacks any of these is not complete, whatever else it holds. */
export const REQUIRED_TABLES = Object.freeze(Object.keys(NON_DERIVED_TABLES));

/**
 * Tables left out of the dump because they hold live credentials or one-time tokens. One:
 * `preview_links` (0037), the SHA-256 of each Carrel preview link's token, since a restore would bring
 * back links that were revoked or had expired. The Better Auth tables (user, session, account,
 * verification) were dropped by migration 0026, admin sign-in is Cloudflare Access and keeps no row.
 *
 * The credential-column check is d1-dump's (`credentials: true` in d1-backup.server.ts, its
 * CREDENTIAL_COLUMN): a table added later with a column named for a password, secret, token, key or
 * a token's hash fails the dump by name until it is listed here, with the reason, or its column is
 * renamed. This file held its own copy of that check until d1-dump v0.8.0 took it.
 */
/** @type {readonly string[]} */
export const EXCLUDED_TABLES = Object.freeze(["preview_links"]);
