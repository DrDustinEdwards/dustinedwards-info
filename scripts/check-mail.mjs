/**
 * Gate over the DNS records that make the watchdog's alert mail authenticate.
 *
 *   npm run check:mail
 *
 * NETWORK TIER. It resolves live DNS and cannot run offline, which is why it is
 * not in the tier `ship` runs.
 *
 * ## WHY THIS EXISTS
 *
 * The watchdog is the thing that tells Dustin the site is down. Its whole value
 * is one email arriving. SPF, DKIM and DMARC decide whether that email is
 * delivered or silently dropped, and all six records live in a dashboard where
 * a single click can remove one. Nothing else in this repo can see them: they
 * are not in a config file, they are not in the Worker, and a green deploy says
 * nothing about them. Measured 2026-09-08: every record below was already
 * correct and NOBODY HAD CHECKED, which is the state this gate ends.
 *
 * ## TWO PATHS, NAMED SEPARATELY, BECAUSE THEY ARE DIFFERENT CLAIMS
 *
 * Cloudflare Email Service onboards a domain twice, and the two halves use
 * different hosts and different DKIM selectors. Conflating them is the easy
 * mistake here, and it fails in the direction that looks green:
 *
 * - **SENDING** is what the alert mail uses. Email Sending puts the bounce and
 *   return path on a `cf-bounce` subdomain, so the SPF that authorises the
 *   watchdog's mail is on `cf-bounce.<domain>` and NOT on the apex, and its
 *   DKIM selector is `cf-bounce._domainkey`.
 * - **ROUTING** is what the domain receives on. Email Routing puts MX and SPF
 *   on the apex and uses the `cf2024-1._domainkey` selector.
 *
 * A gate that asserted "the apex SPF has Cloudflare's include" would therefore
 * be checking the ROUTING path while claiming to protect the ALERT MAIL, and
 * would stay green through a `cf-bounce` record being deleted. Both paths are
 * asserted here and each failure names which one it is.
 *
 * ## THE MAIL DOMAIN HAS ONE OWNER AND IT IS NOT THIS FILE
 *
 * Rule 17. The domain is read out of `ALERT_FROM` in `workers/watchdog.ts`, the
 * single place that states where the alert mail comes from. It is deliberately
 * NOT `SITE_ORIGIN`: that is a `workers.dev` host until the cutover, and
 * `watchdog.ts` records at length why the mail domain and the serving origin
 * are separate facts. Parsed rather than imported because `watchdog.ts` is a
 * Worker entry module that does not load under node.
 *
 * ## OBSERVATION BOUNDARY, and it is a real one
 *
 * This proves the RECORDS ARE PUBLISHED AND WELL FORMED. It does not prove a
 * message authenticates: only a received message's `Authentication-Results`
 * header proves that, which is a manual step recorded in the session report and
 * cannot be a gate, because it needs a mailbox this repo cannot read.
 *
 * It also cannot see DKIM key VALIDITY. A published `p=` that no longer matches
 * Cloudflare's private key is indistinguishable from a good one at this
 * distance, and would fail closed only at the recipient.
 *
 * Resolution goes through Google Public DNS rather than Cloudflare's, and the
 * independence is the point: every record here is managed by Cloudflare, so
 * asking Cloudflare's own resolver about them would put one party on both sides
 * of the question. A resolver that cannot answer is a FAILURE and never a pass.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Cloudflare's sender, per the Email Service docs, for both paths. */
const CF_INCLUDE = "include:_spf.mx.cloudflare.net";
/** Email Sending's selector. */
const SENDING_SELECTOR = "cf-bounce._domainkey";
/** Email Routing's selector. */
const ROUTING_SELECTOR = "cf2024-1._domainkey";
/** Email Sending's bounce and return-path subdomain. */
const BOUNCE_HOST = "cf-bounce";

let checks = 0;
let failures = 0;
/** Distinct DNS names actually resolved, which is what the floor counts. */
const recordsChecked = new Set();

/**
 * `ok(label, condition, detail)`, the argument order every gate in this repo
 * uses, and it is NOT a style preference.
 *
 * The first version of this file took the path as a leading argument, so the
 * label sat where the condition belongs. `check:invariants` section 17 refused
 * it on sight, correctly: a string in the condition slot is always truthy, so
 * every assertion here would have passed forever while the check count went on
 * rising. FAILURES.md carries the shape ("one helper name with two argument
 * orders can never fail") and this file was very nearly its next instance.
 *
 * The path stays visible by being the first thing in the LABEL instead, which
 * costs nothing and cannot be mistaken for a condition.
 *
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
}

/**
 * THE MAIL DOMAIN, read from its one owner.
 *
 * Anchored on the `const ALERT_FROM` declaration rather than on any address
 * shaped string in the file, so a mention of an address in a comment cannot
 * satisfy it. Hard rule 10: strip comments before matching is not enough on its
 * own, the needle has to name the binding.
 */
