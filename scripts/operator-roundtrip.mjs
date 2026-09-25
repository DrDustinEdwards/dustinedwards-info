// Two phases because step 3 is a human action: the first publication of a post is reserved to the admin.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { postPath } from "../app/lib/content/pipeline.mjs";

const ORIGIN = process.env.ORIGIN ?? "https://dustinedwards.dustin-edwards.workers.dev";
const TOKEN_FILE = process.env.OPERATOR_TOKEN_FILE;
const SLUG = process.env.THROWAWAY_SLUG ?? "operator-round-trip-probe";
const PHASE = (process.argv[2] ?? "a").toLowerCase();
// Anything else ran neither phase and printed "0 passed, 0 failed" with exit 0.
if (PHASE !== "a" && PHASE !== "b") {
  console.error(`Unknown phase ${JSON.stringify(process.argv[2])}; pass a or b.`);
  process.exit(2);
}

/** Built from its code point so this file never contains the character. */
const EM_DASH = String.fromCharCode(0x2014);

if (!TOKEN_FILE) {
  console.error("Set OPERATOR_TOKEN_FILE to a path holding the operator token.");
  process.exit(2);
}
const TOKEN = readFileSync(TOKEN_FILE, "utf8").trim();
if (TOKEN.length < 32) {
  console.error("The token in OPERATOR_TOKEN_FILE is shorter than 32 characters.");
  process.exit(2);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

let passed = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} ok @param {string} [detail] */
function check(label, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? `\n      ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? `  (${detail})` : ""}`);
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} [args]
 * @returns {Promise<{status: number, body: any}>}
 */
async function tool(name, args = {}) {
  const res = await fetch(`${ORIGIN}/api/operator`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify({ tool: name, args }),
  });
  const text = await res.text();
  /** @type {any} */
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    // A null body made every negated check below (draft === false, absent === false) meaningless.
    throw new Error(
      `${name} answered ${res.status} with a body that is not JSON: ${text.slice(0, 200)}`,
      { cause: error },
    );
  }
  return { status: res.status, body };
}

/**
 * The text only for a 200. Callers must look at the status: an empty string for a 404 or a 5xx
 * reads as "the slug is absent", which is the answer half the checks want.
 *
 * @param {string} path
 * @param {Record<string, string>} [headers]
 */
async function pub(path, headers = {}) {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { "user-agent": UA, "cache-control": "no-cache", ...headers },
    redirect: "manual",
  });
  const text = res.status === 200 ? await res.text() : "";
  return { status: res.status, text };
}

/** @param {boolean} published */
const draft = (published) =>
  [
    "---",
    'title: "Operator round trip probe"',
    `slug: ${SLUG}`,
    'description: "A throwaway post created by the operator round trip. Safe to delete."',
    "date: 2026-07-29",
    "tags: [meta]",
    `draft: ${published ? "false" : "true"}`,
    "---",
    "",
    "## What this is",
    "",
    "A throwaway post written through the operator API to verify the publish path.",
    "It is deleted at the end of the round trip.",
    "",
  ].join("\n");

/**
 * Each surface is true or false only when it answered 200; otherwise it carries the status as a
 * string, which is neither, so an absence check cannot pass on an error page.
 *
 * @returns {Promise<Record<string, any>>}
 */
