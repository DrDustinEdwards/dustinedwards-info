-- Better Auth is gone: admin sign-in is Cloudflare Access (app/lib/access.server.ts), which keeps no
-- row here. These four tables held the single Google administrator, the OAuth tokens Google handed
-- back, and verification rows; sessions were in KV and expire on their own.
--
-- DESTRUCTIVE, so ship refuses to apply it and Dustin runs it:
--   wrangler d1 migrations apply dustinedwards --remote
-- It is safe: nothing else references these tables (only they reference each other, children first
-- below), and the code that read them is removed in the same change. Time Travel restores the
-- database to a minute before the drop if that is ever needed (docs/RUNBOOK.md 4a).
--
-- Hand-written (drizzle-kit is intentionally not used).

DROP TABLE session;
DROP TABLE account;
DROP TABLE verification;
DROP TABLE "user";
