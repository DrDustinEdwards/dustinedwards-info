-- The /lab workspace's people: who may sign in, with which title, until when, and every change to that list
-- (job_4409e06c39d4, docs/KNOWLEDGE-BASE.md step 5; capsid docs/design/design-identity-roles.md). Number 0030 is
-- this job's. Hand-written (drizzle-kit is intentionally not used). Applied with:
--   wrangler d1 migrations apply dustinedwards [--local|--remote]
--
-- ADDITIVE: three new tables, all EMPTY. No existing table, column or row is touched.
--
-- SOURCE OF TRUTH. People change through /lab/members and nowhere else, so D1 is their source and they are never
-- committed to the public repository. The rules (layers, permission bundles, end dates) are site-runtime's
-- `./members`; the titles are `app/lab/titles.mjs`. The Primary Owner is PRIMARY_OWNER_EMAIL, a Worker secret, and
-- never a row here.
--
-- `members` keeps a removed or expired person's row, marked, so their runs and edits keep their name.
-- `member_audit` is append-only: one row per change, written in the same batch as the change. `cloudflare` starts
-- 'pending' and the Access sync's answer moves it to 'accepted' or 'failed'; a change that does not touch the allow
-- list (a term date) is 'not_needed'. `at` is the ISO time site-runtime's `auditRow` writes.
-- `member_terms` holds the semester end dates an Owner enters once a year; a Lab worker's or Lab manager's end date
-- defaults to the first of them after today. Dates are ISO text (YYYY-MM-DD).

CREATE TABLE members (
  email text PRIMARY KEY NOT NULL,
  name text NOT NULL DEFAULT '',
  title text NOT NULL,
  end_date text,
  status text NOT NULL DEFAULT 'active',
  added_by text NOT NULL,
  added_at integer NOT NULL DEFAULT (unixepoch()),
  updated_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT members_status_check CHECK (status in ('active', 'removed', 'expired')),
  CONSTRAINT members_email_check CHECK (email = lower(trim(email)) AND instr(email, '@') > 1)
);

CREATE TABLE member_audit (
  id integer PRIMARY KEY AUTOINCREMENT,
  at text NOT NULL,
  actor text NOT NULL,
  actor_title text NOT NULL,
  action text NOT NULL,
  member_email text,
  before_row text,
  after_row text,
  reason text,
  cloudflare text NOT NULL DEFAULT 'pending',
  cloudflare_error text,
  CONSTRAINT member_audit_action_check CHECK (action in ('add', 'change_title', 'renew', 'remove', 'expire', 'review_keep', 'set_terms')),
  CONSTRAINT member_audit_cloudflare_check CHECK (cloudflare in ('pending', 'accepted', 'failed', 'not_needed'))
);

CREATE INDEX member_audit_member_idx ON member_audit (member_email, at);

CREATE INDEX member_audit_cloudflare_idx ON member_audit (cloudflare);

CREATE TABLE member_terms (
  end_date text PRIMARY KEY NOT NULL,
  added_by text NOT NULL,
  added_at integer NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT member_terms_date_check CHECK (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