async function publicSurfaces() {
  /** @type {Record<string, any>} */
  const out = {};
  // The whole document on all six surfaces: a slug present anywhere on an index, feed or manifest is
  // exactly the propagation being asserted.
  for (const [key, path] of /** @type {[string, string][]} */ ([
    ["blogIndex", "/blog"],
    ["rss", "/blog/rss.xml"],
    ["sitemap", "/sitemap.xml"],
    ["llms", "/llms.txt"],
    ["llmsFull", "/llms-full.txt"],
    ["feedJson", "/blog/feed.json"],
  ])) {
    const got = await pub(path);
    out[key] = got.status === 200 ? got.text.includes(SLUG) : `HTTP ${got.status}`;
  }

  // Scope the search assertion to the results themselves: the zero state renders a recent-writing
  // list carrying the same links, so a page-wide match would pass against a zero-result page.
  const search = await pub(`/search?q=${encodeURIComponent("operator round trip probe")}`, {
    accept: "application/json",
  });
  if (search.status !== 200) {
    out.search = `HTTP ${search.status}`;
  } else {
    try {
      const j = JSON.parse(search.text);
      out.search = Array.isArray(j.results)
        ? j.results.some((/** @type {any} */ r) => String(r.url ?? r.slug ?? "").includes(SLUG))
        : "no results array";
    } catch (error) {
      out.search = `unparseable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  out.postPage = (await pub(`/blog/${SLUG}`)).status;
  return out;
}

console.log(`Operator round trip, phase ${PHASE.toUpperCase()}, against ${ORIGIN}`);
console.log(`Throwaway slug: ${SLUG}\n`);

if (PHASE === "a") {
  console.log("1. Operator creates a draft");
  const created = await tool("save_post", { slug: SLUG, raw: draft(false), isNew: true });
  check("save_post returns 200", created.status === 200, JSON.stringify(created.body).slice(0, 200));
  const sha = created.body?.data?.commitSha;
  check("a commit sha came back", Boolean(sha), String(sha));
  check("it reports the post as a draft", created.body?.data?.draft === true);
  check("first_published is null on a draft", created.body?.data?.firstPublished === null);
  if (sha) console.log(`     commit ${sha}`);

  // Verified against GitHub, not against the API's own report. The repo is private, so the read
  // is authenticated with the gh CLI's token; unauthenticated it 404s on a commit that exists.
  if (sha) {
    const ghToken = process.env.GITHUB_TOKEN ?? (() => {
      const t = spawnSync("gh", ["auth", "token"], { encoding: "utf8", shell: process.platform === "win32" });
      return t.status === 0 ? String(t.stdout ?? "").trim() : "";
    })();
    const gh = await fetch(
      `https://api.github.com/repos/DrDustinEdwards/dustinedwards-info/commits/${sha}`,
      {
        headers: {
          "user-agent": UA,
          accept: "application/vnd.github+json",
          ...(ghToken ? { authorization: `Bearer ${ghToken}` } : {}),
        },
      },
    );
    if (gh.status === 200) {
      /** @type {any} */
      const c = await gh.json();
      const files = (c.files ?? []).map((/** @type {any} */ f) => f.filename).sort();
      // Git holds markdown only, so a second file in a save commit is a regression to two writers.
      check(
        "the commit carries EXACTLY the markdown and nothing else",
        files.length === 1 && files[0] === postPath(SLUG),
        files.join(", "),
      );
      check("it is ONE commit, not two", (c.parents ?? []).length === 1);
      check(
        "the message carries the operator marker",
        /\[operator:[0-9a-f]{8}\]/.test(c.commit?.message ?? ""),
        c.commit?.message,
      );
      console.log(`     message: ${String(c.commit?.message ?? "").split("\n")[0]}`);
    } else {
      check(
        "the commit is readable on GitHub",
        false,
        `GitHub answered ${gh.status}${ghToken ? "" : " with no token (set GITHUB_TOKEN or run gh auth login)"}`,
      );
    }
  }

  const got = await tool("get_post", { slug: SLUG });
  check("get_post finds it", got.status === 200);
  check("operatorMayPublish is false", got.body?.data?.operatorMayPublish === false);

  const surfaces = await publicSurfaces();
  console.log(`     surfaces: ${JSON.stringify(surfaces)}`);
  check("draft is ABSENT from /blog", surfaces.blogIndex === false);
  check("draft is ABSENT from rss.xml", surfaces.rss === false);
  check("draft is ABSENT from feed.json", surfaces.feedJson === false);
  check("draft is ABSENT from sitemap.xml", surfaces.sitemap === false);
  check("draft is ABSENT from llms.txt", surfaces.llms === false);
  check("draft is ABSENT from llms-full.txt", surfaces.llmsFull === false);
  check("draft is ABSENT from search", surfaces.search === false);
  check("the post page 404s while draft", surfaces.postPage === 404, `got ${surfaces.postPage}`);

  console.log("\n2. Operator attempts to publish it (MUST be refused)");
  const refused = await tool("save_post", { slug: SLUG, raw: draft(true) });
  check("refused with 403", refused.status === 403, `got ${refused.status}`);
  check(
    "the refusal names the policy",
    refused.body?.detail?.policy === "first-publish-requires-admin",
    JSON.stringify(refused.body?.detail),
  );
  check(
    "the message explains the missing fact and what to do",
    /never been public/i.test(refused.body?.error ?? "") && /admin/i.test(refused.body?.error ?? ""),
    refused.body?.error,
  );
  console.log(`     refusal: ${refused.body?.error}`);

  const stillDraft = await tool("get_post", { slug: SLUG });
  check("the refusal wrote nothing: still a draft", stillDraft.body?.data?.draft === true);
  check("and still has no first_published", stillDraft.body?.data?.firstPublished === null);

  console.log("\n--- PHASE A COMPLETE ---");
  console.log("Dustin: publish this post in the browser editor, then run phase b:");
  console.log(`  ${ORIGIN}/admin/posts/${SLUG}/edit`);
}

