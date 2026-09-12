/**
 * THE RATIFIED SECRET LIST, in one place, imported by everything that needs it.
 *
 * It lived inline in `scripts/check-secrets.mjs` and was transcribed there from
 * the ruling in `dustinedwards/core.md`. It moved here when the cockpit grew a
 * runtime secrets audit, for the reason `csp.mjs` and `publish-policy.mjs`
 * exist: a second copy of a list is a list that drifts, and this one had
 * already drifted. The tools page described "the five required wrangler
 * secrets" while the gate measured eight, and nothing could notice, because the
 * description was prose and the list was a different file.
 *
 * **MOVING IT DOES NOT WEAKEN `check:secrets`, and that is worth stating
 * because it looks like it might.** That gate's independence argument is that
 * its expectation is NOT read from the code it checks: it compares the ratified
 * list against what the tree READS and against what `app/env.d.ts` DECLARES,
 * and a secret added to one and not the others moves one side and fails. This
 * module is the ratified list itself, still hand-maintained against the ruling,
 * not derived from any of the three. The gate imports its expectation rather
 * than restating it; it still does not compute it.
 *
 * NAMES ONLY. Nothing here is a value, and nothing that reads this may return
 * one. `secrets.server.ts` is the only consumer that touches `env`, and it
 * reports presence.
 *
 * EVERY name below is guarded, including the two that are arguably public. An OAuth
 * client id appears in the authorization URL a browser follows, and
 * `BETTER_AUTH_URL` is a public origin, so neither is a credential. They are
 * guarded anyway because both are read in exactly one `.server` module today,
 * so guarding them costs nothing, and because "arguably public" is a judgement
 * that should be made in a diff rather than assumed.
 *
 * SEVEN BECAME EIGHT on 2026-08-14 with `ANALYTICS_READ_TOKEN`, the credential
 * the cockpit's origin-requests panel reads Analytics Engine with. It is TYPED
 * AND GUARDED BEFORE IT IS PROVISIONED, which is the intended order.
 *
 * TEN BECAME EIGHT AGAIN on 2026-08-23, when the webhook alerting was
 * deleted. `ALERT_WEBHOOK_URL` and `ALERT_HEARTBEAT_URL` were added on
 * 2026-08-22 for an hourly cron that posted breaches to a third-party
 * destination. The ruling that replaced it chose a scheduled GitHub Actions
 * run polling /api/health, and excluded third-party services, so neither URL
 * had a destination it could ever point at. Both were removed unprovisioned;
 * they were never set on the deployed Worker.
 *
 * EIGHT BECAME NINE on 2026-08-24 with `SMOKE_TOKEN`, the read-only machine
 * credential that lets `check:browser` render the admin plane in CI. TYPED AND
 * GUARDED BEFORE IT IS PROVISIONED, the same order `ANALYTICS_READ_TOKEN` went
 * in: the audit reports it absent until Dustin runs `wrangler secret put`, and
 * absent is a state this list is supposed to be able to show.
 *
 * NINE BECAME TEN on 2026-09-12 with `OPENALEX_API_KEY`, when `/publications`
 * came back under ruling 63. Same order again, typed and guarded before it is
 * provisioned. It is the first entry on this list whose absence degrades a
 * PUBLIC page rather than an admin one, and the degradation is deliberately
 * invisible: cached counts keep serving and no refresh is scheduled, so the
 * audit reporting it absent is the only place the gap is visible. That is the
 * argument for listing it rather than treating it as an optional extra.
 *
 * NOT ON THIS LIST: `CLOUDFLARE_ACCOUNT_ID`. It is a plain var in
 * `wrangler.jsonc` and an identifier rather than a credential, so guarding it
 * would spend the gate's signal on a value already published in the core doc.
 * That is a judgement, so it is recorded rather than left to be inferred.
 *
 * @type {readonly string[]}
 */
export const REQUIRED_SECRETS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "ADMIN_EMAIL",
  "GITHUB_TOKEN",
  "OPERATOR_TOKEN",
  "ANALYTICS_READ_TOKEN",
  "SMOKE_TOKEN",
  "OPENALEX_API_KEY",
];