function mailDomain() {
  const source = readFileSync(join(root, "workers", "watchdog.ts"), "utf8");
  const match = source.match(
    /const\s+ALERT_FROM\s*=\s*\{\s*email:\s*["']([^"'@]+)@([^"']+)["']/,
  );
  if (!match) {
    console.log("\ncheck:mail\n");
    console.log(
      "  FAIL  could not read ALERT_FROM out of workers/watchdog.ts, so this gate " +
        "does not know which domain to resolve and every assertion below would " +
        "describe nothing. The declaration moved or was renamed.",
    );
    process.exitCode = 1;
    return null;
  }
  return { local: match[1], domain: match[2] };
}

/**
 * One DoH query, failing closed on anything that is not a clean answer.
 *
 * @param {string} name
 * @param {"TXT"|"MX"} type
 * @returns {Promise<{ok: true, records: string[]} | {ok: false, why: string}>}
 */
async function resolve(name, type) {
  recordsChecked.add(`${type} ${name}`);
  let response;
  /*
   * RETRIED, and the reason is measured rather than defensive. The first full
   * run of this gate went red on `TypeError: fetch failed` for ONE of the six
   * queries while the other five answered, so the record was fine and the
   * transport blinked. A monitoring gate that cries wolf on a single dropped
   * packet gets ignored, which is the exact lesson `alert-state.mjs` was written
   * around: an alert that repeats itself costs the next real one its job.
   *
   * TRANSPORT FAILURES ONLY. An answered query is never retried, however
   * unwelcome the answer: NXDOMAIN and a wrong record are FINDINGS, and retrying
   * a finding until it changes is how a gate is talked out of a true failure.
   */
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      response = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      break;
    } catch (error) {
      if (attempt === attempts) {
        return {
          ok: false,
          why: `resolver unreachable after ${attempts} attempts: ${String(error).slice(0, 120)}`,
        };
      }
      await new Promise((resolveTimer) => setTimeout(resolveTimer, 250 * attempt));
    }
  }
  if (!response) return { ok: false, why: "resolver returned no response object" };
  if (!response.ok) return { ok: false, why: `resolver returned HTTP ${response.status}` };
  const body = await response.json();
  if (body.Status !== 0) {
    return { ok: false, why: `NXDOMAIN or resolver error (DNS status ${body.Status})` };
  }
  const answers = (body.Answer ?? [])
    // Type 16 is TXT, 15 is MX. Anything else in the answer section is a CNAME
    // hop or a signature and is not the record asked for.
    .filter((/** @type {any} */ a) => (type === "TXT" ? a.type === 16 : a.type === 15))
    // A TXT record longer than 255 bytes reaches the wire as several quoted
    // strings and MUST be concatenated before matching. A DKIM key is always
    // over 255 bytes, so a matcher that skipped this would read a truncated key
    // and could never find the end of it.
    .map((/** @type {any} */ a) =>
      String(a.data)
        .replace(/"\s+"/g, "")
        .replace(/^"|"$/g, ""),
    );
  return { ok: true, records: answers };
}

/**
 * SPF, asserted the same way on both paths.
 *
 * EXACTLY ONE record, because two SPF records on one name is a permanent error
 * under RFC 7208 and resolves to `permerror` rather than to either record.
 *
 * @param {string} path
 * @param {string} name
 */
async function assertSpf(path, name) {
  const answer = await resolve(name, "TXT");
  if (!answer.ok) {
    ok(`[${path}] SPF at ${name} resolves`, false, answer.why);
    return;
  }
  const spf = answer.records.filter((r) => r.toLowerCase().startsWith("v=spf1"));
  ok(`[${path}] ${name} publishes exactly one SPF record`, spf.length === 1, `found ${spf.length}`);
  if (spf.length !== 1) return;
  ok(
    `[${path}] ${name} SPF authorises Cloudflare`,
    spf[0].includes(CF_INCLUDE),
    `${JSON.stringify(spf[0])} does not carry ${CF_INCLUDE}`,
  );
  ok(
    `[${path}] ${name} SPF ends in a fail or softfail`,
    /[~-]all\s*$/.test(spf[0]),
    `${JSON.stringify(spf[0])} does not end in -all or ~all, so it authorises everything`,
  );
}

/**
 * DKIM, asserted by selector.
 *
 * The public key is checked for PRESENCE and NON-EMPTINESS only. `p=` with an
 * empty value is the documented way to REVOKE a key, and it is valid syntax, so
 * a gate that only checked the record parsed would pass a revoked selector.
 *
 * @param {string} path
 * @param {string} name
 */
async function assertDkim(path, name) {
  const answer = await resolve(name, "TXT");
  if (!answer.ok) {
    ok(`[${path}] DKIM at ${name} resolves`, false, answer.why);
    return;
  }
  const dkim = answer.records.filter((r) => r.toLowerCase().startsWith("v=dkim1"));
  ok(`[${path}] ${name} publishes a DKIM record`, dkim.length === 1, `found ${dkim.length}`);
  if (dkim.length !== 1) return;
  const key = dkim[0].match(/(?:^|;)\s*p=([^;]*)/);
  ok(
    `[${path}] ${name} carries a public key that is not revoked`,
    Boolean(key && key[1].trim().length > 0),
    key ? "p= is empty, which is the revoked form" : "no p= tag at all",
  );
}