if (PHASE === "b") {
  console.log("3. Verifying the human publication");
  const after = await tool("get_post", { slug: SLUG });
  check("the post is no longer a draft", after.body?.data?.draft === false, String(after.body?.data?.draft));
  const stamped = after.body?.data?.firstPublished;
  check("first_published is now stamped", /^\d{4}-\d{2}-\d{2}$/.test(stamped ?? ""), String(stamped));
  check("operatorMayPublish flipped to true", after.body?.data?.operatorMayPublish === true);
  check(
    "the stamp is in the FILE, not just reported",
    (after.body?.data?.raw ?? "").includes("first_published:"),
  );
  console.log(`     first_published: ${stamped}`);

  const live = await publicSurfaces();
  console.log(`     surfaces: ${JSON.stringify(live)}`);
  check("now PRESENT on /blog", live.blogIndex === true);
  check("now PRESENT in rss.xml", live.rss === true);
  check("now PRESENT in sitemap.xml", live.sitemap === true);
  check("the post page serves 200", live.postPage === 200, `got ${live.postPage}`);

  console.log("\n4. Operator edits the now-live post");
  // An empty raw would be sent to the PRODUCTION save_post as the whole file.
  if (typeof after.body?.data?.raw !== "string" || after.body.data.raw.length === 0) {
    console.error("get_post returned no raw file, so there is nothing safe to edit. Stopping.");
    process.exit(1);
  }
  const edited = after.body.data.raw.replace(
    "A throwaway post written through the operator API to verify the publish path.",
    "Edited by the operator after publication, to prove editing a live post is allowed.",
  );
  const edit = await tool("save_post", { slug: SLUG, raw: edited });
  check("the edit is allowed", edit.status === 200, JSON.stringify(edit.body).slice(0, 200));
  check(
    "first_published is UNCHANGED",
    edit.body?.data?.firstPublished === stamped,
    String(edit.body?.data?.firstPublished),
  );
  const page = await pub(`/blog/${SLUG}`);
  // The needle is a distinctive sentence written into the post body, so it cannot appear in chrome or another post.
  check("the live page shows the edit", page.text.includes("Edited by the operator after publication"));

  console.log("\n5. Operator unpublishes, then republishes");
  const unpub = await tool("save_post", {
    slug: SLUG,
    raw: edited.replace("draft: false", "draft: true"),
  });
  check("unpublish is allowed", unpub.status === 200, JSON.stringify(unpub.body).slice(0, 160));
  check("first_published SURVIVES the unpublish", unpub.body?.data?.firstPublished === stamped);
  const gone = await pub(`/blog/${SLUG}`);
  check("the post 404s while unpublished", gone.status === 404, `got ${gone.status}`);

  const repub = await tool("save_post", { slug: SLUG, raw: edited });
  check(
    "REPUBLISH is allowed, because first_published exists",
    repub.status === 200,
    JSON.stringify(repub.body).slice(0, 200),
  );
  const back = await pub(`/blog/${SLUG}`);
  check("the post is live again", back.status === 200, `got ${back.status}`);

  console.log("\n6. Forgery: a NEW post carrying first_published in the payload");
  const forgedSlug = `${SLUG}-forged`;
  const forged = [
    "---",
    'title: "Forgery probe"',
    `slug: ${forgedSlug}`,
    'description: "Should never be created as published."',
    "date: 2026-07-29",
    "tags: [meta]",
    "draft: false",
    "first_published: 2020-01-01",
    "---",
    "",
    "Body.",
    "",
  ].join("\n");
  const forgeRes = await tool("save_post", { slug: forgedSlug, raw: forged, isNew: true });
  check("forgery refused with 403", forgeRes.status === 403, `got ${forgeRes.status}`);
  check(
    "refused by the first-publish policy",
    forgeRes.body?.detail?.policy === "first-publish-requires-admin",
    JSON.stringify(forgeRes.body?.detail),
  );
  const forgedGet = await tool("get_post", { slug: forgedSlug });
  check("and no file was created", forgedGet.status === 404, `got ${forgedGet.status}`);

  console.log("\n7. Wide-dash save via the API");
  const withDash = edited.replace(
    "Edited by the operator after publication",
    `Edited ${EM_DASH} by the operator ${EM_DASH} after publication`,
  );
  const dashRes = await tool("save_post", { slug: SLUG, raw: withDash });
  check("wide-dash save rejected with 422", dashRes.status === 422, `got ${dashRes.status}`);
  check(
    "the rejection names a line",
    Number.isInteger(dashRes.body?.detail?.line),
    JSON.stringify(dashRes.body?.detail),
  );
  check(
    "the message names the character and the column",
    /U\+2014/.test(dashRes.body?.error ?? "") && /column/i.test(dashRes.body?.error ?? ""),
    dashRes.body?.error,
  );
  console.log(`     ${dashRes.body?.error}`);
  const unchanged = await tool("get_post", { slug: SLUG });
  check("no commit happened: content unchanged", !(unchanged.body?.data?.raw ?? "").includes(EM_DASH));

  console.log("\n8. Rate limit (concurrent burst, never sequential)");
  // Sequential is the recorded trap: a sequential burst against the same limit produced ZERO
  // refusals, the loop straddling the window boundary, which reads exactly like a dead limiter.
  const burst = await Promise.all(
    // A request that failed outright is counted as 0 and asserted on below, not read as "no 5xx".
    Array.from({ length: 45 }, () => tool("sync_status").then((r) => r.status).catch(() => 0)),
  );
  /** @type {Record<string, number>} */
  const tally = burst.reduce(
    (/** @type {Record<string, number>} */ acc, s) => ((acc[s] = (acc[s] ?? 0) + 1), acc),
    {},
  );
  console.log(`     statuses: ${JSON.stringify(tally)}`);
  check("the burst produced 429s", (tally[429] ?? 0) > 0, JSON.stringify(tally));
  check("no 5xx under load", !Object.keys(tally).some((s) => Number(s) >= 500), JSON.stringify(tally));
  check("no request failed outright under load", (tally[0] ?? 0) === 0, JSON.stringify(tally));

  console.log("\n9. Operator deletes the throwaway");
  // The burst may have consumed the window, so wait it out rather than reporting a rate-limit
  // refusal as a delete failure.
  console.log("     waiting out the rate-limit window");
  await new Promise((r) => setTimeout(r, 62000));
  const del = await tool("delete_post", { slug: SLUG });
  check("delete returns 200", del.status === 200, JSON.stringify(del.body).slice(0, 200));
  check("a delete commit sha came back", Boolean(del.body?.data?.commitSha));
  if (del.body?.data?.commitSha) console.log(`     commit ${del.body.data.commitSha}`);

  const after404 = await pub(`/blog/${SLUG}`);
  check("the post page 404s", after404.status === 404, `got ${after404.status}`);
  const gone2 = await tool("get_post", { slug: SLUG });
  check("get_post 404s", gone2.status === 404, `got ${gone2.status}`);
  const finalSurfaces = await publicSurfaces();
  console.log(`     surfaces: ${JSON.stringify(finalSurfaces)}`);
  check(
    "absent from every public surface",
    Object.entries(finalSurfaces).every(([k, v]) => (k === "postPage" ? v === 404 : v === false)),
  );

  console.log("\nHistory is preserved: the delete is a new commit, never a rewrite.");
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
