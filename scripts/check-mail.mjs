/**
 * Gate over the DNS records that make the watchdog's alert mail authenticate.
 *
 *   npm run check:mail
 *
 * BOUNDARY: it proves the records are PUBLISHED AND WELL FORMED over live DNS, never that a
 * message authenticates, which only a received message's headers can, and a published key that no
 * longer matches the private one is indistinguishable from a good one here.
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
 * The argument order every gate here uses, and NOT a style preference: the first version took the
 * path first, so a string sat in the condition slot and every assertion would have passed forever.
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
 * THE MAIL DOMAIN, read from its one owner, anchored on the DECLARATION rather than an
 * address-shaped string. Hard rule 10: stripping comments is not enough, the needle has to name
 * the binding.
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
   * RETRIED, and measured rather than defensive: one query of six failed on the transport while the
   * other five answered. TRANSPORT FAILURES ONLY, and an answered query is never retried however
   * unwelcome: retrying a finding until it changes is how a gate is talked out of a true failure.
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
    // A TXT record over the size limit reaches the wire as several quoted strings and MUST be
    // concatenated: a DKIM key is always over it.
    .map((/** @type {any} */ a) =>
      String(a.data)
        .replace(/"\s+"/g, "")
        .replace(/^"|"$/g, ""),
    );
  return { ok: true, records: answers };
}

/**
 * SPF, asserted the same way on both paths. EXACTLY ONE record: two on one name is a permanent
 * error under the RFC and resolves to neither.
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
 * DKIM, by selector, checked for PRESENCE and NON-EMPTINESS: an empty value is the documented way
 * to REVOKE a key and is valid syntax.
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

  /* SENDING: the alert mail */

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
       * The strict policy SPECIFICALLY, not merely "a policy": the failure worth catching is a
       * WEAKENING, which looks valid to any check that asks only whether a record is present.
       */
      ok(
        `[sending] ${dmarcName} is at p=reject`,
        policy?.[1].toLowerCase() === "reject",
        `policy is p=${policy ? policy[1] : "(absent)"}, which is weaker than the ruled value`,
      );
      /*
       * A reporting address, so failures are OBSERVABLE: without one the policy is enforcing and
       * reporting to nobody, which is the state this zone was in.
       */
      ok(
        `[sending] ${dmarcName} names an aggregate report address`,
        /(?:^|;)\s*rua=\s*mailto:/i.test(dmarc[0]),
        "no rua=mailto:, so nothing is receiving aggregate reports and a delivery " +
          "regression would be invisible",
      );
    }
  }

  /* ROUTING: what the domain receives */

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
   * FLOOR ON RECORDS CHECKED: every assertion hangs off a resolve call, so a gate that queried
   * nothing reports clean, and counting ASSERTIONS would not catch it because a query that fails
   * closed still increments. MEASURED BY RUNNING IT, with no slack, the set being enumerated here.
   */
  const MINIMUM_RECORDS = 6;
  const recordBreach = assertFloor("check:mail", "records", recordsChecked.size, MINIMUM_RECORDS);
  if (recordBreach) ok("[scope] this gate resolved every record it names", false, recordBreach);

  const MINIMUM_CHECKS = 13;
  const checkBreach = assertFloor("check:mail", "checks", checks, MINIMUM_CHECKS);
  if (checkBreach) ok("[scope] this gate executed its assertions", false, checkBreach);

  console.log(`${checks} checks, ${failures} failures\n`);

  /* `exitCode` rather than `process.exit()`, which tears the process down mid stdout write. */
  process.exitCode = failures > 0 ? 1 : 0;
}

await main();