async function main() {
  const from = mailDomain();
  if (!from) return;
  const domain = from.domain;

  console.log("\ncheck:mail\n");
  console.log(`  alert mail leaves as ${from.local}@${domain} (workers/watchdog.ts ALERT_FROM)\n`);

  /* ------------------------------------------------ SENDING: the alert mail */

  await assertSpf("sending", `${BOUNCE_HOST}.${domain}`);
  await assertDkim("sending", `${SENDING_SELECTOR}.${domain}`);

  const dmarcName = `_dmarc.${domain}`;
  const dmarcAnswer = await resolve(dmarcName, "TXT");
  if (!dmarcAnswer.ok) {
    ok(`[sending] DMARC at ${dmarcName} resolves`, false, dmarcAnswer.why);
  } else {
    const dmarc = dmarcAnswer.records.filter((r) => r.toLowerCase().startsWith("v=dmarc1"));
    ok(`[sending] ${dmarcName} publishes exactly one DMARC record`, dmarc.length === 1, `found ${dmarc.length}`);
    if (dmarc.length === 1) {
      const policy = dmarc[0].match(/(?:^|;)\s*p=\s*([a-z]+)/i);
      ok(
        `[sending] ${dmarcName} declares a policy`,
        Boolean(policy),
        "no p= tag, so the record instructs recipients to do nothing",
      );
      /*
       * p=reject SPECIFICALLY, not merely "a policy". The zone has been at
       * reject since before this gate existed, and the failure worth catching
       * is a WEAKENING: a dashboard edit to p=none looks like a valid DMARC
       * record to any check that only asks whether a policy is present.
       */
      ok(
        `[sending] ${dmarcName} is at p=reject`,
        policy?.[1].toLowerCase() === "reject",
        `policy is p=${policy ? policy[1] : "(absent)"}, which is weaker than the ruled value`,
      );
      /*
       * A rua, so failures are OBSERVABLE. Without one, DMARC is enforcing at
       * reject and reporting to nobody, which is the state this zone was in
       * when the gate was written.
       */
      ok(
        `[sending] ${dmarcName} names an aggregate report address`,
        /(?:^|;)\s*rua=\s*mailto:/i.test(dmarc[0]),
        "no rua=mailto:, so nothing is receiving aggregate reports and a delivery " +
          "regression would be invisible",
      );
    }
  }

  /* --------------------------------------- ROUTING: what the domain receives */

  await assertSpf("routing", domain);
  await assertDkim("routing", `${ROUTING_SELECTOR}.${domain}`);

  const mxAnswer = await resolve(domain, "MX");
  if (!mxAnswer.ok) {
    ok(`[routing] MX at ${domain} resolves`, false, mxAnswer.why);
  } else {
    ok(`[routing] ${domain} publishes MX records`, mxAnswer.records.length > 0, "none found");
    const foreign = mxAnswer.records.filter((r) => !/\bmx\.cloudflare\.net\.?$/i.test(r.trim()));
    ok(
      `[routing] every MX at ${domain} is a Cloudflare host`,
      mxAnswer.records.length > 0 && foreign.length === 0,
      `${foreign.join(", ")} is not under mx.cloudflare.net, so inbound mail is not going where this repo thinks`,
    );
  }

  console.log(
    `\n  ${recordsChecked.size} DNS record(s) resolved across both paths: ` +
      `${[...recordsChecked].sort().join(", ")}\n`,
  );

  /*
   * FLOOR ON RECORDS CHECKED, which is the count that matters here.
   *
   * The failure this floors against is a resolver returning early or a path
   * being skipped: every assertion above hangs off a `resolve` call, so a gate
   * that queried nothing would print no failures and report clean. Counting
   * ASSERTIONS alone would not catch it either, because a query that fails
   * closed still increments the assertion count.
   *
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed.
   * Six named records: cf-bounce SPF, cf-bounce DKIM, _dmarc, apex SPF,
   * cf2024-1 DKIM, apex MX. Floored at the full six with no slack, because the
   * set is enumerated in this file rather than discovered, so it cannot drift
   * without someone editing the enumeration.
   */
  const MINIMUM_RECORDS = 6;
  const recordBreach = assertFloor("check:mail", "records", recordsChecked.size, MINIMUM_RECORDS);
  if (recordBreach) ok("[scope] this gate resolved every record it names", false, recordBreach);

  const MINIMUM_CHECKS = 13;
  const checkBreach = assertFloor("check:mail", "checks", checks, MINIMUM_CHECKS);
  if (checkBreach) ok("[scope] this gate executed its assertions", false, checkBreach);

  console.log(`${checks} checks, ${failures} failures\n`);

  /*
   * `exitCode` rather than `process.exit()`, on check:uptime's measurement:
   * `process.exit()` tears the process down while libuv still holds queued
   * stdout writes on Windows and the gate exits 127 with its output lost.
   */
  process.exitCode = failures > 0 ? 1 : 0;
}

await main();
