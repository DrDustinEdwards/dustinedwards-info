/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Gate: the site as a browser lays it out, not as markup.
 *
 *   npm run check:browser
 *   npm run check:browser -- --keep    leave the preview server running
 *
 * Chromium only. Public cases drive a preview build of this disk (the dev server
 * serves the page unstyled), or the deployed site when `PUBLIC_ORIGIN` is set.
 * Admin cases always drive `ADMIN_ORIGIN`, because sessions live in production KV;
 * absent credentials skip, unusable ones fail. Nothing is submitted.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer, { PredefinedNetworkConditions } from "puppeteer";

import { assertFloor } from "./lib/floor.mjs";
import { HEALTH_FACT_SELECTOR, freshHealthRatio } from "./lib/health-tile.mjs";

/* The network profile the /blog layout shift was measured on. */
const SLOW_4G = PredefinedNetworkConditions["Slow 4G"];

/* Imported, never restated (`check:invariants` section 25). */
import { HEALTH_POLL_INTERVAL_SECONDS } from "../app/lib/health/snapshot.mjs";
import {
  ChildRegistry,
  descendantPids,
  killTree,
  normaliseCommand,
  portListeners,
  readProcessTable,
} from "./lib/child-processes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;

/**
 * Needles a live command line must still match before this gate kills it. Declared
 * here because the port preflight needs them before any spawn.
 */
const VITE_NEEDLES = ["vite", "preview", String(PORT)];

/**
 * What this gate started, so the next run can clear what a hard kill left behind.
 * Gitignored, or `npm run ship` would refuse the dirty tree.
 */
const registry = new ChildRegistry(join(root, ".gate-pids", "check-browser.jsonl"));

/** Unset: public cases observe this disk. Set: they observe the deployed site. */
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "");
/** Whether this run builds and serves the working tree. */
const DRIVES_PREVIEW = !PUBLIC_ORIGIN;
const BASE = PUBLIC_ORIGIN || `http://localhost:${PORT}`;

/**
 * The admin cookie, `name=value`, from `ADMIN_SESSION_COOKIE` or `.admin-session`. There is no
 * test-only auth bypass: the defects these cases catch live in the real authenticated render.
 * Never infer the name from an `=`: base64 padding puts one in a bare token.
 */
const SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";
const SESSION_FILE = join(root, ".admin-session");
const SESSION_EXAMPLE = ".admin-session.example";

/**
 * Reads the session file, or null. An unrecognised line is the cookie itself.
 *
 * @param {string} path
 */
function readSessionFile(path) {
  if (!existsSync(path)) return null;
  /** @type {{ cookie: string, origin: string }} */
  const out = { cookie: "", origin: "" };
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (key === "origin") out.origin = value;
    else if (key === "cookie") out.cookie = value;
    else out.cookie = trimmed;
  }
  return out;
}

/**
 * Turns a pair or a whole `Cookie:` header into one pair, or an error that names
 * cookies and never prints a value.
 *
 * @param {string} raw
 * @returns {{ pair: string, error: string }}
 */
function sessionPair(raw) {
  const value = raw.trim();
  if (!value) return { pair: "", error: "" };

  /* Checked first: the placeholder is well formed and would read as an expired session. */
  if (value.includes("PASTE_THE_VALUE_HERE")) {
    return {
      pair: "",
      error:
        `the placeholder from ${SESSION_EXAMPLE} is still in place, so the file was copied ` +
        `but no cookie was ever pasted into it.`,
    };
  }

  // The one unambiguous case: no `=` anywhere is a bare token, so name it.
  if (!value.includes("=")) return { pair: `${SESSION_COOKIE_NAME}=${value}`, error: "" };

  const pairs = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      return eq === -1 ? { name: part, rest: "" } : { name: part.slice(0, eq).trim(), rest: part };
    });

  const found = pairs.find((c) => c.name === SESSION_COOKIE_NAME);
  if (found) return { pair: found.rest, error: "" };

  /* Print only name-shaped segments: a bare token parsed as a pair is its own name. */
  const safeName = (/** @type {string} */ n) =>
    /^(__Secure-|__Host-)?[A-Za-z0-9_.-]{1,32}$/.test(n) && !/^[A-Za-z0-9+/]{24,}$/.test(n)
      ? JSON.stringify(n)
      : `<${n.length}-char segment, redacted: not shaped like a cookie name>`;

  const names = pairs.map((c) => c.name).filter(Boolean);
  return {
    pair: "",
    error:
      `no cookie named ${SESSION_COOKIE_NAME} in a ${value.length}-character value. ` +
      `Found ${names.length ? names.map(safeName).join(", ") : "no name at all"}. ` +
      `A bare value is only accepted when it carries no "=" at all: with one, it cannot be told ` +
      `apart from a name=value pair, and splitting at base64 padding produces an empty session.`,
  };
}

const fileSession = readSessionFile(SESSION_FILE);
const RAW_COOKIE = process.env.ADMIN_SESSION_COOKIE ?? fileSession?.cookie ?? "";
const COOKIE_SOURCE = process.env.ADMIN_SESSION_COOKIE
  ? "the ADMIN_SESSION_COOKIE environment variable"
  : `.admin-session`;
const { pair: ADMIN_COOKIE, error: COOKIE_ERROR } = sessionPair(RAW_COOKIE);

/** Names the source read: a set `ADMIN_SESSION_COOKIE` overrides the file. */
const REFILL_HINT = process.env.ADMIN_SESSION_COOKIE
  ? `ADMIN_SESSION_COOKIE is set in this shell and OVERRIDES the file. Update it, or unset ` +
    `it to fall back to .admin-session. ${SESSION_EXAMPLE} has the five Chrome clicks.`
  : `refill .admin-session. ${SESSION_EXAMPLE} has the five Chrome clicks.`;

/** The admin origin, not the preview: preview KV cannot hold a production session. */
const ADMIN_ORIGIN = (process.env.ADMIN_ORIGIN ?? fileSession?.origin ?? "").replace(/\/+$/, "");

/**
 * The read-only smoke token, from `SMOKE_TOKEN_FILE` or `.smoke-token`; never printed.
 * A named file that is missing, or an unusable one, fails rather than falling back.
 */
const SMOKE_TOKEN_ENV = process.env.SMOKE_TOKEN_FILE;
const SMOKE_TOKEN_PATH = SMOKE_TOKEN_ENV ?? join(root, ".smoke-token");
const SMOKE_SOURCE = SMOKE_TOKEN_ENV ? `SMOKE_TOKEN_FILE (${SMOKE_TOKEN_ENV})` : ".smoke-token";
/** The Worker's own floor, restated here so a short token fails before a request. */
const SMOKE_MIN_LENGTH = 32;

let SMOKE_TOKEN = "";
let SMOKE_ERROR = "";
if (existsSync(SMOKE_TOKEN_PATH)) {
  SMOKE_TOKEN = readFileSync(SMOKE_TOKEN_PATH, "utf8").trim();
  if (!SMOKE_TOKEN) {
    SMOKE_ERROR = `${SMOKE_SOURCE} exists and is empty. Mint one: node scripts/mint-smoke-token.mjs > .smoke-token`;
  } else if (SMOKE_TOKEN.length < SMOKE_MIN_LENGTH) {
    SMOKE_ERROR =
      `the token in ${SMOKE_SOURCE} is ${SMOKE_TOKEN.length} characters and the Worker ` +
      `requires at least ${SMOKE_MIN_LENGTH}, so it would be refused before it was compared.`;
  }
} else if (SMOKE_TOKEN_ENV) {
  SMOKE_ERROR =
    `SMOKE_TOKEN_FILE points at ${SMOKE_TOKEN_ENV}, which does not exist. Naming a path is a ` +
    `request for the smoke path, so this is a failure rather than a fall back to the cookie.`;
}

/** Whether the smoke path was ASKED for, which is not the same as usable. */
const SMOKE_REQUESTED = Boolean(SMOKE_TOKEN || SMOKE_ERROR);

/** Smoke wins because it runs unattended; the cookie remains a full fallback. */
const CREDENTIAL = SMOKE_REQUESTED ? "smoke" : "cookie";
const CREDENTIAL_PRESENT = SMOKE_REQUESTED || Boolean(RAW_COOKIE);
const CREDENTIAL_ERROR = SMOKE_REQUESTED ? SMOKE_ERROR : COOKIE_ERROR;
const CREDENTIAL_SOURCE = SMOKE_REQUESTED ? SMOKE_SOURCE : COOKIE_SOURCE;

/**
 * Uses the cookie jar: a pinned `Cookie` header fights Better Auth's refresh.
 *
 * @param {import("puppeteer").Page} page
 * @param {string} origin
 */
async function applySession(page, origin) {
  const eq = ADMIN_COOKIE.indexOf("=");
  await page.setCookie({
    url: origin,
    name: ADMIN_COOKIE.slice(0, eq),
    value: ADMIN_COOKIE.slice(eq + 1),
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
}

/**
 * A pinned header is safe here: a bearer token has no refresh to fight.
 *
 * @param {import("puppeteer").Page} page
 */
async function applySmoke(page) {
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${SMOKE_TOKEN}` });
}

/**
 * Applies whichever credential this run selected. ONE NAME, ONE ARGUMENT ORDER.
 *
 * @param {import("puppeteer").Page} page
 * @param {string} origin
 */
async function applyCredential(page, origin) {
  if (CREDENTIAL === "smoke") await applySmoke(page);
  else await applySession(page, origin);
}

/**
 * `redirect: "manual"`: a followed 302 to /login reports 200.
 *
 * @param {string} origin
 */
async function credentialAuthenticates(origin) {
  try {
    const res = await fetch(`${origin}/admin`, {
      headers:
        CREDENTIAL === "smoke"
          ? { authorization: `Bearer ${SMOKE_TOKEN}` }
          : { cookie: ADMIN_COOKIE },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    /* The status is kept: each smoke refusal status needs a different repair. */
    return { ok: res.status === 200, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

/**
 * The repair a refused smoke credential needs, named from its status.
 *
 * @param {number} status
 */
function smokeRepair(status) {
  if (status === 401) {
    return (
      `401: the deployment did not recognize this token. The SMOKE_TOKEN wrangler secret and ` +
      `${SMOKE_SOURCE} have drifted apart. Re-set it: npx wrangler secret put SMOKE_TOKEN < .smoke-token`
    );
  }
  if (status === 503) {
    return (
      `503: SMOKE_TOKEN is not set on this deployment at all, so the credential is not ` +
      `configured rather than wrong. Set it: npx wrangler secret put SMOKE_TOKEN < .smoke-token`
    );
  }
  if (status === 429) {
    return `429: rate limited. A previous run left the window full; wait a minute and re-run.`;
  }
  if (status === 302 || status === 301) {
    return (
      `${status}: redirected, which means the middleware never saw a bearer token. Either this ` +
      `deployment predates the smoke credential, or something stripped the Authorization header.`
    );
  }
  return `status ${status || "(no response)"}`;
}

let checks = 0;
let failures = 0;
const skipped = [];

/** Not `skipped.length`: that cannot tell a rejected session from a completed run. */
let adminCasesRan = false;

/**
 * The pre-check's full result, so a failure can name a repair.
 *
 * @type {{ ok: boolean, status: number, error?: string }}
 */
let AUTH_RESULT = { ok: false, status: 0 };

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/**
 * Fails one case on a missing selector, where `page.click` would end the run.
 *
 * @param {any} target a Page or a Frame
 * @param {string} selector
 * @param {string} label what the click is for, used in the failure line
 * @returns {Promise<boolean>} whether the click happened
 */
async function clickOrFail(target, selector, label) {
  const handle = await target.$(selector);
  if (!handle) {
    ok(
      label,
      false,
      `no element matches ${selector}. The selector has moved or the control is gone. ` +
        `Every later case still ran, which is the point of failing here rather than throwing.`,
    );
    return false;
  }
  await handle.click();
  return true;
}

/** @param {string} label @param {string} why */
function skip(label, why) {
  skipped.push(label);
  console.log(`  SKIP  ${label}\n        ${why}`);
}

/**
 * A measured fact that is neither a pass nor a failure.
 *
 * @param {string} what
 */
function report(what) {
  console.log(`  REPORT  ${what}`);
}

/* ------------------------------------------------------------- the server */

console.log("\ncheck:browser\n");

/*
 * Preflight: clear the last run's leftovers, reported even at zero. A pid whose
 * command line no longer matches is dropped, never killed: pids are reused.
 */
{
  const swept = registry.preflight();
  const parts = [`${swept.cleared} cleared`, `${swept.stale} stale`, `${swept.reused} reused`];
  if (swept.failed > 0) parts.push(`${swept.failed} FAILED TO KILL`);
  if (swept.unverifiable > 0) parts.push(`${swept.unverifiable} unverifiable`);
  console.log(`  preflight: last run's children, ${parts.join(", ")}`);
  for (const note of swept.notes) console.log(`    ${note}`);
}

/*
 * Preflight, second half: ask the OS who holds the port, which the registry may
 * not know. Kill only a `VITE_NEEDLES` match; anything else refuses the run.
 */
if (DRIVES_PREVIEW) {
  const holders = portListeners(PORT);
  if (holders === null) {
    // An unreadable listing is reported, not treated as free or as fatal.
    console.log(`  preflight: port ${PORT} could NOT be probed, so a holder would go unseen`);
  } else if (holders.length === 0) {
    console.log(`  preflight: port ${PORT} probed directly, 0 holders`);
  } else {
    const table = readProcessTable();
    /** @type {{ pid: number, command: string }[]} */
    const strangers = [];
    let killed = 0;
    for (const pid of holders) {
      const live = table.get(pid);
      const matches =
        live && VITE_NEEDLES.every((needle) => live.command.includes(normaliseCommand(needle)));
      if (!matches) {
        strangers.push({ pid, command: live?.command ?? "(no command line could be read)" });
        continue;
      }
      if (killTree(pid)) killed += 1;
      else strangers.push({ pid, command: `${live.command} (matched, but the kill reported no success)` });
    }

    if (strangers.length > 0) {
      console.error(
        `\ncheck:browser REFUSES TO START. Port ${PORT} is held by a process this gate did not launch.`,
      );
      for (const stranger of strangers) {
        console.error(`  pid ${stranger.pid}: ${stranger.command}`);
      }
      console.error(
        "  Nothing was killed. Stop it yourself, or run with PUBLIC_ORIGIN set to drive a deployed origin.",
      );
      registry.clear();
      process.exit(1);
    }

    /* `taskkill` returns before the socket is released, so re-probe until clear. */
    const releasedBy = Date.now() + 5000;
    let stillHeld = portListeners(PORT) ?? [];
    while (stillHeld.length > 0 && Date.now() < releasedBy) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      stillHeld = portListeners(PORT) ?? [];
    }
    if (stillHeld.length > 0) {
      console.error(
        `\ncheck:browser REFUSES TO START. Port ${PORT} was still held after killing ${killed} leftover(s): ${stillHeld.join(", ")}`,
      );
      registry.clear();
      process.exit(1);
    }
    console.log(
      `  preflight: port ${PORT} probed directly, ${killed} leftover preview server(s) cleared, port released`,
    );
  }
}

/* Registered first: killing its wrappers orphans this process. */
registry.record(process.pid, "the check:browser gate", ["check-browser.mjs"]);

/* Builds rather than trusting build/, which may be stale. */
if (DRIVES_PREVIEW) {
  console.log("  building ...");
  // Enhancement bundles first: the app build imports them, and this gate runs alone.
  const bundled = spawnSync("npm", ["run", "build:enhance"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (bundled.status !== 0) {
    console.error("check:browser failed. build:enhance did not succeed, so the build below cannot.");
    console.error((bundled.stderr || bundled.stdout || "").slice(-1200));
    // `cleanupChildren` is still in its temporal dead zone here.
    registry.clear();
    process.exit(1);
  }
  const built = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (built.status !== 0) {
    console.error("check:browser failed. the build did not succeed, so there is nothing to lay out.");
    console.error((built.stderr || built.stdout || "").slice(-1200));
    registry.clear();
    process.exit(1);
  }
} else {
  // Said out loud, so a missing "building" line is not misread.
  console.log(`  NOT building: the public cases observe ${PUBLIC_ORIGIN}, a deployed site.`);
}

/*
 * Seeded mentions give the THEME_CACHED byte-identity case markup to cover.
 * Hand-written: the endpoint refuses the hostile row `safeHttpHref` must render.
 */
const MENTION_POST_PATH = "/blog/ten-years-on-cloudflare";
const MENTION_SLUG = MENTION_POST_PATH.slice("/blog/".length);
/** The seed's own source prefix, so the cleanup below can name its own rows. */
const MENTION_SEED_PREFIX = "https://gate.example/";
/** A fixed instant, so the rendered date is the same in every fetch. */
const MENTION_DECIDED_AT = Math.floor(Date.UTC(2026, 7, 20) / 1000);
/** The hostile author name. Stored as these characters and rendered as them. */
const MENTION_HOSTILE_NAME = "<script>alert(1)</script>";

/** How many rows the seed writes. Asserted, so a silent failure is not a pass. */
const MENTION_SEED_ROWS = 2;

if (DRIVES_PREVIEW) {
  /* Delete then insert, so the count means this run wrote the rows. */
  const sql = [
    `DELETE FROM webmentions WHERE source_url LIKE '${MENTION_SEED_PREFIX}%'`,
    `INSERT INTO webmentions ` +
      `(source_url, target_slug, status, author_name, author_url, excerpt, received_at, decided_at) VALUES ` +
      `('${MENTION_SEED_PREFIX}ordinary', '${MENTION_SLUG}', 'approved', 'A Reader', ` +
      `'https://gate.example/about', 'A sentence somebody wrote about this post.', ` +
      `${MENTION_DECIDED_AT}, ${MENTION_DECIDED_AT})`,
    `INSERT INTO webmentions ` +
      `(source_url, target_slug, status, author_name, author_url, excerpt, received_at, decided_at) VALUES ` +
      `('${MENTION_SEED_PREFIX}hostile', '${MENTION_SLUG}', 'approved', '${MENTION_HOSTILE_NAME}', ` +
      `'javascript:alert(1)', 'An excerpt from a page that cannot be linked to.', ` +
      `${MENTION_DECIDED_AT - 60}, ${MENTION_DECIDED_AT - 60})`,
  ].join("; ");

  /* One quoted string: with `shell: true` on Windows an argv array is joined unquoted. */
  const seeded = spawnSync(
    `npx wrangler d1 execute dustinedwards --local --command "${sql}"`,
    { cwd: root, encoding: "utf8", shell: true, maxBuffer: 16 * 1024 * 1024 },
  );
  if (seeded.status !== 0) {
    console.error("check:browser failed. the mention seed did not apply, so the byte-identity");
    console.error("case below would compare two renders of a page with no Mentions section.");
    console.error((seeded.stderr || seeded.stdout || "").slice(-1200));
    registry.clear();
    process.exit(1);
  }
  console.log(`  seeded ${MENTION_SEED_ROWS} approved mention(s) on ${MENTION_POST_PATH}`);
}

/*
 * The draft math fixture is reached through a seeded `/preview/:token`, since
 * offline markup cannot prove rendering (hard rule 7). `--file`, because the
 * HTML's double quotes would break a cmd command string.
 */
const MATH_SLUG = "math-typesetting-fixture";
/** Fixed, so a re-run overwrites one KV record. `isWellFormedToken` is length-exact. */
const MATH_PREVIEW_TOKEN = "gate0000000000000000000000000000000000math0";
/** A post with no math, for the paired control. Already driven by other cases. */
const MATHLESS_POST_PATH = "/blog/ten-years-on-cloudflare";

/** True once both rows are written, so the cases can SKIP rather than fail. */
let mathPreviewSeeded = false;

if (DRIVES_PREVIEW) {
  const artifact = JSON.parse(
    readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
  );
  const fixture = artifact.posts.find((/** @type {any} */ p) => p.slug === MATH_SLUG);

  /* Fails rather than skips: `check:content` already requires the fixture. */
  if (!fixture) {
    console.error(
      `check:browser failed. content/generated/posts.json carries no post "${MATH_SLUG}", ` +
        `so the math cases below would have no page to visit. Run npm run build:content.`,
    );
    registry.clear();
    process.exit(1);
  }
  if (fixture.draft !== true) {
    console.error(
      `check:browser failed. "${MATH_SLUG}" is not a draft. The fixture must stay ` +
        `unpublished (it is a fixture), and the preview door below only opens for a draft.`,
    );
    registry.clear();
    process.exit(1);
  }

  /** SQL string literal: the only escaping a --file path needs. */
  const q = (/** @type {unknown} */ v) =>
    v === null || v === undefined ? "NULL" : `'${String(v).split("'").join("''")}'`;

  const publishAt = Math.floor(new Date(fixture.publishAt).getTime() / 1000);
  const sqlFile = join(mkdtempSync(join(tmpdir(), "gate-math-")), "seed.sql");
  writeFileSync(
    sqlFile,
    [
      `DELETE FROM posts WHERE slug = ${q(MATH_SLUG)};`,
      `INSERT INTO posts (slug, kind, title, body, status, publish_at, html, description, ` +
        `toc, reading_time_minutes, source_path, featured) VALUES (` +
        [
          q(fixture.slug),
          q("post"),
          q(fixture.title),
          q(fixture.markdown),
          q("draft"),
          String(publishAt),
          q(fixture.html),
          q(fixture.description),
          q(JSON.stringify(fixture.toc)),
          String(fixture.readingTimeMinutes ?? 1),
          q(fixture.sourcePath),
          "0",
        ].join(", ") +
        `);`,
    ].join("\n"),
    "utf8",
  );

  const row = spawnSync(
    `npx wrangler d1 execute dustinedwards --local --file "${sqlFile}"`,
    { cwd: root, encoding: "utf8", shell: true, maxBuffer: 16 * 1024 * 1024 },
  );
  if (row.status !== 0) {
    console.error("check:browser failed. the math fixture row did not apply, so /preview");
    console.error("would answer 404 and every math case below would report the wrong cause.");
    console.error((row.stderr || row.stdout || "").slice(-1200));
    registry.clear();
    process.exit(1);
  }

  /* `resolvePreview` re-checks post status, so a stale record cannot leak. */
  const record = JSON.stringify({
    slug: MATH_SLUG,
    createdAt: Date.UTC(2026, 8, 6),
    label: "check:browser math fixture",
  });
  const kv = spawnSync(
    `npx wrangler kv key put --binding APP_KV --local ` +
      `"preview:token:${MATH_PREVIEW_TOKEN}" "${record.split('"').join('\\"')}"`,
    { cwd: root, encoding: "utf8", shell: true, maxBuffer: 8 * 1024 * 1024 },
  );
  if (kv.status !== 0) {
    console.error("check:browser failed. the preview token did not reach local KV.");
    console.error((kv.stderr || kv.stdout || "").slice(-1200));
    registry.clear();
    process.exit(1);
  }

  mathPreviewSeeded = true;
  console.log(`  seeded the ${MATH_SLUG} draft row and its preview token`);
}

/* A ring buffer of server output, so a startup failure can show its cause. */
/** @type {string[]} */
const serverLog = [];
const SERVER_LOG_LINES = 40;
/** @param {unknown} chunk */
const recordServerOutput = (chunk) => {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.trim()) serverLog.push(line.trimEnd());
  }
  if (serverLog.length > SERVER_LOG_LINES) {
    serverLog.splice(0, serverLog.length - SERVER_LOG_LINES);
  }
};

/* Without `--strictPort` vite binds the next port and the gate grades a stale server. */
const server = DRIVES_PREVIEW
  ? spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
      cwd: root,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    })
  : null;
server?.stdout?.on("data", recordServerOutput);
server?.stderr?.on("data", recordServerOutput);
server?.on("error", (error) => recordServerOutput(`spawn failed: ${error.message}`));

/* This pid is the shell, which dies with the gate; survivors are recorded later. */
if (server?.pid) registry.record(server.pid, "the vite preview server", VITE_NEEDLES);

/* A dead server and a booting one look alike to a fetch, so exit ends the wait. */
let serverExit = /** @type {{ code: number | null, signal: string | null } | null} */ (null);
server?.on("exit", (code, signal) => {
  serverExit = { code, signal };
});

/**
 * Polls until the server answers. The bound is generous: a dead server ends the
 * wait at once, so only a live, slow one pays it.
 */
/** What a deployed origin said, when it said something. Read by the diagnosis. */
let originStatus = /** @type {number | null} */ (null);
/** What the readiness probe last saw, so a timeout names what it waited on. */
/** @type {{ state: string, detail: string }} */
let readiness = { state: "not-started", detail: "the probe has not run" };

/** What a deployed origin threw, when it could not be reached at all. */
let originError = "";

async function waitForServer(timeoutMs = 180_000) {
  const started = Date.now();

  /* A deployed origin is not booting: one attempt, status reported, no retry. */
  if (!DRIVES_PREVIEW) {
    try {
      const res = await fetch(`${BASE}/blog`, { signal: AbortSignal.timeout(10_000) });
      originStatus = res.status;
      if (res.ok) {
        console.log(`  ${BASE} answered in ${Date.now() - started}ms`);
        return true;
      }
    } catch (error) {
      originError = error instanceof Error ? error.message : String(error);
    }
    return false;
  }

  const deadline = started + timeoutMs;
  /*
   * Survivors are recorded on every poll, since a kill during startup is the case
   * the registry exists for. Throttled: reading the process table is expensive.
   */
  let lastCapture = 0;
  const CAPTURE_INTERVAL_MS = 2000;
  while (Date.now() < deadline) {
    if (Date.now() - lastCapture >= CAPTURE_INTERVAL_MS) {
      recordServerSurvivors();
      lastCapture = Date.now();
    }
    try {
      const res = await fetch(`${BASE}/blog`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        console.log(`  preview server answered in ${Date.now() - started}ms`);
        recordServerSurvivors();
        return true;
      }
      // Answered and said no: a wrong probe path, not a slow boot.
      readiness = { state: "answered-not-ok", detail: `HTTP ${res.status} on ${BASE}/blog` };
    } catch (error) {
      /* ECONNREFUSED is still booting, a timeout is a wedge, anything else verbatim. */
      const cause = /** @type {any} */ (error);
      const code = cause?.cause?.code ?? cause?.name ?? String(error);
      readiness =
        code === "ECONNREFUSED"
          ? { state: "no-listener", detail: "connection refused: nothing is bound yet" }
          : code === "TimeoutError" || code === "HeadersTimeoutError"
            ? { state: "bound-silent", detail: "a listener accepted the connection and did not reply" }
            : { state: "unreachable", detail: String(code) };
    }
    // Gone, so waiting cannot help; the caller prints its output.
    if (serverExit) {
      readiness = {
        state: "exited",
        detail: `the server process exited with code ${serverExit.code}, signal ${serverExit.signal}`,
      };
      return false;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

/** The server's state and last output; an empty capture says so. */
function serverDiagnosis() {
  /* The state first: it decides what to do next. */
  const verdict =
    readiness.state === "no-listener"
      ? "STILL BOOTING when the ceiling expired: nothing had bound the port yet. MEASURED on a " +
        "clear machine this boot takes about 51s and prints its Local URL 25s before it serves; " +
        "on a loaded one it has run past the 180s ceiling. That is the machine, not a defect."
      : readiness.state === "bound-silent"
        ? "WEDGED: a listener accepted the connection and never replied. That is the server, not the ceiling."
        : readiness.state === "answered-not-ok"
          ? "ANSWERING AND REFUSING: the probe path is reachable and returned a non-ok status, which " +
            "is a wrong probe path rather than a dead server."
          : readiness.state === "exited"
            ? "DEAD: the process exited before it served anything."
            : `UNCLASSIFIED (${readiness.state}).`;
  const stateLine = `  readiness: ${verdict}\n  last observation: ${readiness.detail}\n`;

  // No server was started, so diagnose the deployed origin.
  if (!DRIVES_PREVIEW) {
    if (originStatus !== null) {
      return (
        `${BASE}/blog answered ${originStatus}, not 200. PUBLIC_ORIGIN names a DEPLOYED site ` +
        `and this run starts no server of its own, so this is the origin ANSWERING and ` +
        `refusing the path, not a server that failed to come up. Check PUBLIC_ORIGIN: a ` +
        `404 here means the host is serving something that is not this site.`
      );
    }
    return (
      `${BASE}/blog could not be reached at all: ${originError || "no response and no error"}. ` +
      `PUBLIC_ORIGIN names a DEPLOYED site, so the host is down, the name does not resolve, ` +
      `or the network from here cannot reach it.`
    );
  }
  const how = serverExit
    ? `The preview server EXITED before answering (code ${serverExit.code}, signal ${serverExit.signal}).`
    : `The preview server process was still alive and never answered on ${BASE}.`;
  const tail = serverLog.length
    ? `Its last ${serverLog.length} line(s):\n    ${serverLog.join("\n    ")}`
    : `It produced NO output at all, on either stream, which usually means the ` +
      `spawn itself never ran the command.`;
  return `${stateLine}  ${how}\n  ${tail}`;
}

/**
 * Records `VITE_NEEDLES`-matching processes that outlive a killed gate. workerd and
 * esbuild are reached by `taskkill /T` from vite.
 */
/** Pids already written, held in memory because the registry is append-only. */
const recorded = new Set();

function recordServerSurvivors() {
  if (!server?.pid) return;
  const table = readProcessTable();
  if (table.size === 0) return;
  for (const pid of descendantPids(server.pid, table)) {
    if (recorded.has(pid)) continue;
    const live = table.get(pid);
    if (!live) continue;
    if (!VITE_NEEDLES.every((needle) => live.command.includes(needle.toLowerCase()))) continue;
    registry.record(pid, "the vite preview server", VITE_NEEDLES);
    recorded.add(pid);
  }
}

/** `/T`, because the spawned pid is a shell above vite. */
function stopServer() {
  if (!server) return;
  if (process.argv.includes("--keep")) return;
  if (server.pid) killTree(server.pid);
}

/**
 * Stops every child on an orderly exit: `browser.close()`, then a tree kill.
 *
 * @param {import("puppeteer").Browser | undefined} openBrowser
 */
async function cleanupChildren(openBrowser) {
  if (openBrowser) {
    await openBrowser.close().catch(() => {});
    const chrome = openBrowser.process();
    if (chrome?.pid && !process.argv.includes("--keep")) killTree(chrome.pid);
  }
  stopServer();
  // With `--keep` the entries stay, and the next preflight frees the port.
  if (!process.argv.includes("--keep")) registry.clear();
}

/**
 * Declared before the signal handlers that close over it (temporal dead zone).
 *
 * @type {import("puppeteer").Browser | undefined}
 */
let browser;

/*
 * `taskkill /F` delivers no signal; the registry covers it. `process.exit`, because
 * returning resumes a gate whose children are gone.
 */
for (const signal of /** @type {NodeJS.Signals[]} */ (["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"])) {
  process.on(signal, () => {
    console.error(`\ncheck:browser interrupted by ${signal}. Stopping its children.`);
    if (browser) {
      const chrome = browser.process();
      if (chrome?.pid) killTree(chrome.pid);
    }
    if (server?.pid) killTree(server.pid);
    registry.clear();
    process.exit(1);
  });
}

/** False when the subject never answered, so nothing below was measured. */
let subjectReachable = true;
try {
  if (!(await waitForServer())) {
    console.error(`check:browser failed. ${serverDiagnosis()}`);
    await cleanupChildren(browser);
    /*
     * Not `process.exit()`: with the probe's undici handle in flight, libuv aborts on
     * Windows.
     */
    process.exitCode = 1;
    subjectReachable = false;
    throw new Error("SUBJECT_UNREACHABLE");
  }

  browser = await puppeteer.launch({ headless: true });
  /* The Puppeteer cache path, not "chrome", so cleanup never reaches a user's browser. */
  registry.record(browser.process()?.pid, "the Puppeteer browser", [".cache/puppeteer"]);
  const page = await browser.newPage();

  /* Names which build the public cases observe. */
  console.log(
    DRIVES_PREVIEW
      ? `  public cases: observing the PREVIEW BUILD of the working tree (${BASE})`
      : `  public cases: observing ${BASE} (DEPLOYED). This run says nothing about uncommitted work.`,
  );

  /* ------------------------------------------------- the stylesheet itself */

  /* Scope first: an unstyled page would pass every layout assertion below. */
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const css = await page.evaluate(() =>
    [...document.styleSheets].reduce((n, s) => {
      try {
        return n + s.cssRules.length;
      } catch {
        return n;
      }
    }, 0),
  );
  /*
   * A crude per-route floor that catches a page with no stylesheet. Byte ceilings
   * are `check:page-payload`'s.
   */
  ok(
    "the blog page's stylesheets are actually applied",
    css >= 144,
    `${css} CSS rule(s) reachable on /blog, floor 144, measured 157 on 2026-08-27 ` +
      `after the per-route CSS split. Below this the page is effectively unstyled ` +
      `and every layout assertion below is measuring browser defaults.`,
  );

  /* ------------------------------------ 0. the home health tile is a READ */

  /*
   * `/api/health` is hit first to exercise the snapshot write; the read is
   * cache-busted because the home page is shared-cached.
   */
  {
    /**
     * Reads the tile off a cache-busted render of the home page.
     * @param {string} tag
     */
    const readTile = async (tag) => {
      await page.goto(`${BASE}/?browsercase=health-${tag}-${Date.now()}`, {
        waitUntil: "networkidle0",
      });
      const read = await page.evaluate((factSelector) => {
        const el = document.querySelector("[data-health-age]");
        /* The proof tiles became the evidence row (ruling 117), which now sits at the foot of the
           page rather than in the hero. The ratio is the health fact's own text, and the attribute
           still rides the element carrying it. */
        const value = document.querySelector(factSelector);
        return {
          present: !!el,
          age: el ? Number(el.getAttribute("data-health-age")) : null,
          value: value ? value.textContent.trim() : null,
        };
      }, HEALTH_FACT_SELECTOR);
      /* Wall clock at the read, so an age becomes a fixed write time. */
      return { ...read, readAtMs: Date.now() };
    };

    /**
     * When the shown snapshot was written, on the local clock.
     *
     * @param {{age: number|null, readAtMs: number}} t
     */
    const writtenAtMs = (t) => t.readAtMs - Number(t.age) * 1000;

    /*
     * Compares write times before and after: a leftover snapshot in persistent KV
     * passes an absolute age check. Polled, because KV reads are edge-cached.
     */
    const before = await readTile("before");

    const primed = await fetch(`${BASE}/api/health`, { headers: { accept: "application/json" } });
    const primedBody = await primed.text();
    ok(
      "the health endpoint answered, so a snapshot could be written",
      primed.status === 200 || primed.status === 503,
      `${BASE}/api/health answered ${primed.status}. Neither a verdict nor a ` +
        `refusal, so nothing was stored and the tile assertions below would fail ` +
        `for a reason that is not about the tile. Body: ${primedBody.slice(0, 200)}`,
    );

    /* The poll stops at the first newer write, so the budget is only a ceiling. */
    const POLL_BUDGET_MS = 90_000;
    const POLL_EVERY_MS = 5_000;
    const STAMP_TOLERANCE_MS = 2_000;

    /** @param {{present: boolean, age: number|null, readAtMs: number}} t */
    const isNewer = (t) =>
      t.present && Number.isInteger(t.age) &&
      writtenAtMs(t) > writtenAtMs(before) + STAMP_TOLERANCE_MS;

    let after = await readTile("after");
    let polls = 1;
    if (before.present && Number.isInteger(before.age)) {
      const deadline = Date.now() + POLL_BUDGET_MS;
      while (Date.now() < deadline && !isNewer(after)) {
        await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
        after = await readTile(`after-${polls}`);
        polls += 1;
      }
    }

    ok(
      "the home page carries a health verdict rather than a placeholder",
      after.present,
      `no element on / carries data-health-age. The tile is in its "missing" ` +
        `state, which means the snapshot was not written by the request above ` +
        `or was not read by the loader. Check the APP_KV binding and ` +
        `app/lib/health/snapshot.server.ts.`,
    );

    ok(
      "the tile's age is a number this gate can compare",
      Number.isInteger(after.age) && Number(after.age) >= 0,
      `data-health-age is ${JSON.stringify(after.age)}. A non-numeric age makes ` +
        `both comparisons below vacuous.`,
    );

    ok(
      "the home page's health verdict is inside one poll interval",
      Number.isInteger(after.age) && Number(after.age) < HEALTH_POLL_INTERVAL_SECONDS,
      `the tile reports a verdict ${after.age} second(s) old, which is not under ` +
        `the ${HEALTH_POLL_INTERVAL_SECONDS}s poll interval.`,
    );

    /* Skipped with no first reading: an absent number would pass vacuously. */
    if (before.present && Number.isInteger(before.age)) {
      ok(
        "calling /api/health made the home page's verdict NEWER",
        isNewer(after),
        `the tile reported a snapshot written at ` +
          `${new Date(writtenAtMs(before)).toISOString()} before the call and ` +
          `${after.present ? new Date(writtenAtMs(after)).toISOString() : "nothing"} after ` +
          `it, over ${polls} read(s) across up to ${POLL_BUDGET_MS / 1000}s. A snapshot ` +
          `that is being rewritten moves that timestamp forward; this one did not, ` +
          `which means the page is reading a leftover and NOTHING WROTE ONE. That is ` +
          `the exact defect a leftover in the preview's persistent KV hides from an ` +
          `absolute-age check. The budget is longer than the KV read cache, so a stale ` +
          `READ cannot be the explanation: check that /api/health reached ` +
          `writeHealthSnapshot, and that it did not answer 429 or take the catch path, ` +
          `both of which return before the write.`,
      );
    } else {
      skip(
        "calling /api/health made the home page's verdict NEWER",
        `the first read found no verdict (a genuinely empty KV), so there is no ` +
          `earlier age to compare against. The absolute assertions above still ` +
          `prove a snapshot was written and read; only the differential is ` +
          `unavailable, and it covers itself on the next run.`,
      );
    }

    ok(
      "the tile renders the verdict and not the stale placeholder",
      freshHealthRatio(after.value) !== null,
      `the health fact at ${HEALTH_FACT_SELECTOR} reads ${JSON.stringify(after.value)}. A fresh ` +
        `snapshot renders "N/M passing"; "-- passing" is what the stale and missing states ` +
        `show, and seeing it here means the age assertions above passed on the wrong element.`,
    );

    /* Back to /blog: every case below reuses this page. */
    await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  }

  /* 0b. a public document depends on the theme alone */

  /*
   * Keying the public cache on path plus theme is sound only if public bytes depend on
   * the theme alone. The nonce is masked: it differs per request by design.
   */
  {
    /* Every route exporting the shared cache headers; checked against the source below. */
    const THEME_CACHED = [
      { path: "/", module: "home.tsx" },
      { path: "/blog", module: "blog._index.tsx" },
      { path: "/blog/ten-years-on-cloudflare", module: "blog.$slug.tsx" },
      { path: "/projects", module: "projects.tsx" },
      { path: "/playground", module: "playground.tsx" },
      { path: "/playground/ui", module: "playground.ui.tsx" },
      { path: "/phage-discovery", module: "phage-discovery.tsx" },
      { path: "/colophon", module: "colophon.tsx" },
      { path: "/search?q=cloudflare", module: "search.tsx" },
      { path: "/privacy", module: "privacy.tsx" },
      /* The most-carried tag, so one post being retagged cannot remove the case. */
      { path: "/blog/tags/cloudflare", module: "blog.tags.$tag.tsx" },
      { path: "/about", module: "about.tsx" },
      { path: "/publications", module: "publications.tsx" },
      /* The trailing slash is canonical; the slashless form redirects. */
      { path: "/publications/10-1128-mra-00888-24/", module: "publications.$slug.tsx" },
    ];

    /* Shared-cached HTML with no corpus URL; a 404 would compare two error pages. */
    const THEME_CACHED_PENDING = {
      "blog.series.$series.tsx":
        "no post in the corpus carries a series, so every /blog/series/ URL is a " +
        "404 and a case here would compare two renders of the error page.",
    };

    const routeDir = join(root, "app", "routes");
    const declaring = readdirSync(routeDir)
      .filter((name) => name.endsWith(".tsx") || name.endsWith(".ts"))
      .filter((name) => {
        const source = readFileSync(join(routeDir, name), "utf8");
        // `preview.$token.tsx` names the constant only in prose, so comments are stripped first.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
        return /publicHtmlHeaders\(/.test(code) || /SHARED_CACHE_CONTROL/.test(code);
      })
      /* Shared-cached but not HTML: no `<html data-theme>` for a theme to reach. */
      .filter(
        (name) =>
          !/^(blog\.(feed|rss|atom)|blog\.(tags|series)\.\$(tag|series)\.(rss|feed)|blog\.\$slug\[\.md\]|publications(\.\$slug)?\[\.(bib|ris|json)\]|llms-full|sitemap)/.test(
            name,
          ),
      );

    const listed = new Set([
      ...THEME_CACHED.map((r) => r.module),
      ...Object.keys(THEME_CACHED_PENDING),
    ]);
    const missing = declaring.filter((name) => !listed.has(name));
    const extra = [...listed].filter((name) => !declaring.includes(name));
    ok(
      "every pending theme-cached exemption names a route that still declares them",
      Object.keys(THEME_CACHED_PENDING).every((name) => declaring.includes(name)),
      `THEME_CACHED_PENDING names a route that no longer declares the shared ` +
        `headers, so it exempts nothing and hides whatever replaced it`,
    );
    ok(
      "the theme-cached route list matches the routes that declare shared cache headers",
      missing.length === 0 && extra.length === 0,
      `not in this case: ${missing.join(", ") || "none"}; listed but no longer ` +
        `declaring: ${extra.join(", ") || "none"}. A route that gained the shared ` +
        `headers without being byte-checked here is exactly the one that would ` +
        `carry session bytes into a shared cache entry.`,
    );

    /**
     * What differs between two renders by design: nonce, report endpoint, health age.
     *
     * @param {string} html
     */
    const mask = (html) =>
      html
        .replace(/nonce="[^"]*"/g, 'nonce="N"')
        .replace(/csp-endpoint="[^"]*"/g, 'csp-endpoint="E"')
        .replace(/data-health-age="\d+"/g, 'data-health-age="A"')
        /*
         * The age sentence differs between same-cookie renders (KV edge cache plus clock), so
         * it is masked here and not in `maskTheme`. The health-tile case asserts the age.
         */
        .replace(
          /(data-health-age="A"[\s\S]*?<p class="evidence-detail[^"]*">)[^<]*/,
          "$1AGE-SENTENCE",
        );

    /**
     * ONE IDENTITY FOR THE WHOLE RUN, never one per fetch.
     *
     * This is a cache-buster: the themed `caches.default` entry is keyed on request URL, so a
     * fresh value is what stops a previous run's body answering this one. Per FETCH it also
     * made the three reads of a page three different URLs, and a route that echoes its own URL
     * then differs for that reason alone. `/publications` does: its search `<Form>` carries no
     * `action`, so React Router renders the request URL into the attribute and the byte-identity
     * pair failed on the gate's own parameter. One value per run busts the cache across runs and
     * leaves the reads comparable.
     *
     * Masking it instead would be the wrong direction: the mask set only ever shrinks, for the
     * reason stated above it.
     */
    const RUN_IDENTITY = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    /** @param {string} path @param {Record<string,string>} headers */
    const fetchDoc = async (path, headers) => {
      const sep = path.includes("?") ? "&" : "?";
      const res = await fetch(`${BASE}${path}${sep}identity=${RUN_IDENTITY}`, {
        headers: { "cache-control": "no-cache", ...headers },
        redirect: "manual",
      });
      return mask(await res.text());
    };

    /** The first differing region, so a failure names bytes. */
    const firstDiff = (/** @type {string} */ a, /** @type {string} */ b) => {
      const n = Math.min(a.length, b.length);
      let i = 0;
      while (i < n && a[i] === b[i]) i += 1;
      if (i === n && a.length === b.length) return null;
      return { at: i, a: a.slice(Math.max(0, i - 60), i + 80), b: b.slice(Math.max(0, i - 60), i + 80) };
    };

    /*
     * What the theme may change; after masking, the documents must be identical.
     *
     * THE SET ONLY EVER SHRINKS. A wider mask hides a control that has started varying its
     * markup by theme and the comparison below still passes, because masking more makes two
     * documents more alike. Shrinking it is the strict direction.
     */
    const maskTheme = (/** @type {string} */ html) =>
      html
        .replace(/<html[^>]*>/, "<html>")
        /* The color-scheme meta carries the theme by design; its own case asserts the value. */
        .replace(/<meta name="color-scheme" content="[^"]*"/, '<meta name="color-scheme" content="S"');
    /* The age sentence is not here: hard rule 8 scopes this to what the theme may change. */

    /**
     * The footer's link order, recorded on the first page and asserted on every later one.
     * `footerOrderCompared` exists so a THEME_CACHED of one cannot report a clean sweep of
     * a comparison that never ran.
     *
     * @type {string[] | null}
     */
    let footerOrder = null;
    let footerOrderPath = "";
    let footerOrderCompared = 0;

    for (const { path } of THEME_CACHED) {
      /* The footer assertions below need a rendered page. */
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      /* consistent help: the privacy link on every public page */

      /*
       * 3.2.6 asks for the same RELATIVE ORDER on every page, never a fixed index. The
       * order is recorded on the first page and every later page is held against it.
       *
       * The selector sweeps the WHOLE footer, which is three containers: the Elsewhere
       * nav, the machine-formats nav, and the copyright note. `/colophon` therefore
       * appears twice, once as a nav link and once as prose, and that is the markup
       * rather than a defect.
       */
      const help = await page.evaluate(() => {
        const links = [...document.querySelectorAll(".site-shell-footer a")].map(
          (a) => a.getAttribute("href") ?? "",
        );
        return { links, at: links.indexOf("/privacy") };
      });
      ok(
        `${path}: the footer carries the privacy link`,
        help.at !== -1,
        `footer links are [${help.links.join(", ")}]. 3.2.6 asks for the same help ` +
          `mechanism on every page that has one, and every public page has this footer.`,
      );
      if (footerOrder === null) {
        footerOrder = help.links;
        footerOrderPath = path;
      } else {
        footerOrderCompared += 1;
        const recorded = footerOrder;
        ok(
          `${path}: the footer link order matches ${footerOrderPath}`,
          help.links.length === recorded.length &&
            help.links.every((href, i) => href === recorded[i]),
          `this page lists [${help.links.join(", ")}] and ${footerOrderPath} listed ` +
            `[${recorded.join(", ")}]. 3.2.6 is about the same relative ORDER, so a link ` +
            `that moves between pages satisfies presence and fails the criterion.`,
        );
      }


      const stranger = await fetchDoc(path, {});
      const credentialed = await fetchDoc(path, {
        ...(SMOKE_TOKEN ? { authorization: `Bearer ${SMOKE_TOKEN}` } : {}),
        cookie: "session_probe=1; _ga=GA1.1.99.99",
      });

      const sessionDiff = firstDiff(stranger, credentialed);
      ok(
        `${path}: a credentialed reader gets byte-identical HTML`,
        sessionDiff === null,
        `the document differs at byte ${sessionDiff?.at}. THIS ROUTE CANNOT BE ` +
          `CACHED ON PATH PLUS THEME until the difference is removed, because a ` +
          `key that does not carry the credential would serve one reader's page ` +
          `to another.\n        stranger: ...${sessionDiff?.a}...\n        ` +
          `credentialed: ...${sessionDiff?.b}...`,
      );

      const dark = await fetchDoc(path, { cookie: "theme=dark" });
      const light = await fetchDoc(path, { cookie: "theme=light" });

      /* Without this, both assertions below pass on a site that stopped rendering the theme. */
      ok(
        `${path}: the theme changes the served bytes`,
        firstDiff(light, dark) !== null,
        `light and dark are byte-identical, so either the theme cookie is no ` +
          `longer read at render time or this page has no themed markup. A cache ` +
          `keyed on theme would be keying on nothing.`,
      );

      /* The document just compared, not a new fetch. Section presence is asserted first. */
      if (path === MENTION_POST_PATH) {
        if (!DRIVES_PREVIEW) {
          skip(
            `${path}: the seeded mention cases`,
            `this run observes ${PUBLIC_ORIGIN}, where nothing may write a row and no ` +
              `mention has been approved. The section's markup is unexercised here.`,
          );
        } else {
          ok(
            `${path}: the seeded approved mentions render`,
            stranger.includes('class="post-mentions"') &&
              stranger.includes('id="mentions-heading"'),
            `no Mentions section in the served document, so the seed did not reach the ` +
              `render and every assertion below it, INCLUDING the byte-identity pair, is ` +
              `about a page without the feature on it.`,
          );
          ok(
            `${path}: the ordinary mention is an anchor carrying the full rel`,
            /<a href="https:\/\/gate\.example\/about" rel="nofollow ugc noopener noreferrer">A Reader<\/a>/.test(
              stranger,
            ),
            `the anchor is missing or its rel is not the four tokens. A ugc link that ` +
              `passes ranking or leaks a referrer is the whole reason this rel exists.`,
          );

          /*
           * THE HOSTILE ROW, BOTH DIRECTIONS. The escaped form being present
           * does not prove the live form is absent: a page could render both.
           */
          ok(
            `${path}: a script-shaped author name is ESCAPED`,
            stranger.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
            `the escaped literal is not in the document, so either the name was ` +
              `stripped or the row did not render. Escaping is the whole difference ` +
              `between this section and the injected body above it.`,
          );
          ok(
            `${path}: no live script element reaches the document from a mention`,
            !stranger.includes("<script>alert(1)</script>"),
            `the author name reached the markup as a real element. This is the defect ` +
              `the escaped-text ruling exists to prevent, on the one block of this page ` +
              `whose text was written by a stranger.`,
          );
          ok(
            `${path}: a javascript: author_url renders NO anchor`,
            !/javascript:/i.test(stranger),
            `a javascript: URL survived into the document. safeHttpHref refuses it at ` +
              `render time and the name is meant to fall back to plain text; nothing on ` +
              `this page may put a stranger's scheme in an href.`,
          );
          ok(
            `${path}: the refused row still renders its name and excerpt`,
            stranger.includes("An excerpt from a page that cannot be linked to."),
            `the mention whose URLs both failed the check vanished instead of ` +
              `degrading to text. A moderated mention the reader cannot see, while the ` +
              `admin page shows it as published, is two surfaces disagreeing about what ` +
              `is live.`,
          );
        }
      }

      const residue = firstDiff(maskTheme(stranger), maskTheme(dark));
      ok(
        `${path}: the theme changes ONLY data-theme and the color-scheme meta`,
        residue === null,
        `with <html> and the color-scheme meta masked, the dark document still differs ` +
          `from the cookieless one at byte ${residue?.at}. Something else on this ` +
          `page depends on the cookie, so the enumerated diff is incomplete and ` +
          `the cache key would not describe the document.\n        ` +
          `cookieless: ...${residue?.a}...\n        dark: ...${residue?.b}...`,
      );
    }

    ok(
      "the footer order was compared against a recorded one, not just recorded",
      footerOrderCompared >= 2,
      `only ${footerOrderCompared} page(s) were held against ${footerOrderPath}. The first ` +
        `page RECORDS the order and cannot disagree with itself, so a run that recorded one ` +
        `and compared none reports a clean sweep of an assertion that never ran.`,
    );

    /* the cache itself is verify-live's */

    /* Miniflare does not implement Workers Cache; `verify-live` owns the cache assertions. */
    skip(
      "the cache stores, separates by theme, and refuses a negotiated read",
      "miniflare does not implement Workers Cache: measured 2026-09-05, three fetches " +
        "of a response with public, s-maxage=600 and a fixed cf.cacheKey each re-rendered " +
        "and carried no Cf-Cache-Status. These are verify-live's six measurements now, " +
        "against production. The theme-only-difference assertions above are unaffected.",
    );

    /* negotiated routing, which needs no cache */

    /* Routing only, which needs no cache; `verify-live` measurement (a) owns the cache half. */
    const NEGOTIATED = [
      {
        path: "/blog/ten-years-on-cloudflare",
        accept: "text/markdown",
        wanted: "text/markdown",
        label: "the markdown twin",
      },
      {
        path: "/search?q=cloudflare",
        accept: "application/json",
        wanted: "application/json",
        label: "the search JSON twin",
      },
    ];

    for (const { path, accept, wanted, label } of NEGOTIATED) {
      const sep = path.includes("?") ? "&" : "?";
      const key = `${BASE}${path}${sep}negotiated=${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const negotiated = await fetch(key, {
        headers: { cookie: "theme=dark", accept },
        redirect: "manual",
      });
      const type = negotiated.headers.get("content-type") ?? "";
      ok(
        `${label}: an ${accept} request is answered with ${wanted}`,
        type.includes(wanted),
        `got ${JSON.stringify(type)}. The route stopped negotiating, or the gateway's ` +
          `key stopped excluding the negotiated representation. See ` +
          `negotiatesAwayFromHtml in app/lib/negotiate.mjs and cacheDimensions in ` +
          `workers/app.ts.`,
      );
      /* `no-store` keeps the platform from storing it under the HTML reader's key. */
      ok(
        `${label}: the negotiated response refuses storage on its own headers`,
        (negotiated.headers.get("cache-control") ?? "").includes("no-store"),
        `cache-control was ${JSON.stringify(negotiated.headers.get("cache-control"))}. ` +
          `An alternate representation the platform is allowed to store is the same ` +
          `defect in the other direction: the next HTML reader on this key would be ` +
          `handed ${wanted}.`,
      );
    }

    /* the browser learns the color scheme before CSS */

    /*
     * Without a color-scheme meta the browser paints a light canvas between pages. Screencast
     * and screenshots cannot see that frame, so the document property is asserted.
     */
    {
      const SCHEME = /<meta name="color-scheme" content="([^"]*)"/;
      const FIRST_SHEET = /<link[^>]+rel="stylesheet"/;

      /** No choice resolves to `light dark`, so the machine decides. */
      const READER_STATES = [
        { label: "theme=dark", cookie: "theme=dark", expect: "dark" },
        { label: "theme=light", cookie: "theme=light", expect: "light" },
        /* Legacy `theme=system` cookies must resolve as no cookie. */
        { label: "theme=system (legacy)", cookie: "theme=system", expect: "light dark" },
        { label: "no cookie", cookie: null, expect: "light dark" },
      ];

      for (const { path } of THEME_CACHED) {
        /** @type {string[]} */
        const wrong = [];
        /** @type {Array<{ state: string, html: string }>} */
        const docs = [];
        for (const state of READER_STATES) {
          const html = await fetchDoc(path, state.cookie ? { cookie: state.cookie } : {});
          docs.push({ state: state.label, html });
          const found = html.match(SCHEME);
          if (!found) wrong.push(`${state.label}: NO meta at all`);
          else if (found[1] !== state.expect) {
            wrong.push(`${state.label}: "${found[1]}", expected "${state.expect}"`);
          }
        }
        ok(
          `${path}: every reader state declares its color scheme to the browser`,
          wrong.length === 0,
          `${wrong.join("; ")}. Without this the browser paints its DEFAULT canvas ` +
            `between documents, which is light: measured at 253 of 255 for one ` +
            `composited frame on a dark page whose reader is on a light machine.`,
        );

        /* Before the first stylesheet, not at a fixed index: React 19 orders the metas. */
        const dark = docs.find((d) => d.state === "theme=dark")?.html ?? "";
        const atMeta = dark.search(SCHEME);
        const atSheet = dark.search(FIRST_SHEET);
        ok(
          `${path}: the color scheme is declared before the first stylesheet`,
          atMeta !== -1 && (atSheet === -1 || atMeta < atSheet),
          `the meta is at byte ${atMeta} and the first stylesheet link at ${atSheet}. ` +
            `The point of this meta is that it is read BEFORE any CSS is fetched; ` +
            `after the stylesheet it tells the browser nothing it is not about to ` +
            `learn anyway.`,
        );
      }

      /* The meta and the stylesheet state one fact (rule 17), so they are checked to agree. */
      for (const theme of ["dark", "light"]) {
        const context = await browser.createBrowserContext();
        const probe = await context.newPage();
        await probe.setCookie({ url: BASE, name: "theme", value: theme, path: "/" });
        await probe.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
        const seen = await probe.evaluate(() => ({
          meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") ?? null,
          computed: getComputedStyle(document.documentElement).colorScheme,
        }));
        await context.close();
        ok(
          `theme=${theme}: the declared color scheme is the one the cascade resolves`,
          seen.meta === theme && seen.computed === theme,
          `the meta says ${JSON.stringify(seen.meta)} and the cascade resolves ` +
            `${JSON.stringify(seen.computed)}, expected both to be "${theme}". These are ` +
            `two statements of one fact and they have drifted.`,
        );
      }
    }
  }

  /* a public navigation runs no view transition */

  /*
   * Chrome's root crossfade blinks full-document navigations, so the ViewTransition must
   * be null. `pagereveal` must also fire, or an unattached listener would pass.
   */
  {
    const context = await browser.createBrowserContext();
    const probe = await context.newPage();

    /* An exposed binding, reinstalled per document, rather than sessionStorage. */
    /** @type {Array<{ path: string, hasTransition: boolean }>} */
    const reveals = [];
    await probe.exposeFunction(
      "__checkBrowserReveal",
      /** @param {string} path @param {boolean} hasTransition */
      (path, hasTransition) => {
        reveals.push({ path, hasTransition });
      },
    );
    await probe.evaluateOnNewDocument(() => {
      addEventListener("pagereveal", (event) => {
        /** @type {any} */ (window).__checkBrowserReveal(
          location.pathname,
          Boolean(event.viewTransition),
        );
      });
    });

    /* An activated prerender is a separate target the probe never ran in. */
    const probeClient = await probe.createCDPSession();
    await probeClient.send("Page.setPrerenderingAllowed", { isAllowed: false });

    /*
     * The nav is a wrapping row with no breakpoint of its own, so a destination is laid out
     * at every width. MEASURED 2026-09-17 on the deployed site: `.site-header-nav` computes
     * `display: flex` at 1280 and its links have boxes. Build 2 shipped a nav that computed
     * `display: none` at every width; it was reverted on 2026-09-14, and the overflow
     * fallback below is that build's residue, rendered by nothing in `app/` today.
     */
    await probe.setViewport({ width: 1280, height: 900 });

    await probe.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    ok(
      "the pagereveal probe is installed, so a later silence means something",
      reveals.some((r) => r.path === "/"),
      `the initial load produced ${JSON.stringify(reveals)}. pagereveal fires on ` +
        `every document load, so nothing here means the listener never attached and ` +
        `the navigation assertions below would pass or fail for the wrong reason.`,
    );
    reveals.length = 0;

    /*
     * A hidden element's zero box clicks the document corner, so it fails. Falls back to
     * the overflow menu's copy; fails if neither is laid out.
     */
    const openTarget = async () => {
      const read = () =>
        probe.evaluate(() => {
          /** @param {string} sel */
          const pick = (sel) => {
            const link = document.querySelector(sel);
            if (!link) return null;
            const box = link.getBoundingClientRect();
            if (box.width <= 0 || box.height <= 0) return null;
            return {
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
              w: box.width,
              h: box.height,
            };
          };
          const bar = pick('.site-header-nav a[href="/blog"]');
          if (bar) return { ...bar, via: "the header nav" };
          const menu = pick('.site-shell-menu a[href="/blog"]');
          return menu ? { ...menu, via: "the overflow menu" } : null;
        });

      const first = await read();
      if (first) return first;

      /* Nothing laid out yet, so open the disclosure and look again. */
      const opened = await probe.evaluate(() => {
        const d = document.querySelector("details.site-shell-overflow");
        if (!(d instanceof HTMLDetailsElement)) return false;
        d.open = true;
        return true;
      });
      if (!opened) return null;
      await new Promise((r) => setTimeout(r, 250));
      return read();
    };

    const target = await openTarget();
    const clickable = target !== null;
    ok(
      "the header carries a laid-out /blog link for the navigation case to click",
      clickable,
      'neither `.site-header-nav a[href="/blog"]` nor `.site-shell-menu a[href="/blog"]` ' +
        "is present with a non-zero box, even with the overflow disclosure opened. A " +
        "hidden link puts the click at the document corner and the navigation " +
        "assertions below then measure nothing, which is how one breakpoint read as " +
        "three unrelated failures.",
    );
    if (clickable) console.log(`  (the navigation case clicked via ${target.via})`);

    let arrived = "";
    let reveal = null;
    if (clickable) {
      /*
       * Hovered first because a hovered click is the realistic gesture. The dwell is no
       * longer load-bearing: it was written when a click with no dwell could activate a
       * PENDING prerender puppeteer cannot follow, and the guard above forbids prerendering
       * outright now. Kept because it costs nothing.
       */
      await probe.mouse.move(target.x, target.y);
      await new Promise((r) => setTimeout(r, 350));
      await probe.mouse.click(target.x, target.y);
      for (let i = 0; i < 25; i += 1) {
        arrived = await probe.evaluate(() => location.pathname).catch(() => "");
        if (arrived === "/blog") break;
        await new Promise((r) => setTimeout(r, 150));
      }
      /* The event fires on the incoming document, so give it a moment to land. */
      for (let i = 0; i < 6 && reveals.length === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
      reveal = reveals.find((r) => r.path === "/blog") ?? reveals[reveals.length - 1] ?? null;
    }
    await context.close();

    ok(
      "the header click reaches /blog, so the navigation below was real",
      arrived === "/blog",
      `landed on ${JSON.stringify(arrived)}. Everything after this measures a ` +
        `navigation, and a click that did not navigate makes it vacuous.`,
    );
    ok(
      "pagereveal fires on the public navigation",
      reveal !== null,
      `no pagereveal record. The event fires on every document load, so its ` +
        `absence means the probe never attached rather than that the site is fine, ` +
        `and the assertion below would then be about nothing.`,
    );
    ok(
      "THE PUBLIC NAVIGATION RUNS NO VIEW TRANSITION",
      reveal !== null && reveal.hasTransition === false,
      `pagereveal on ${JSON.stringify(reveal?.path)} carried ${reveal?.hasTransition ? "an object" : "no record"}, ` +
        `expected null. An object means the document opted back into cross-document ` +
        `view transitions, and Chrome's default root crossfade then stacks both ` +
        `pages at partial opacity for about a quarter of a second on every click: ` +
        `measured 12 to 14 intermediate frames, 214-220 ms dark and 245-259 ms ` +
        `light. The one owner is @view-transition in app/styles/motion-print.css.`,
    );
  }

  /* speculation rules, as Chrome parses them */

  /*
   * Chrome refuses to prerender under CDP, so `activationStart` is always 0: never assert
   * it. The candidate list is Chrome's own reading of the rules.
   */
  {
    const PAGES = ["/", "/blog", "/blog/ten-years-on-cloudflare", "/colophon", "/privacy"];
    /** @type {Map<string, {accepted: boolean, errors: string[], candidates: string[], hrefs: string[], actions: string[], eagerness: string[], blocks: number}>} */
    const seen = new Map();

    for (const path of PAGES) {
      const context = await browser.createBrowserContext();
      const probe = await context.newPage();
      await probe.setViewport({ width: 1280, height: 900 });
      const client = await probe.createCDPSession();
      await client.send("Preload.enable");

      /** @type {string[]} */
      const errors = [];
      let ruleSets = 0;
      /** @type {Set<string>} */
      const candidates = new Set();
      client.on("Preload.ruleSetUpdated", (event) => {
        ruleSets += 1;
        if (event.ruleSet?.errorType) {
          errors.push(`${event.ruleSet.errorType}: ${event.ruleSet.errorMessage ?? ""}`);
        }
      });
      client.on("Preload.preloadingAttemptSourcesUpdated", (event) => {
        for (const source of event.preloadingAttemptSources ?? []) {
          if (!source.key?.url) continue;
          const url = new URL(source.key.url);
          candidates.add(url.pathname + url.search);
        }
      });

      await probe.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      /* The candidate list is computed after the rules are parsed, so it needs
         a window; a zero read too early is not a zero. */
      await new Promise((r) => setTimeout(r, 1200));

      const page = await probe.evaluate(() => {
        const blocks = [...document.querySelectorAll('script[type="speculationrules"]')];
        /** @type {string[]} */
        const eagerness = [];
        /* The payload's own top-level keys ARE the actions. Harvested rather
           than looked up under one name, so a change of action shows up as a
           changed action rather than as an empty rule list. */
        /** @type {string[]} */
        const actions = [];
        for (const block of blocks) {
          try {
            const payload = JSON.parse(block.textContent ?? "{}");
            for (const [action, rules] of Object.entries(payload)) {
              actions.push(action);
              for (const rule of rules ?? []) eagerness.push(rule.eagerness);
            }
          } catch {
            actions.push("UNPARSEABLE");
            eagerness.push("UNPARSEABLE");
          }
        }
        return {
          blocks: blocks.length,
          actions,
          eagerness,
          hrefs: [
            ...new Set(
              [...document.querySelectorAll("a[href]")].map((a) => /** @type {HTMLAnchorElement} */ (a).href),
            ),
          ]
            .filter((href) => href.startsWith(location.origin))
            .map((href) => href.slice(location.origin.length)),
        };
      });
      await context.close();

      seen.set(path, {
        accepted: ruleSets > 0 && errors.length === 0,
        errors,
        candidates: [...candidates],
        ...page,
      });
    }

    for (const path of PAGES) {
      const s = /** @type {NonNullable<ReturnType<typeof seen.get>>} */ (seen.get(path));
      ok(
        `${path}: carries exactly one speculationrules block`,
        s.blocks === 1,
        `found ${s.blocks}. Two blocks on one page are two rule sets competing for ` +
          `one budget, which is what having a site block and a blog block cost; ` +
          `zero means the enhancement is absent and nothing else on the page changes.`,
      );
      ok(
        `${path}: CHROME ACCEPTED the rule set`,
        s.accepted,
        s.errors.length
          ? `Chrome reported ${JSON.stringify(s.errors)}. A rejected rule set renders ` +
            `identically to a good one and speculates nothing.`
          : `no Preload.ruleSetUpdated event at all, so the block never reached the ` +
            `speculation machinery. Under the enforced CSP the usual cause is a ` +
            `missing nonce on the element.`,
      );
      ok(
        `${path}: THE ACTION IS PREFETCH`,
        s.actions.length === 1 && s.actions[0] === "prefetch",
        `the payload's actions are ${JSON.stringify(s.actions)}, expected exactly ` +
          `["prefetch"]. It was "prerender" until 2026-08-28, and that is the navigation ` +
          `blink: a prerender that has not painted is still activatable, moderate ` +
          `eagerness starts on pointerdown, and a click with no hover dwell swaps in an ` +
          `empty frame host, so paint holding never runs and the reader gets the themed ` +
          `canvas. Measured on production by screen capture with no CDP, fourteen runs ` +
          `over both themes: every run with prerendering on showed blank frames at 100% ` +
          `of the --paper token with a luma standard deviation of zero, and no run with it ` +
          `off did. Prefetch warms the same credentialed response without creating a ` +
          `frame host to activate.`,
      );
      ok(
        `${path}: ONE rule, at moderate eagerness`,
        s.eagerness.length === 1 && s.eagerness[0] === "moderate",
        `eagerness values are ${JSON.stringify(s.eagerness)}, expected exactly ` +
          `["moderate"]. An "immediate" rule for the header's destinations was built ` +
          `and measured on 2026-08-28 and reverted on Dustin's verdict: it cost 4 to 5 ` +
          `extra credentialed document requests on EVERY public page load, taking origin ` +
          `document requests per page view from one to five or six, because a ` +
          `cookie-carrying reader bypasses the platform cache and each speculation ` +
          `therefore reaches this Worker. Its reappearance is that decision being undone.`,
      );
      ok(
        `${path}: is not a candidate for its own speculation`,
        !s.candidates.includes(path),
        `the page speculates itself. That spends an origin request on a navigation ` +
          `that cannot happen, and can evict a useful candidate from the two-slot ` +
          `moderate budget.`,
      );
    }

    /* `/colophon` is reached from the footer. */
    const fromBlog = /** @type {NonNullable<ReturnType<typeof seen.get>>} */ (seen.get("/blog"));
    ok(
      "/blog: the candidate list is non-empty, so the assertions below are about something",
      fromBlog.candidates.length > 0,
      "Chrome resolved no candidates at all. Every exclusion assertion below would " +
        "then pass on an empty set, which is the zero-scope class of hard rule 10.",
    );
    for (const destination of ["/colophon", "/privacy", "/search", "/blog/ten-years-on-cloudflare"]) {
      ok(
        `/blog: ${destination} is a speculation candidate`,
        fromBlog.candidates.includes(destination),
        `it is not, so a click to it is a cold document load. ${destination} is linked ` +
          `from this page and is a public HTML route, which is exactly the set the ` +
          `document rule exists to cover.`,
      );
    }

    /* Link counts are proven non-empty first. */
    const EXCLUSIONS = [
      {
        label: "a query string",
        matches: (/** @type {string} */ href) => href.includes("?"),
        /*
         * Do not spell the glob here: `stripComments` reads a slash-star in a string as a
         * comment opener, hiding `ok()` calls from `check:invariants` section 17.
         */
        why:
          "a filtered view is a database read per variant, and /blog renders one chip " +
          "per tag; speculating them is a crawl of the tag index. The exclusion has to " +
          "name the URLPattern `search` component. A pathname pattern that spells the " +
          "query with a literal question mark reads it as part of the path, and planting " +
          "that spelling resolved ZERO candidates on every page rather than merely " +
          "leaking the queries.",
      },
      {
        label: "a non-page extension",
        matches: (/** @type {string} */ href) => /\.(md|xml|json|txt)(\?|$)/.test(href),
        why:
          "feeds, the sitemap, robots, the llms pair and the .md representation twins are " +
          "not documents a reader navigates to. /blog/rss.xml WAS a candidate under the " +
          "old blog-prefix rule, measured 2026-08-28. The rule is not spelled out here " +
          "for the slash-star reason given above.",
      },
      {
        label: "the login door",
        matches: (/** @type {string} */ href) => href === "/login",
        why: "prerendering a door warms nothing, and it is linked from the header on every page.",
      },
    ];
    for (const exclusion of EXCLUSIONS) {
      const links = fromBlog.hrefs.filter(exclusion.matches);
      ok(
        `/blog renders at least one link with ${exclusion.label}, so the exclusion has a subject`,
        links.length > 0,
        `none found among ${fromBlog.hrefs.length} same-origin links. The assertion below ` +
          `would pass because the page changed, not because the rule works.`,
      );
      const leaked = fromBlog.candidates.filter(exclusion.matches);
      ok(
        `NO CANDIDATE ON /blog CARRIES ${exclusion.label.toUpperCase()}`,
        leaked.length === 0,
        `Chrome resolved ${JSON.stringify(leaked)} as speculation candidates. ${exclusion.why}`,
      );
    }
  }

  /* The cases below read the current page and expect /blog. */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });

  /* no layout shift while the font arrives */

  /*
   * Throttled, or a local font arrives in time and CLS can never fail. A missing observer
   * returns null, which fails.
   */
  {
    const context = await browser.createBrowserContext();
    const probe = await context.newPage();
    await probe.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
    await probe.setCacheEnabled(false);
    await probe.evaluateOnNewDocument(() => {
      const w = /** @type {any} */ (window);
      w.__cls = 0;
      w.__observed = true;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = /** @type {any} */ (entry);
          if (!shift.hadRecentInput) w.__cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await probe.emulateNetworkConditions(SLOW_4G);
    await probe.emulateCPUThrottling(4);
    await probe.goto(`${BASE}/blog`, { waitUntil: "networkidle0", timeout: 300_000 });
    // CLS accumulates after load; a reading taken at load is the first frame.
    await new Promise((r) => setTimeout(r, 4000));
    const shift = await probe.evaluate(() => {
      const w = /** @type {any} */ (window);
      return w.__observed === true ? w.__cls : null;
    });
    await context.close();

    ok(
      "the layout-shift observer ran, so a zero below means stability",
      shift !== null,
      "the page reported no observer at all, and a missing observer reports the same " +
        "0.0000 a stable page does.",
    );
    ok(
      "/blog does not shift while the font arrives (CLS under 0.02)",
      shift !== null && shift < 0.02,
      `CLS ${shift === null ? "(unobserved)" : shift.toFixed(4)} on Slow 4G with a cold ` +
        `cache, ceiling 0.02, measured 0.0000 on 2026-08-28. It was 0.0674 with ` +
        `font-display: swap, one shift, the tag-chip row re-wrapping when the web font ` +
        `replaced the fallback. The ceiling is well under Google's 0.1 "good" threshold ` +
        `on purpose: this page measured zero, so anything approaching a tenth is a ` +
        `regression rather than a page that is merely acceptable.`,
    );
  }

  /* 1. the search field and the column */

  /* Aligned with a sibling, not the literal 48rem app.css owns. */
  const cols = await page.evaluate(() => {
    const box = (/** @type {string} */ sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    };
    /* The Paper and Plate /blog (bfed012) renamed all three; the old names matched nothing. */
    return { search: box(".list-search"), head: box(".list-head"), list: box(".entry-list") };
  });

  ok(
    "the blog page has a search form, a heading and a post list to compare",
    !!(cols.search && cols.head && cols.list),
    `found ${JSON.stringify(cols)}. A missing element makes the comparison below vacuous.`,
  );

  if (cols.search && cols.head) {
    ok(
      "the blog search field sits inside the same column as the page heading",
      Math.abs(cols.search.left - cols.head.left) <= 2 &&
        Math.abs(cols.search.right - cols.head.right) <= 2,
      `search is ${cols.search.left}..${cols.search.right} (${cols.search.width}px) and the ` +
        `heading is ${cols.head.left}..${cols.head.right} (${cols.head.width}px). The search ` +
        `form is full-bleed while everything around it is centered in a 48rem column.`,
    );
  }

  /* 2. the skip link target */

  /* A skip link with no target is a keyboard trap. */
  for (const path of ["/", "/blog", "/search?q=workers", "/colophon"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const s = await page.evaluate(() => {
      const link = document.querySelector("a.skip-link");
      if (!link) return { link: false, href: "", target: false };
      const href = link.getAttribute("href") ?? "";
      const id = href.startsWith("#") ? href.slice(1) : "";
      return { link: true, href, target: !!(id && document.getElementById(id)) };
    });
    ok(
      `${path}: the skip link exists and its target does`,
      s.link && s.target,
      s.link
        ? `href is ${JSON.stringify(s.href)} and no element carries that id, so the link ` +
          `moves focus nowhere`
        : "there is no .skip-link at all",
    );
  }

  /* 3. aria-current is not on Blog on a post */

  /* `NavLink` without `end` marks Blog current on every `/blog/*` page. */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const firstPost = await page.evaluate(() => {
    const a = document.querySelector('.entry-list a[href^="/blog/"]');
    return a ? a.getAttribute("href") : null;
  });

  ok(
    "the blog index lists at least one post to navigate to",
    !!firstPost,
    "no post link found, so the aria-current assertion below would examine nothing",
  );

  if (firstPost) {
    await page.goto(`${BASE}${firstPost}`, { waitUntil: "networkidle0" });
    const marked = await page.evaluate(() =>
      [...document.querySelectorAll(".site-header-nav a")]
        .filter((a) => a.getAttribute("aria-current"))
        .map((a) => `${(a.textContent || "").trim()} -> ${a.getAttribute("href")}`),
    );
    ok(
      "no header nav link claims to be the current page on a post page",
      marked.length === 0,
      `${marked.join(", ")} carries aria-current on ${firstPost}, which is not that link's ` +
        `page. NavLink needs \`end\`, exactly as the admin nav already has.`,
    );
  }

  /* 4. no horizontal scroll at 320px */

  /* Every page, since shared chrome can overflow. The failure names the element. */
  /* `/playground` boxes scroll by design; the page must not. */
  await page.setViewport({ width: 320, height: 800 });
  for (const path of [
    "/",
    "/blog",
    "/search?q=workers",
    "/colophon",
    "/projects",
    "/playground?key=dustin-edwards-4f2d7f1a9c3b5e07-1600x900.webp&cookie=theme%3Ddark&md=links&q=fusion",
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const o = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        // The off-screen skip link is positioned at -9999px by design.
        if (r.left < -1000) continue;
        if (r.right > doc.clientWidth + 0.5) {
          const cls = typeof el.className === "string" ? el.className : "";
          over.push(`${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""}@${Math.round(r.right)}`);
        }
      }
      return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over: over.slice(0, 4) };
    });
    ok(
      `${path}: no horizontal scroll at 320px`,
      o.scrollW <= o.clientW,
      `scrollWidth ${o.scrollW} exceeds clientWidth ${o.clientW}. Widest: ${o.over.join(", ")}`,
    );
  }

  /* 4a. maths must not drag the document */

  /*
   * Paired controls: the box must really overflow and the sheet be linked. A mathless
   * post links no sheet, which is hard rule 4's half on the wire.
   */
  if (!mathPreviewSeeded) {
    skip(
      "the math page cases",
      `they need a seeded draft row and preview token in local storage, which only the ` +
        `preview-driving mode writes. Under PUBLIC_ORIGIN the fixture is unpublished on ` +
        `the deployed site and nothing here may publish it.`,
    );
  } else {
    const MATH_PATH = `/preview/${MATH_PREVIEW_TOKEN}`;
    const NARROW_MATH = 375;

    await page.setViewport({ width: NARROW_MATH, height: 800 });
    const response = await page.goto(`${BASE}${MATH_PATH}`, { waitUntil: "networkidle0" });

    /* Every refusal is the same 404, so the door is asserted open first. */
    ok(
      `${MATH_PATH}: the preview door opened`,
      response?.status() === 200,
      `the preview answered ${response?.status()}. That route returns one 404 for every ` +
        `refusal, so this is a seed problem: either the KV record is missing, or the row ` +
        `is not a draft, or the slugs disagree.`,
    );

    /* React 19 `precedence` hoists the sheet above the color-scheme meta. */
    const order = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const head = html.slice(0, html.indexOf("</head>"));
      return { meta: head.indexOf("color-scheme"), sheet: head.indexOf('rel="stylesheet"') };
    });
    ok(
      `${MATH_PATH}: the color scheme is declared before the first stylesheet`,
      order.meta >= 0 && order.sheet >= 0 && order.meta < order.sheet,
      `color-scheme at ${order.meta}, first stylesheet at ${order.sheet}. A signal that ` +
        `arrives after the stylesheet has been requested arrived too late to matter. A ` +
        `React "precedence" attribute on the math link puts it above the meta.`,
    );

    const math = await page.evaluate(() => {
      const doc = document.documentElement;
      const displays = [...document.querySelectorAll(".prose .katex-display")];
      const widest = displays
        .map((el) => ({
          scroll: el.scrollWidth,
          client: el.clientWidth,
          overflowX: getComputedStyle(el).overflowX,
        }))
        .sort((a, b) => b.scroll - b.client - (a.scroll - a.client))[0];
      const over = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.left < -1000) continue;
        if (r.right > doc.clientWidth + 0.5) {
          const cls = typeof el.className === "string" ? el.className : "";
          over.push(
            `${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""}@${Math.round(r.right)}`,
          );
        }
      }
      const prose = document.querySelector(".prose");
      const katex = document.querySelector(".prose .katex");
      return {
        sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(
          (l) => l.getAttribute("href") ?? "",
        ),
        expressions: document.querySelectorAll(".prose .katex").length,
        mathml: document.querySelectorAll(".prose .katex-mathml math").length,
        errors: document.querySelectorAll(".katex-error").length,
        displays: displays.length,
        widest: widest ?? null,
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        over: over.slice(0, 4),
        proseColour: prose ? getComputedStyle(prose).color : null,
        katexColour: katex ? getComputedStyle(katex).color : null,
      };
    });

    ok(
      `${MATH_PATH}: the page renders expressions and no error box`,
      math.expressions >= 15 && math.displays >= 4 && math.errors === 0,
      `${math.expressions} .katex element(s), ${math.displays} display block(s), ` +
        `${math.errors} error box(es). The fixture carries 17 expressions in 4 display ` +
        `blocks; fewer means the render changed and every measurement below is about a ` +
        `different page, and an error box means an expression got past remarkMathValidate.`,
    );
    ok(
      `${MATH_PATH}: every expression carries its MathML, not the layout tree alone`,
      math.mathml >= 15,
      `${math.mathml} <math> element(s) against ${math.expressions} expression(s). The ` +
        `output mode has dropped to html-only and a screen reader is getting the ` +
        `positioning spans, which are aria-hidden, and therefore nothing.`,
    );
    ok(
      `${MATH_PATH}: the document links the math stylesheet`,
      math.sheets.some((href) => href.includes("katex")),
      `stylesheets on the page: ${math.sheets.join(", ") || "none"}. root.tsx links it ` +
        `from the loader's hasMath; without it every equation renders in the body font ` +
        `with no positioning, which still does not scroll and would pass the case below.`,
    );

    /* The overflow really exists, so the assertion after it is not vacuous. */
    ok(
      `${MATH_PATH}: a display equation really is wider than its own box`,
      Boolean(math.widest) && math.widest.scroll > math.widest.client,
      `the widest display block measures scrollWidth ${math.widest?.scroll} against ` +
        `clientWidth ${math.widest?.client} at ${NARROW_MATH}px. Nothing overflows, so ` +
        `"the page does not scroll sideways" is true of this page for a reason that has ` +
        `nothing to do with the container.`,
    );
    ok(
      `${MATH_PATH}: the display block is the thing that scrolls`,
      math.widest?.overflowX === "auto" || math.widest?.overflowX === "scroll",
      `.katex-display computes overflow-x: ${math.widest?.overflowX}. The rule is in ` +
        `app/styles/katex-overrides.css and rides in the generated stylesheet.`,
    );
    ok(
      `${MATH_PATH}: no horizontal scroll at ${NARROW_MATH}px`,
      math.scrollW <= math.clientW,
      `scrollWidth ${math.scrollW} exceeds clientWidth ${math.clientW} by ` +
        `${math.scrollW - math.clientW}px. Widest: ${math.over.join(", ") || "(nothing " +
          "measured wider than the viewport, so it is on an element this scan skipped)"}`,
    );

    /* KaTeX declares no color, so it must compute to the `.prose` color. */
    ok(
      `${MATH_PATH}: maths takes the prose color rather than declaring one`,
      math.katexColour !== null && math.katexColour === math.proseColour,
      `.katex computes ${math.katexColour} and .prose computes ${math.proseColour}. A ` +
        `declared color would survive a theme change and break both of them.`,
    );

    /* Through CDP: puppeteer's `emulateMediaFeatures` rejects `forced-colors`. */
    const emulation = await page.createCDPSession();
    for (const mode of [
      { label: "dark", cookie: "dark", features: [] },
      {
        label: "forced-colors",
        cookie: null,
        features: [{ name: "forced-colors", value: "active" }],
      },
    ]) {
      if (mode.cookie) {
        await page.setCookie({ url: BASE, name: "theme", value: mode.cookie, path: "/" });
      }
      if (mode.features.length > 0) {
        await emulation.send("Emulation.setEmulatedMedia", { features: mode.features });
      }
      await page.goto(`${BASE}${MATH_PATH}`, { waitUntil: "networkidle0" });
      const colours = await page.evaluate(() => {
        const prose = document.querySelector(".prose");
        const katex = document.querySelector(".prose .katex");
        return {
          prose: prose ? getComputedStyle(prose).color : null,
          katex: katex ? getComputedStyle(katex).color : null,
        };
      });
      ok(
        `${MATH_PATH}: maths still takes the prose color under ${mode.label}`,
        colours.katex !== null && colours.katex === colours.prose,
        `.katex computes ${colours.katex} and .prose computes ${colours.prose} under ` +
          `${mode.label}. The two must move together, because that is what makes ` +
          `check:contrast's thresholds cover the maths without restating one.`,
      );
    }
    await emulation.send("Emulation.setEmulatedMedia", { features: [] });
    await emulation.detach();
    await page.deleteCookie({ url: BASE, name: "theme", path: "/" });

    /* control: a mathless post links nothing extra */

    await page.goto(`${BASE}${MATHLESS_POST_PATH}`, { waitUntil: "networkidle0" });
    const mathless = await page.evaluate(() => ({
      sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(
        (l) => l.getAttribute("href") ?? "",
      ),
      expressions: document.querySelectorAll(".katex").length,
    }));
    ok(
      `${MATHLESS_POST_PATH}: a post with no maths links no math stylesheet`,
      !mathless.sheets.some((href) => href.includes("katex")) && mathless.expressions === 0,
      `stylesheets: ${mathless.sheets.join(", ")}, .katex elements: ` +
        `${mathless.expressions}. Twelve of the thirteen posts have no expression in ` +
        `them and must pay nothing for the one that does.`,
    );
  }

  /* 4b. the playground demos answer on the wire */

  /*
   * check:features cannot see the transport (Hard rule 7), such as the Worker's WASM
   * instantiator. Expectations come from the manifest.
   */
  await page.setViewport({ width: 1280, height: 900 });
  {
    const manifest = JSON.parse(
      readFileSync(join(root, "content", "playground.json"), "utf8"),
    );

    /** The document's visible text, collapsed, for substring assertions. */
    const visibleText = async () =>
      (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");

    /* The page must be the playground with every declared section. */
    await page.goto(`${BASE}/playground`, { waitUntil: "networkidle0" });
    const sections = await page.evaluate(() =>
      [...document.querySelectorAll("section.playground-demo")].map((s) => s.id),
    );
    const declared = manifest.demos.map((/** @type {any} */ d) => `demo-${d.slug}`);
    ok(
      "/playground renders a section for every demo in the manifest",
      declared.every((/** @type {string} */ id) => sections.includes(id)),
      `manifest: ${declared.join(", ")}; rendered: ${sections.join(", ") || "none"}`,
    );

    /* the key grammar, on the wire */

    const keyPreset = manifest.keyPresets.find(
      (/** @type {any} */ p) => p.expect?.dimensions !== null && p.expect?.contentKey === true,
    );
    ok(
      "the key demo has a dimension-bearing preset to drive",
      Boolean(keyPreset),
      "without one this case would assert nothing and still pass",
    );
    if (keyPreset) {
      await page.goto(`${BASE}/playground?key=${encodeURIComponent(keyPreset.key)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();
      ok(
        "the key demo answers with the digest the grammar carries",
        text.includes(keyPreset.expect.digest),
        `expected ${keyPreset.expect.digest} in the rendered page`,
      );
      const [w, h] = String(keyPreset.expect.dimensions).split("x");
      ok(
        "the key demo answers with the intrinsic dimensions",
        text.includes(`${w} by ${h}`),
        `expected "${w} by ${h}" in the rendered page`,
      );
      ok(
        "the key demo answers with the storage tier",
        text.includes(keyPreset.expect.storage),
        `expected ${keyPreset.expect.storage} in the rendered page`,
      );
    }

    /* A caught throw that renders nothing looks like a working page. */
    const refusedPreset = manifest.keyPresets.find(
      (/** @type {any} */ p) => p.expect?.kind === "refused",
    );
    ok("the key demo has a refusal preset to drive", Boolean(refusedPreset));
    if (refusedPreset) {
      await page.goto(`${BASE}/playground?key=${encodeURIComponent(refusedPreset.key)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();
      ok(
        "the key demo renders the classifier's refusal rather than a blank",
        text.includes("unclassified asset"),
        "the throw was caught and nothing was shown, which is the one failure " +
          "mode a source-reading gate cannot see",
      );
    }

    /* the theme resolver, on the wire */

    for (const preset of manifest.cookiePresets) {
      await page.goto(`${BASE}/playground?cookie=${encodeURIComponent(preset.cookie)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();
      /* "system" appears in prose; "omitted" appears only in this row. */
      const expected = preset.expect.attribute ?? "omitted";
      ok(
        `the theme demo answers ${JSON.stringify(preset.cookie)} with ${expected}`,
        text.includes(`data-theme ${expected}`),
        `expected the data-theme row to read ${expected}`,
      );
    }

    /* the markdown pipeline, on the wire */

    /* workerd refuses `WebAssembly.instantiate()` on raw bytes; only a Worker sees this. */
    for (const snippet of manifest.markdownSnippets) {
      await page.goto(`${BASE}/playground?md=${encodeURIComponent(snippet.slug)}`, {
        waitUntil: "networkidle0",
      });
      const text = await visibleText();

      if (snippet.expect.throws) {
        ok(
          `the markdown demo refuses "${snippet.slug}" by name`,
          text.includes("unknown directive"),
          "the pipeline's named refusal is the branch a published article can " +
            "never show, so this is the only place it is observable",
        );
        continue;
      }

      for (const anchor of snippet.expect.toc) {
        ok(
          `the markdown demo reports the "${anchor}" anchor it collected`,
          text.includes(anchor),
          `expected ${anchor} among the collected heading anchors`,
        );
      }

      /* Shiki's token spans are absent when the WASM module failed. */
      if (snippet.source.includes("```")) {
        const highlighted = await page.evaluate(
          () => document.querySelectorAll(".playground-rendered pre.shiki span[style]").length,
        );
        ok(
          `the markdown demo highlights "${snippet.slug}" in the Worker`,
          highlighted > 0,
          "no shiki token spans in the rendered pane. The Worker could not " +
            "instantiate the oniguruma module, which the Node-side gate cannot see.",
        );
      }

      if (snippet.expect.blockedCount > 0) {
        /* Checked on the DOM's own links. */
        const liveHrefs = await page.evaluate(() =>
          [...document.querySelectorAll(".playground-rendered a")].map((a) =>
            a.getAttribute("href"),
          ),
        );
        ok(
          `the markdown demo emits no refused protocol as a live link`,
          liveHrefs.every((/** @type {string | null} */ href) => !/^javascript:/i.test(href ?? "")),
          `rendered hrefs: ${liveHrefs.join(", ")}`,
        );
      }
    }
  }

  /* 5. the login skip link */

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  const loginSkip = await page.evaluate(() => {
    const link = document.querySelector("a.skip-link");
    if (!link) return { link: false, target: false, href: "" };
    const href = link.getAttribute("href") ?? "";
    const id = href.startsWith("#") ? href.slice(1) : "";
    return { link: true, href, target: !!(id && document.getElementById(id)) };
  });
  ok(
    "/login: the skip link target exists",
    !loginSkip.link || loginSkip.target,
    `the login page renders a skip link to ${JSON.stringify(loginSkip.href)} and nothing ` +
      `carries that id, so keyboard focus goes nowhere`,
  );

  /* 5b. the enhancements run, and nothing else ships */

  /*
   * Rule 9's "fast with it" half, which fails silently. The Ask stream is not driven
   * because it bills. Console errors are asserted empty at the end, where CSP refusals show.
   */
  /** @type {string[]} */
  const publicConsoleErrors = [];
  /** @param {import("puppeteer").Page} p */
  const collectErrors = (p) => {
    p.on("console", (m) => {
      if (m.type() === "error") publicConsoleErrors.push(m.text().slice(0, 200));
    });
    p.on("pageerror", (e) => publicConsoleErrors.push(String(e).slice(0, 200)));
  };
  collectErrors(page);

  /* Stems from app/enhance/, since build/client may be another build's. */
  const enhanceStems = new Set(
    readdirSync(join(root, "app", "enhance"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(/\.ts$/, "")),
  );
  ok(
    "the enhancement module listing is non-empty",
    enhanceStems.size > 0,
    "app/enhance/ lists no modules, so the script-set cases below would assert nothing",
  );

  await page.setViewport({ width: 1280, height: 900 });

  /* Found by walking the listing, since a pinned slug goes stale. */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const postPaths = await page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('.entry-list a[href^="/blog/"]')]
        .map((a) => a.getAttribute("href"))
        /* A POST IS ONE SEGMENT. Each row also links its tags (/blog/tags/x); without this the
           list was one post and five tag archives, and the bundle case below read a tag page. */
        .filter((h) => h && /^\/blog\/[^/.]+$/.test(h)),
    )].slice(0, 6),
  );
  /*
   * The blog bundle loads on a post and not on the index.
   *
   * @param {string} stem
   */
  const bundleFetches = (/** @type {string} */ stem) =>
    page.evaluate(
      (/** @type {string} */ s) =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => new RegExp(`/assets/${s}-[^/]*\\.js$`).test(entry.name)).length,
      stem,
    );

  const blogOnIndex = await bundleFetches("blog");
  ok(
    "the blog reading bundle is NOT fetched by the listing page",
    blogOnIndex === 0,
    `${blogOnIndex} request(s) for the blog bundle on /blog. Every enhancement in it ` +
      `targets markup only a rendered post carries, so this is bytes spent to find ` +
      `nothing.`,
  );

  let codePost = null;
  let probedPost = null;
  for (const path of postPaths) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    /* The page the bundle is counted on is the LAST one visited, so that is the one named. */
    probedPost = path;
    const hasCode = await page.evaluate(
      () => document.querySelectorAll(".prose pre[data-lang]").length > 0,
    );
    if (hasCode) {
      codePost = path;
      break;
    }
  }

  if (probedPost !== null) {
    // The page is sitting on a post, whichever one the loop stopped at.
    const blogOnPost = await bundleFetches("blog");
    ok(
      "the blog reading bundle IS fetched by a post page",
      blogOnPost === 1,
      `${blogOnPost} request(s) for the blog bundle on ${probedPost}. Zero means the ` +
        `component was removed from the post route as well as the listing, which turns ` +
        `seven enhancements off rather than scoping one bundle.`,
    );
  }

  if (codePost === null) {
    skip(
      "code copy buttons appear on a post with code blocks",
      `none of the first ${postPaths.length} posts carry a pre[data-lang]; the corpus ` +
        `has no code post to observe, which is a content fact, not a defect`,
    );
  } else {
    // The page is already open on codePost from the loop above.
    const decorated = await page.evaluate(() => ({
      copies: document.querySelectorAll(".prose pre[data-lang] .code-copy").length,
      pres: document.querySelectorAll(".prose pre[data-lang]").length,
    }));
    ok(
      `${codePost}: every code block gained a copy button`,
      decorated.pres > 0 && decorated.copies === decorated.pres,
      `${decorated.copies} button(s) on ${decorated.pres} block(s). The blog bundle did ` +
        `not run, or decorateCodeBlock's selector moved.`,
    );
  }

  /* WCAG 2.2 1.4.13, on a post with footnotes */

  /* Hoverable, dismissible, persistent (WCAG 1.4.13). The post is found, not named. */
  const footnotePost = await (async () => {
    for (const path of postPaths) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      const has = await page.evaluate(
        () => document.querySelectorAll(".prose a[data-footnote-ref]").length > 0,
      );
      if (has) return path;
    }
    return null;
  })();

  if (footnotePost === null) {
    skip(
      "footnote previews are hoverable, dismissible and persistent",
      `none of the first ${postPaths.length} posts carry a footnote reference, so there ` +
        `is nothing to hover. A content fact, not a defect.`,
    );
  } else {
    const bubbleShown = () =>
      page.evaluate(() => Boolean(document.querySelector(".footnote-preview")));

    // The page is already open on footnotePost from the walk above.
    await page.hover(".prose a[data-footnote-ref]");
    await new Promise((r) => setTimeout(r, 150));
    ok(
      `${footnotePost}: hovering a footnote reference shows the preview`,
      await bubbleShown(),
      `no .footnote-preview after hovering the reference. Every assertion below is ` +
        `vacuous without this: the three properties are all about a bubble that exists.`,
    );

    /* Straight to the bubble's center; a gap step would test the grace period. */
    const box = await page.evaluate(() => {
      const el = document.querySelector(".footnote-preview");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (box) await page.mouse.move(box.x, box.y);
    await new Promise((r) => setTimeout(r, 400));
    ok(
      `${footnotePost}: 1.4.13 HOVERABLE, the preview survives the pointer entering it`,
      await bubbleShown(),
      `the bubble was gone 400ms after the pointer moved onto it, which is longer than ` +
        `the grace period. mouseleave on the reference is hiding it without waiting to ` +
        `see whether the pointer arrived, which is the defect: the bubble sits below the ` +
        `reference, so reaching it always crosses that boundary.`,
    );

    /*
     * PERSISTENT. Scrolling must not destroy it. Asserted with the pointer
     * still inside the bubble, so a failure here is the scroll listener rather
     * than the pointer having left.
     */
    await page.evaluate(() => window.scrollBy(0, 40));
    await new Promise((r) => setTimeout(r, 150));
    ok(
      `${footnotePost}: 1.4.13 PERSISTENT, scrolling does not destroy the preview`,
      await bubbleShown(),
      `a scroll removed the bubble. The reader scrolling to bring a long footnote into ` +
        `view is exactly the person this hurts.`,
    );

    /*
     * DISMISSIBLE. Escape removes it WITHOUT moving focus, which is the part
     * of 1.4.13 that is easy to satisfy wrongly by focusing something else.
     */
    const focusBefore = await page.evaluate(() => document.activeElement?.tagName ?? "");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 150));
    const afterEscape = await page.evaluate(() => ({
      gone: document.querySelector(".footnote-preview") === null,
      focus: document.activeElement?.tagName ?? "",
    }));
    ok(
      `${footnotePost}: 1.4.13 DISMISSIBLE, Escape removes the preview`,
      afterEscape.gone,
      `Escape left the bubble on screen. A reader who cannot move the pointer away, or ` +
        `whose bubble covers the text they were reading, had no way out.`,
    );
    ok(
      `${footnotePost}: dismissing does not move focus`,
      afterEscape.focus === focusBefore,
      `focus went from ${focusBefore} to ${afterEscape.focus}. Dismissing content must ` +
        `not cost the reader their place, which is what 1.4.13 asks for.`,
    );

    /* WCAG 2.2 4.1.3, the copy controls announce */

    /* Asserted on the `role="status"` region; speech is not observable. */
    const codePost = await page.evaluate(
      () => document.querySelectorAll(".prose pre[data-lang] .code-copy").length > 0,
    );
    if (!codePost) {
      skip(
        "the copy controls announce through a status region",
        "this post carries no code block, so there is no copy control to press",
      );
    } else {
      await page.evaluate(() => {
        const button = document.querySelector(".prose pre[data-lang] .code-copy");
        if (button instanceof HTMLElement) button.click();
      });
      await new Promise((r) => setTimeout(r, 250));
      const status = await page.evaluate(() => {
        const region = document.querySelector('[role="status"]');
        return {
          exists: Boolean(region),
          text: region?.textContent?.trim() ?? "",
          hidden: region ? !region.classList.contains("sr-only") : false,
        };
      });
      ok(
        `${footnotePost}: 4.1.3 the copy control writes into a role=status region`,
        status.exists && status.text.length > 0,
        `region present ${status.exists}, text ${JSON.stringify(status.text)}. A button ` +
          `that relabels itself is a change of NAME, not a status message, and generated ` +
          `::after content is not in the accessibility tree at all.`,
      );
      ok(
        `${footnotePost}: the status region is visually hidden, not a second visible label`,
        !status.hidden,
        `the region is not .sr-only, so the announcement is also painted on screen ` +
          `beside the control's own feedback.`,
      );
    }
  }

  /* The cases below navigate for themselves. */
  const postForShape = codePost ?? probedPost;
  if (postForShape === null) {
    skip("a post page's enhancements", "the listing yielded no post links at all");
  } else {
    await page.goto(`${BASE}${postForShape}`, { waitUntil: "networkidle0" });
    ok(
      `${postForShape}: the reading progress bar exists`,
      await page.evaluate(() => Boolean(document.querySelector(".reading-progress"))),
      "script-created and absent without script, so its absence here means the blog " +
        "bundle did not run",
    );

    /*
     * THEME FLIPS IN PLACE. The sentinel proves no navigation happened: a
     * fallback form post would land a fresh document where window.__probe is
     * gone, and the page would still LOOK right, which is why looking is not
     * the assertion.
     */
    /* A dead bundle lets the form navigate; the destroyed-context throw is the finding. */
    /* The hidden twin must be `display: none`, not `.sr-only`, measured via `offsetParent`. */
    const control = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".theme-toggle button")];
      const shown = buttons.filter((b) => /** @type {HTMLElement} */ (b).offsetParent !== null);
      const hidden = buttons.filter((b) => /** @type {HTMLElement} */ (b).offsetParent === null);
      return {
        total: buttons.length,
        shown: shown.length,
        /* An sr-only twin would be laid out, so it would report a box. A
         * display:none one reports none. This is what tells the two apart. */
        hiddenAreDisplayNone: hidden.every(
          (b) => getComputedStyle(/** @type {Element} */ (b)).display === "none",
        ),
        label: shown[0]?.getAttribute("aria-label") ?? null,
        value: shown[0]?.getAttribute("value") ?? null,
        pressed: shown[0]?.hasAttribute("aria-pressed") ?? false,
        /* A DOMRect serializes as an empty object, so return plain numbers. */
        width: shown[0] ? /** @type {HTMLElement} */ (shown[0]).getBoundingClientRect().width : 0,
        height: shown[0] ? /** @type {HTMLElement} */ (shown[0]).getBoundingClientRect().height : 0,
      };
    });
    ok(
      "the theme control offers exactly ONE button, and the twin is display:none",
      control.total === 2 &&
        control.shown === 1 &&
        control.hiddenAreDisplayNone &&
        !control.pressed,
      `${control.total} button(s) in the control, ${control.shown} displayed, the hidden ` +
        `one(s) are display:none ${control.hiddenAreDisplayNone}, the visible one carries ` +
        `aria-pressed ${control.pressed}. A third button is back, or the twin is only ` +
        `visually hidden and a screen reader is being offered both actions.`,
    );
    ok(
      "the visible theme button names the action it performs",
      /^Switch to (light|dark) theme$/.test(control.label ?? "") &&
        (control.value === "light" || control.value === "dark"),
      `aria-label ${JSON.stringify(control.label)}, value ${JSON.stringify(control.value)}. ` +
        `The single control carries no pressed state, so the NAME is the only thing telling ` +
        `a screen reader what activating it will do.`,
    );
    ok(
      "the theme button clears the WCAG 2.2 target floor",
      control.width >= 24 && control.height >= 24,
      `${Math.round(control.width)}x${Math.round(control.height)}px, floor 24x24.`,
    );

    /*
     * SCROLLED FIRST, so the flip below also proves the reader keeps their place. At the top of the
     * page a scroll jump has nowhere to go, which is how a 300px jump on every toggle shipped green.
     */
    const scrolledTo = await page.evaluate(() => {
      window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.4));
      /** @type {any} */ (window).__probe = "same-document";
      return window.scrollY;
    });
    /* Clicked by what is visible; by value could pick the hidden button. */
    const themeClicked = await clickOrFail(
      page,
      '.theme-toggle button[value="dark"]',
      "the theme control is present to click",
    );
    /* Top level, so no return; dependent cases are skipped by name. */
    if (!themeClicked) {
      skip(
        "the theme flips in place, without a navigation, and the control turns around",
        "the theme control could not be clicked, so nothing below it was exercised",
      );
    }
    await new Promise((r) => setTimeout(r, 250));
    /** @type {{ attr: string | null, sameDocument: boolean, shownValue: string | null, shownCount: number, scrollY: number } | null} */
    let flipped = null;
    try {
      flipped = await page.evaluate(() => {
        const shown = [...document.querySelectorAll(".theme-toggle button")].filter(
          (b) => /** @type {HTMLElement} */ (b).offsetParent !== null,
        );
        return {
          attr: document.documentElement.getAttribute("data-theme"),
          sameDocument: /** @type {any} */ (window).__probe === "same-document",
          shownValue: shown[0]?.getAttribute("value") ?? null,
          shownCount: shown.length,
          scrollY: window.scrollY,
        };
      });
    } catch {
      flipped = null;
    }
    if (themeClicked) ok(
      "the theme flip keeps the reader's scroll position",
      scrolledTo > 0 && flipped !== null && flipped.scrollY === scrolledTo,
      scrolledTo === 0
        ? `${postForShape} is too short to scroll, so this case measured nothing.`
        : `scrolled to ${scrolledTo}, after the flip ${flipped?.scrollY ?? "a new document"}. ` +
            `The focus hand-off in app/enhance/theme.ts lost preventScroll, or something ` +
            `else on the flip moves the page.`,
    );
    if (themeClicked) ok(
      "the theme flips in place, without a navigation, and the control turns around",
      flipped !== null &&
        flipped.attr === "dark" &&
        flipped.sameDocument &&
        /* The visible button now offers light: the cascade re-resolved. */
        flipped.shownValue === "light" &&
        flipped.shownCount === 1,
      flipped === null
        ? "the click caused a real navigation: the theme bundle did not intercept the " +
            "submit (the form fallback is what carried the click)"
        : `data-theme=${JSON.stringify(flipped.attr)}, same document ${flipped.sameDocument}, ` +
            `the visible button now posts ${JSON.stringify(flipped.shownValue)} and there ` +
            `are ${flipped.shownCount} of them. The theme bundle did not run, the submit ` +
            `interception broke, or the cascade did not turn the control around.`,
    );

    /*
     * Rule 9's fallback, with JavaScript disabled. Only the path is asserted: `Referer`
     * never carries a fragment.
     */
    {
      const scriptless = await browser.newPage();
      try {
        await scriptless.setJavaScriptEnabled(false);
        /* Clear the theme cookie the scripted case left, so this page loads as a first-time reader's. */
        await scriptless.deleteCookie({ name: "theme", url: BASE });
        const hash = "#a-fragment-to-return-to";
        await scriptless.goto(`${BASE}${postForShape}${hash}`, { waitUntil: "networkidle0" });

        const before = await scriptless.evaluate(() => {
          const shown = [...document.querySelectorAll(".theme-toggle button")].filter(
            (b) => /** @type {HTMLElement} */ (b).offsetParent !== null,
          );
          return {
            count: shown.length,
            value: shown[0]?.getAttribute("value") ?? null,
            attr: document.documentElement.getAttribute("data-theme"),
          };
        });
        ok(
          "with script OFF the theme control still offers exactly one button",
          before.count === 1 && (before.value === "light" || before.value === "dark"),
          `${before.count} visible button(s), value ${JSON.stringify(before.value)}. The ` +
            `cascade decides which one shows, so this must hold with no script at all; ` +
            `if it does not, the control depends on the enhancement to be usable.`,
        );

        /*
         * Click the button just read as visible, never by position: the shared cookie jar may have
         * hidden the first one, and puppeteer throws on a hidden element.
         */
        await Promise.all([
          scriptless.waitForNavigation({ waitUntil: "networkidle0" }),
          clickOrFail(
            scriptless,
            `.theme-toggle button[value="${before.value}"]`,
            "the scriptless theme control is present to click",
          ),
        ]);

        const after = await scriptless.evaluate(() => ({
          attr: document.documentElement.getAttribute("data-theme"),
          hash: location.hash,
          path: location.pathname,
        }));
        ok(
          "with script OFF the form post changes the theme and returns the reader to the same page",
          after.attr === before.value && after.path === postForShape,
          `asked for ${JSON.stringify(before.value)}, came back with ` +
            `data-theme=${JSON.stringify(after.attr)} at ` +
            `${after.path}${after.hash}. The no-script path is the one hard rule 9 ` +
            `requires to work: the enhancement is allowed to fail, this is not.`,
        );
        /*
         * Reported, not asserted: the fragment is unreachable by construction, so a failure here
         * would be permanent and say nothing about the code.
         */
        if (after.hash !== hash) {
          report(
            `the scriptless theme post drops the fragment (${JSON.stringify(hash)} -> ` +
              `${JSON.stringify(after.hash)}). Not a defect and not fixable server-side: ` +
              `Referer never carries a fragment (RFC 9110), so /theme cannot learn it. ` +
              `The scripted path holds the reader's position by not navigating at all.`,
          );
        }
      } finally {
        await scriptless.close();
      }
    }

    /*
     * THE HEADER MENU, RULE 9's FALLBACK, with JavaScript disabled. Ruling 126 puts the
     * destinations behind a menu on narrow widths, so with no script that menu IS the navigation:
     * if it does not open, six destinations are unreachable from the header.
     *
     * At a narrow viewport, because that is the only width it is shown at. Asserted by OPENING it
     * and then FOLLOWING a link: a details element that opens but whose links do not navigate
     * would satisfy a check that stopped at `open`.
     */
    {
      const noScript = await browser.newPage();
      try {
        await noScript.setJavaScriptEnabled(false);
        await noScript.setViewport({ width: 375, height: 700 });
        await noScript.goto(BASE, { waitUntil: "networkidle0" });

        const menu = await noScript.evaluate(() => {
          const details = document.querySelector("[data-header-menu]");
          if (!details) return null;
          return {
            displayed: getComputedStyle(details).display !== "none",
            open: /** @type {HTMLDetailsElement} */ (details).open,
            links: details.querySelectorAll("a").length,
          };
        });

        ok(
          "the header menu is present and closed with no script",
          menu !== null && menu.displayed && !menu.open && menu.links > 0,
          `menu state ${JSON.stringify(menu)}. At 375 the destinations live behind this control, ` +
            `so an absent or hidden one is a header with no navigation at all.`,
        );

        await noScript.click(".site-header-menu-button");
        ok(
          "the header menu OPENS with no script, because it is a details element",
          await noScript.$eval("[data-header-menu]", (d) => /** @type {HTMLDetailsElement} */ (d).open),
          "clicking the summary did not open it. A menu that needs script to open is not rule " +
            "9's fallback, it is the enhancement pretending to be one.",
        );

        const target = await noScript.$eval(".site-header-menu-panel a", (a) =>
          a.getAttribute("href"),
        );
        await Promise.all([
          noScript.waitForNavigation({ waitUntil: "domcontentloaded" }),
          noScript.click(".site-header-menu-panel a"),
        ]);
        ok(
          "a header menu link NAVIGATES with no script",
          new URL(noScript.url()).pathname === target,
          `landed on ${new URL(noScript.url()).pathname}, expected ${target}. Opening is half the ` +
            `contract; the other half is that the thing inside goes somewhere.`,
        );
      } finally {
        await noScript.close();
      }
    }

    /*
     * The palette: clicking the trigger opens it. The hint is server-rendered `hidden` and
     * unhidden only once the listener exists.
     */
    // The hint must exist and be unhidden (a missing hint makes `!hidden` true), and the anchor's
    // `aria-describedby` must resolve to it, or no screen reader reads it.
    const hintShown = await page.evaluate(() => {
      const hint = document.querySelector("[data-search-hint]");
      const trigger = document.querySelector("[data-search-trigger]");
      if (!(hint instanceof HTMLElement) || !(trigger instanceof HTMLElement)) return null;
      const described = trigger.getAttribute("aria-describedby");
      return {
        unhidden: !hint.hidden,
        associated: Boolean(described) && described === hint.id && hint.id !== "",
        /*
         * The title must name the live key. `-K` rather than the whole chord, because the modifier is
         * Command on a Mac and Control elsewhere.
         */
        titled: /-K\b/.test(trigger.getAttribute("title") ?? ""),
        text: (hint.textContent ?? "").trim(),
        /*
         * The announced text must name the same key; length alone is hard rule 10's unfailable
         * condition.
         */
        textNamesKey: /-K\b/.test((hint.textContent ?? "").trim()),
        painted: Boolean(trigger.querySelector("kbd")),
      };
    });
    ok(
      "the shortcut hint is unhidden, associated and unpainted once the palette is listening",
      hintShown !== null &&
        hintShown.unhidden &&
        hintShown.associated &&
        hintShown.titled &&
        hintShown.text.length > 0 &&
        hintShown.textNamesKey &&
        !hintShown.painted,
      hintShown === null
        ? "the [data-search-hint] or [data-search-trigger] element is missing, so the " +
            "header lost the hint or the control"
        : `unhidden ${hintShown.unhidden}, aria-describedby resolves ${hintShown.associated}, ` +
            `title names the chord ${hintShown.titled}, text ${JSON.stringify(hintShown.text)}, ` +
            `that text names the chord ${hintShown.textNamesKey}, a <kbd> is painted inside ` +
            `the control ${hintShown.painted}. The theme bundle did not run, the badge came ` +
            `back, or a surface still advertises a shortcut that was retired.`,
    );

    /*
     * The palette bundle is fetched only on the first gesture. Counted from the resource timeline,
     * not the DOM, because a fetch is what rule 4 grades; matched loosely past the content hash.
     */
    const paletteFetches = () =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((entry) => /\/assets\/palette-[^/]*\.js$/.test(entry.name)).length,
      );

    const beforeGesture = await paletteFetches();
    ok(
      "the palette bundle is NOT fetched by a page nobody searched on",
      beforeGesture === 0,
      `${beforeGesture} request(s) for the palette bundle before any gesture. It is ` +
        `back on every document, which is the cost this split removed: a reader who ` +
        `never opens search should never download the dialog.`,
    );

    /* Clicked, not typed: the click is the gesture every reader has. */
    const triggerClicked = await clickOrFail(
      page,
      "[data-search-trigger]",
      "the search trigger is present to click",
    );
    /* Polled, not slept: opening costs a network round trip for the bundle, so a fixed wait races. */
    let paletteOpen = { open: false, focused: false };
    let navigatedToSearch = false;
    if (triggerClicked) {
      for (let i = 0; i < 25; i += 1) {
        await new Promise((r) => setTimeout(r, 200));
        paletteOpen = await page.evaluate(() => ({
          open: Boolean(document.querySelector("dialog.palette[open]")),
          focused: document.activeElement?.classList.contains("palette-input") ?? false,
        }));
        // THE OTHER LEGAL OUTCOME. With no bundle, theme.ts falls back to
        // location.assign('/search'), and a reader who lands on the real search
        // page has been served correctly even though no dialog opened.
        navigatedToSearch = /\/search(\?|$)/.test(page.url());
        if ((paletteOpen.open && paletteOpen.focused) || navigatedToSearch) break;
      }
    }
    ok(
      "clicking the search trigger opens the palette with focus in its input, or navigates to /search",
      (paletteOpen.open && paletteOpen.focused) || navigatedToSearch,
      `open ${paletteOpen.open}, input focused ${paletteOpen.focused}, url ${page.url()}. ` +
        `The gesture is bound in theme.ts and the dialog is built by the bundle it appends, ` +
        `so this fails if either half broke, including a CSP that refuses the injected ` +
        `script. Navigating to /search is the accepted fallback; navigating anywhere ` +
        `else, or nowhere, is not.`,
    );

    /*
     * EVERYTHING THAT READS THE OPEN DIALOG RUNS BEFORE ANYTHING THAT SUBMITS IT. The query case
     * below presses Enter, which navigates to /search; run first, it left these three measuring a
     * page with no dialog and a fresh resource timeline, so they failed on a palette that worked.
     *
     * The dialog arrives styled: its CSS loads on demand, and an unstyled `<dialog open>` still
     * passes the open check. Compared against the `--border` token, never a literal.
     */
    const dialogStyled = await page.evaluate(() => {
      const dialog = document.querySelector("dialog.palette");
      if (!dialog) return null;
      const style = getComputedStyle(dialog);
      return {
        borderTopWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        background: style.backgroundColor,
      };
    });
    ok(
      "the palette dialog is styled by the time it opens",
      dialogStyled !== null &&
        dialogStyled.borderTopWidth === "1px" &&
        dialogStyled.borderRadius !== "0px",
      `computed ${JSON.stringify(dialogStyled)}. The dialog's stylesheet is fetched ` +
        `on the gesture beside the bundle and awaited before opening; a default ` +
        `border here means it did not arrive, or arrived after the modal was up.`,
    );

    const afterGesture = await paletteFetches();
    ok(
      "the gesture fetches the palette bundle, exactly once",
      afterGesture === 1,
      `${afterGesture} request(s) after the gesture. Zero means the loader never ran ` +
        `or the injected script was refused (check the console for a CSP violation); ` +
        `more than one means the once-only guard in theme.ts stopped holding.`,
    );
    if (paletteOpen.open) {
      // Guarded for the same reason as the case above: a missing field here
      // threw and voided the rest of the run.
      const resultsField = await page.$(".palette-input");
      if (!resultsField) {
        ok(
          "the palette returns live results",
          false,
          "the palette is open and has no .palette-input, so no query could be typed.",
        );
      } else {
      await resultsField.type("cloudflare");
      // The debounce and a cold D1 query both outlast a fixed wait; poll instead.
      let paletteResult = { options: 0, status: "" };
      for (let i = 0; i < 25; i += 1) {
        await new Promise((r) => setTimeout(r, 200));
        paletteResult = await page.evaluate(() => ({
          options: document.querySelectorAll(".palette-option").length,
          status: document.querySelector(".palette-status")?.textContent ?? "",
        }));
        if (paletteResult.options > 0 || /result|unavailable/i.test(paletteResult.status)) break;
      }
      ok(
        "the palette returns live results",
        paletteResult.options > 0,
        `0 options after 5s; status ${JSON.stringify(paletteResult.status)}. The JSON ` +
          `endpoint or the palette's fetch path broke.`,
      );
      /* Emptied, not closed: the query case below types into this same open field. */
      await resultsField.evaluate((input) => {
        /** @type {HTMLInputElement} */ (input).value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      }
    }

    /*
     * LAST, because it leaves the page. The query survives the gesture: type a real query, submit
     * it, and the resulting URL must carry it. A control that lands on a bare /search fails here.
     */
    if (paletteOpen.open) {
      const QUERY = "phage cocktail";
      /* Typed through a handle, not `page.type`, which throws on a missing field and voids the run. */
      const field = await page.$(".palette-input");
      if (!field) {
        ok(
          "the typed query survives the search gesture and reaches the URL",
          false,
          "the palette reported itself open but carries no .palette-input to type into, " +
            "so the query could not be entered. The dialog opened without its field.",
        );
      } else {
        await field.type(QUERY);
        await page.keyboard.press("Enter");

        // Polled rather than slept: the submit is a navigation on some paths and
        // a same-document update on others, and a fixed wait races both.
        let landed = page.url();
        for (let i = 0; i < 25; i += 1) {
          await new Promise((r) => setTimeout(r, 200));
          landed = page.url();
          if (/[?&]q=/.test(landed)) break;
        }

        const carried = (() => {
          try {
            return new URL(landed).searchParams.get("q");
          } catch {
            return null;
          }
        })();

        ok(
          "the typed query survives the search gesture and reaches the URL",
          carried === QUERY,
          `submitted ${JSON.stringify(QUERY)} and landed on ${landed}, whose q is ` +
            `${JSON.stringify(carried)}. A control that navigates to a bare /search ` +
            `throws the reader's query away, which is what build 2 shipped and what ` +
            `no offline gate could see.`,
        );
      }
    } else {
      skip(
        "the typed query survives the search gesture and reaches the URL",
        "the palette never opened, so there was no field to type a query into",
      );
    }
  }

  /*
   * The image link, both states. Without script the image's parent is an anchor whose href
   * serves an image (a 200 with an image type, not a well-formed string). With script the
   * overlay shows the anchor's href, compared raw, attribute to attribute: `currentSrc` is
   * absolute, so the raw form discriminates on any image.
   */
  {
    /*
     * The subject comes from the on-disk artifact, over the whole corpus, not a capped crawl. A
     * deployed origin may lack a named post, so a candidate without the anchor skips, not fails.
     */
    const artifact = JSON.parse(
      readFileSync(join(root, "content", "generated", "posts.json"), "utf8"),
    );
    const candidates = artifact.posts
      .filter((/** @type {any} */ p) => p.draft !== true)
      .filter((/** @type {any} */ p) => String(p.html ?? "").includes('class="image-link"'))
      .map((/** @type {any} */ p) => `/blog/${p.slug}`);

    let imagePost = null;
    for (const path of candidates) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
      const has = await page.evaluate(
        () => document.querySelectorAll(".prose a.image-link > img").length > 0,
      );
      if (has) {
        imagePost = path;
        break;
      }
    }

    if (imagePost === null) {
      /* No body image in the corpus is a content fact, not a defect, so this skips loudly. */
      skip(
        "post images link to their originals, and the lightbox opens the link",
        candidates.length === 0
          ? `the artifact's ${artifact.posts.length}-post corpus carries no body image ` +
              `at all, so there is no anchor on any page to look at. The pipeline wrap ` +
              `is proven by test/post-image-links.test.mjs; this is the WIRE half and ` +
              `it stays unobserved until a post cites an image.`
          : `the artifact names ${candidates.length} post(s) carrying an image-link ` +
              `(${candidates.join(", ")}) and NONE of them served one. Against a ` +
              `deployed origin that means the disk is ahead of the deployment; against ` +
              `the preview build it is a real defect and should be read as one.`,
      );
    } else {
      const scriptless = await browser.newPage();
      await scriptless.setJavaScriptEnabled(false);
      await scriptless.goto(`${BASE}${imagePost}`, { waitUntil: "networkidle0" });
      const served = await scriptless.evaluate(() => {
        const image = document.querySelector(".prose img");
        const parent = image?.parentElement ?? null;
        return {
          image: Boolean(image),
          anchor: parent?.tagName === "A",
          klass: parent?.className ?? "",
          href: parent?.getAttribute("href") ?? "",
        };
      });
      await scriptless.close();

      ok(
        `${imagePost}: with script off, the image's parent is an image-link anchor`,
        served.image && served.anchor && served.klass.includes("image-link") && served.href !== "",
        `image ${served.image}, parent is an anchor ${served.anchor}, class ` +
          `${JSON.stringify(served.klass)}, href ${JSON.stringify(served.href)}. The ` +
          `pipeline stopped wrapping, or the wrap did not survive to the served HTML.`,
      );

      let delivered = { status: 0, type: "" };
      if (served.href) {
        const response = await fetch(new URL(served.href, BASE));
        delivered = {
          status: response.status,
          type: response.headers.get("content-type") ?? "",
        };
      }
      ok(
        `${imagePost}: the anchor's href serves an image`,
        delivered.status === 200 && delivered.type.startsWith("image/"),
        `${served.href} answered ${delivered.status} ${JSON.stringify(delivered.type)}. ` +
          `A fallback that 404s is worse than no fallback: the click used to do nothing.`,
      );

      // The page is already open on imagePost from the walk above.
      await page.click(".prose a.image-link");
      await new Promise((r) => setTimeout(r, 250));
      const overlay = await page.evaluate(() => {
        const shown = document.querySelector(".lightbox img");
        return {
          open: shown instanceof HTMLImageElement,
          src: shown instanceof HTMLImageElement ? shown.getAttribute("src") : null,
        };
      });
      ok(
        `${imagePost}: clicking the link opens the overlay on the ORIGINAL`,
        overlay.open && overlay.src === served.href,
        `overlay open ${overlay.open}, overlay src ${JSON.stringify(overlay.src)}, ` +
          `anchor href ${JSON.stringify(served.href)}. A mismatch means the lightbox ` +
          `went back to reading currentSrc, which is the resized copy already on ` +
          `screen; overlay absent means the click navigated instead of being caught.`,
      );

      /*
       * A real modal dialog, asserted through `matches("dialog:modal")`, which only `showModal()`
       * satisfies: attributes on a div are a claim, modality is a behavior.
       */
      const modal = await page.evaluate(() => {
        const el = document.querySelector(".lightbox");
        return {
          tag: el?.tagName ?? "(absent)",
          isModal: el instanceof HTMLDialogElement && el.matches("dialog:modal"),
          label: el?.getAttribute("aria-label") ?? "",
          closeButton: Boolean(el?.querySelector("button.lightbox-close")),
          focusInside: Boolean(el && document.activeElement && el.contains(document.activeElement)),
        };
      });
      ok(
        `${imagePost}: the lightbox is a modal <dialog>, not a div`,
        modal.isModal,
        `element is <${modal.tag}> and dialog:modal is ${modal.isModal}. A div with ` +
          `role="dialog" passes an attribute check and still has no focus trap, no ` +
          `inert page behind it and no Escape unless focus is inside it.`,
      );
      ok(
        `${imagePost}: the lightbox carries an accessible name`,
        modal.label.length > 0,
        `aria-label ${JSON.stringify(modal.label)}. A dialog announces itself and then ` +
          `has nothing to say; the image's alt is the only description there is.`,
      );
      ok(
        `${imagePost}: the lightbox has a visible close control`,
        modal.closeButton,
        `no button.lightbox-close. Escape and a backdrop click are both real ways out ` +
          `and neither is discoverable, so a touch reader with no keyboard had none.`,
      );
      ok(
        `${imagePost}: opening the lightbox moves focus into it`,
        modal.focusInside,
        `focus is outside the dialog, so the platform's containment has nothing to ` +
          `contain and the next Tab leaves the modal.`,
      );

      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 200));
      const afterEscape = await page.evaluate(() => ({
        gone: document.querySelector(".lightbox") === null,
        focusedLink: document.activeElement?.classList.contains("image-link") ?? false,
      }));
      ok(
        `${imagePost}: Escape closes it and focus returns to the link`,
        afterEscape.gone && afterEscape.focusedLink,
        `dialog removed ${afterEscape.gone}, focus back on the image link ` +
          `${afterEscape.focusedLink}. Focus left behind on a removed element sends the ` +
          `next Tab to the top of the document.`,
      );
    }
  }

  /*
   * THE ASK AFFORDANCE, visible and bound, never clicked (clicking bills; see
   * the section header). `data-ask-bound` is the bundle's own idempotence
   * marker, so its presence proves the init ran against this very element.
   */
  await page.goto(`${BASE}/search?q=how+does+search+work`, { waitUntil: "networkidle0" });
  const askState = await page.evaluate(() => {
    const trigger = document.querySelector("[data-ask-trigger]");
    if (!(trigger instanceof HTMLElement)) return { present: false, visible: false, bound: false };
    return { present: true, visible: !trigger.hidden, bound: trigger.dataset.askBound === "true" };
  });
  ok(
    "the Ask trigger is server-rendered, unhidden and bound",
    askState.present && askState.visible && askState.bound,
    `present ${askState.present}, visible ${askState.visible}, bound ${askState.bound}. ` +
      `Absent means search.tsx stopped rendering the mount (or Ask is unbound on this ` +
      `deployment); hidden or unbound means the ask bundle did not run.`,
  );

  /*
   * The script set per page: enhancement bundles only, no framework, no modulepreload. The wire
   * half of check:page-payload.
   */
  for (const path of ["/", postForShape, "/search?q=workers"].filter(Boolean)) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const shape = await page.evaluate(() => ({
      srcs: [...document.querySelectorAll("script[src]")].map(
        (s) => s.getAttribute("src") ?? "",
      ),
      preloads: document.querySelectorAll('link[rel="modulepreload"]').length,
    }));
    const foreign = shape.srcs.filter((src) => {
      const name = src.split("/").pop() ?? "";
      const stem = name.replace(/-[A-Za-z0-9_-]{8}\.js$/, "");
      return !enhanceStems.has(stem);
    });
    ok(
      `${path}: the script set is enhancement bundles only, with no modulepreload`,
      foreign.length === 0 && shape.preloads === 0 && shape.srcs.length > 0,
      `script srcs [${shape.srcs.join(", ")}], ${shape.preloads} modulepreload(s). ` +
        `A framework chunk is riding on a public page again, or the enhancement ` +
        `tags vanished entirely.`,
    );
  }

  ok(
    "no console errors across the public enhancement cases",
    publicConsoleErrors.length === 0,
    `${publicConsoleErrors.length} error(s):\n        ${publicConsoleErrors
      .slice(0, 5)
      .join("\n        ")}`,
  );
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");

  /* ------------------------------- 6. the admin plane, opt-in, deployed only */

  /*
   * Catches markup that renders while a component never mounts. These cases observe
   * ADMIN_ORIGIN, a deployed Worker; every other case observes the preview build.
   */
  /*
   * Only an absent credential is a skip. A supplied but unusable one fails, with a message
   * naming the repair:
   *
   *   malformed  the cookie cannot be used; fix the format.
   *   no origin  a session was supplied and there is nowhere to send it.
   *   rejected   the server said no, usually an expired session; refill the file.
   */
  if (!CREDENTIAL_PRESENT) {
    ok(
      "the admin plane has a credential to observe it with",
      false,
      `no admin credential of either kind, so NONE of this ran: the 6 admin surfaces, the ` +
        `editor mount, the two mark fills, the four media interactions, and the ` +
        `sideways-scroll cases at 1280, 553, 480, 400 and 320.\n` +
        `        These cases need a REAL credential and are deliberately ` +
        `not stubbed: a fake auth path would not render what production renders, and the ` +
        `defects they exist to catch live in the authenticated render.\n` +
        `        PREFERRED, and the one that runs unattended: mint a smoke token with ` +
        `\`node scripts/mint-smoke-token.mjs > .smoke-token\`, set it on the Worker with ` +
        `\`npx wrangler secret put SMOKE_TOKEN < .smoke-token\`, and set ADMIN_ORIGIN.\n` +
        `        OR: copy ${SESSION_EXAMPLE} to .admin-session and paste a live session ` +
        `cookie into it. That file carries the five Chrome clicks. Both are gitignored.`,
    );
  } else if (CREDENTIAL_ERROR) {
    ok(
      `the ${CREDENTIAL} credential supplied in ${CREDENTIAL_SOURCE} is usable`,
      false,
      `${CREDENTIAL_ERROR}\n` +
        `        This is a FORMAT or CONFIGURATION problem, not a rejected credential. ` +
        `${CREDENTIAL === "smoke" ? "See RECOVERY.md for the three places the token goes." : `See ${SESSION_EXAMPLE}.`} ` +
        `The admin cases below did not run.`,
    );
  } else if (!ADMIN_ORIGIN) {
    ok(
      "the admin cases have an origin to drive",
      false,
      `a ${CREDENTIAL} credential was supplied in ${CREDENTIAL_SOURCE} and no origin was. ` +
        `These cases CANNOT run against the preview server, and that is true of BOTH ` +
        `credentials for the same underlying reason: neither one exists there. Sessions live ` +
        `in the production KV namespace and the preview reads local miniflare storage; ` +
        `SMOKE_TOKEN is a wrangler secret and this repo has no .dev.vars by design, so the ` +
        `preview would answer 503 not-configured. Measured for the cookie, and structural ` +
        `for the token.\n` +
        `        Set ADMIN_ORIGIN, or add an \`origin =\` line to .admin-session. The admin ` +
        `cases below did not run.`,
    );
  } else if (!(AUTH_RESULT = await credentialAuthenticates(ADMIN_ORIGIN)).ok) {
    ok(
      `the ${CREDENTIAL} credential supplied in ${CREDENTIAL_SOURCE} authenticates against ${ADMIN_ORIGIN}`,
      false,
      CREDENTIAL === "smoke"
        ? `GET /admin with it did not return 200. The status NAMES the repair, which is why ` +
          `the smoke path reports one rather than guessing:\n` +
          `        ${smokeRepair(AUTH_RESULT.status)}\n` +
          `        The admin cases below did not run.`
        : `GET /admin with it did not return 200, so the session is almost certainly EXPIRED. ` +
          `The format parsed fine and the cookie was named ${SESSION_COOKIE_NAME}, so this is ` +
          `not a broken test and not a code defect.\n` +
          `        TO FIX: ${REFILL_HINT}\n` +
          `        The other possibility is that ${ADMIN_ORIGIN} does not share the production ` +
          `KV namespace. The admin cases below did not run.`,
    );
  } else {
    /*
     * State which credential ran: the smoke token is read-only, so its green says nothing about
     * writes; the cookie is Dustin, so its green says nothing about CI.
     */
    console.log(
      CREDENTIAL === "smoke"
        ? `\n  admin credential: THE SMOKE TOKEN, read from ${SMOKE_SOURCE}` +
          `\n  admin cases: observing ${ADMIN_ORIGIN} (DEPLOYED, not the preview build)` +
          `\n  the smoke actor is READ ONLY: every case below is a GET, and no write surface is exercised\n`
        : `\n  admin credential: the pasted session cookie, read from ${COOKIE_SOURCE}` +
          `\n  NO SMOKE TOKEN was found, so these cases needed a human to supply a session.` +
          `\n  To run them unattended, see RECOVERY.md: node scripts/mint-smoke-token.mjs` +
          `\n  admin cases: observing ${ADMIN_ORIGIN} (DEPLOYED, not the preview build)\n`,
    );
    ok(`the supplied ${CREDENTIAL} credential authenticates against ${ADMIN_ORIGIN}`, true);
    adminCasesRan = true;

    const admin = await browser.newPage();
    /** @type {string[]} */
    const errors = [];
    admin.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    /** @type {number[]} */
    const fetched = [];
    admin.on("response", (r) => {
      if (/markdown-editor.*\.js/.test(r.url())) fetched.push(r.status());
    });
    await applyCredential(admin, ADMIN_ORIGIN);
    await admin.setViewport({ width: 1280, height: 900 });

    /* ---------------------------------------- 6a. every surface renders */

    /*
     * The shell (sidebar and topbar) is the assertion, not the title, which survives an empty
     * body. The login page is named, because a bounced session renders a complete page.
     */
    const SURFACES = [
      ["/admin", "the cockpit"],
      ["/admin/posts", "the posts list"],
      ["/admin/media?view=grid", "the media library, grid"],
      ["/admin/media?view=list", "the media library, list"],
      ["/admin/tools", "tools"],
      ["/admin/origin-requests", "origin requests"],
      /*
       * Asserts only that the route renders in the shell and fits, not its structure: this observes
       * a deployed Worker, and structure is check:admin-ui's, which renders the working tree.
       */
      ["/admin/mentions", "the mentions queue"],
    ];
    for (const [path, what] of SURFACES) {
      await admin.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
      const r = await admin.evaluate(() => ({
        sidebar: !!document.querySelector(".admin-sidebar"),
        topbar: !!document.querySelector(".admin-topbar"),
        onLogin: location.pathname === "/login",
        textLen: (document.body.innerText || "").trim().length,
      }));
      ok(
        `${path}: ${what} renders the admin shell`,
        r.sidebar && r.topbar && !r.onLogin && r.textLen > 100,
        r.onLogin
          ? "the session bounced to /login part way through the sweep"
          : `sidebar=${r.sidebar} topbar=${r.topbar} bodyText=${r.textLen} chars`,
      );
    }

    /* ----------------- 6b. the mark fills: the base binding, and full color */

    /*
     * The mark's base fill lives in app.css and nothing overrides it on either plane since ruling
     * 118.2. It is asserted as resolved color against the token, never a hex, because @import
     * order decides what wins and a hex here would be a second owner of the palette.
     */
    const rgb = (/** @type {string} */ hex) => {
      const h = hex.trim().replace("#", "");
      const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };

    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const adminMark = await admin.evaluate(() => {
      const el = document.querySelector(".admin-brand-mark .site-logo-brand");
      const root = getComputedStyle(document.documentElement);
      return {
        present: !!el,
        fill: el ? getComputedStyle(el).fill : "",
        brand: root.getPropertyValue("--brand").trim(),
      };
    });
    ok(
      "the admin sidebar mark exists to measure",
      adminMark.present,
      "no .admin-brand-mark .site-logo-brand, so the fill assertion below would examine nothing",
    );
    ok(
      "the admin mark's fill resolves to --brand, the base binding in app.css",
      adminMark.present && adminMark.fill === rgb(adminMark.brand),
      `fill is ${JSON.stringify(adminMark.fill)} and --brand is ${JSON.stringify(adminMark.brand)} ` +
        `(${rgb(adminMark.brand || "#000")}). The base rule in app.css is not reaching the admin mark.`,
    );

    await admin.goto(`${ADMIN_ORIGIN}/`, { waitUntil: "networkidle0" });
    const publicMark = await admin.evaluate(() => {
      const paths = [...document.querySelectorAll(".site-header .site-header-mark path")];
      const fill = (/** @type {Element} */ el) => getComputedStyle(el).fill;
      return {
        total: paths.length,
        brand: paths.filter((el) => el.classList.contains("site-logo-brand")).map(fill),
        warm: paths.filter((el) => !el.classList.contains("site-logo-brand")).map(fill),
        token: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
      };
    });
    ok(
      "the public header mark exists to measure",
      publicMark.total === 8 && publicMark.brand.length === 5 && publicMark.warm.length === 3,
      `the header drew ${publicMark.total} paths, ${publicMark.brand.length} of them branded, so ` +
        `the fill assertions below would examine nothing. check:logo owns the counts.`,
    );
    ok(
      "the public header mark's purple resolves to --brand, the base binding in app.css",
      publicMark.brand.length > 0 && publicMark.brand.every((f) => f === rgb(publicMark.token)),
      `fills are ${JSON.stringify(publicMark.brand)} and --brand is ` +
        `${JSON.stringify(publicMark.token)} (${rgb(publicMark.token || "#000")}). Ruling 118.2 ` +
        `removed the header override, so the (0,1,0) base in app.css has to reach the mark, ` +
        `which is what the sixteen-file split put at risk.`,
    );
    /*
     * FULL COLOUR, MEASURED AS COLOURS. Asserted by DIFFERENCE rather than against three hexes,
     * whose one owner is site-logo.tsx: one ink means all eight paths compute to the same fill, so
     * a warm path equal to the purple is exactly the regression ruling 118.2 reversed. Hex
     * equality here would be a second owner, and it would pass a mark re-inked to those hexes.
     */
    ok(
      "the public header mark's warm paths keep their own fills, so the mark is not one ink",
      publicMark.warm.length > 0 &&
        publicMark.warm.every((f) => f && !publicMark.brand.includes(f)) &&
        new Set(publicMark.warm).size === publicMark.warm.length,
      `warm fills are ${JSON.stringify(publicMark.warm)} against purple ` +
        `${JSON.stringify(publicMark.brand[0])}. A stylesheet is repainting the presentation ` +
        `attributes site-logo.tsx sets, which is the one-ink header ruling 118.2 retired.`,
    );

    /* ----------------------------------------- 6c. the mount class */

    await admin.goto(`${ADMIN_ORIGIN}/admin/posts`, { waitUntil: "networkidle0" });
    const slug = await admin.evaluate(() => {
      const a = document.querySelector('a[href*="/edit"]');
      return a ? a.getAttribute("href") : null;
    });

    ok(
      "an edit route was reachable with the supplied session",
      !!slug,
      "no edit link on /admin/posts, so the mount assertions below examine nothing",
    );

    if (slug) {
      await admin.goto(`${ADMIN_ORIGIN}${slug}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 2500));
      const mounted = await admin.evaluate(() => !!document.querySelector(".cm-editor"));
      ok("the CodeMirror chunk was fetched", fetched.length > 0, "no markdown-editor chunk request");
      ok(
        "the chunk was served, not refused",
        fetched.every((s) => s === 200),
        `statuses ${fetched.join(", ")}`,
      );
      ok(".cm-editor exists in the live DOM", mounted, "the Suspense boundary never resolved");
      ok(
        "no React #419 in the console",
        !errors.some((e) => /#419|Minified React error/.test(e)),
        errors.filter((e) => /#419|Minified React error/.test(e)).join(" | "),
      );
    }

    /* ------------------------------------- 6d. the media interactions --- */

    /*
     * Four interactions on /admin/media that check:admin-ui cannot see, since it renders without
     * scripts or styles. Nothing here submits, under either credential: the cookie path runs as
     * Dustin. Unreachable confirmations are on the remaining-human list below.
     */
    await admin.setViewport({ width: 1280, height: 900 });

    /* --- (i) the list view renders a header, and it marks the sorted column - */

    /* Sorted by size, not the default, so a header that hardcodes its active column fails. */
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?view=list&sort=size`, {
      waitUntil: "networkidle0",
    });
    const listHead = await admin.evaluate(() => {
      const head = document.querySelector(".media-list-head");
      if (!head) return null;
      const cells = [...head.querySelectorAll(".media-col-head")].map((el) => ({
        label: (el.textContent || "").trim(),
        active: el.classList.contains("is-active"),
        sortable: el.tagName.toLowerCase() === "a",
        href: el.getAttribute("href") || "",
        sortKey: el.getAttribute("data-sort") || "",
        ariaSort: el.getAttribute("aria-sort") || "",
      }));
      return { cells, rows: document.querySelectorAll("[data-tile]").length };
    });

    ok(
      "/admin/media?view=list: the list view renders its header row",
      !!listHead && listHead.cells.length >= 5,
      listHead
        ? `${listHead.cells.length} header cell(s), expected the five columns`
        : "no .media-list-head at all, so the sort assertions below examine nothing",
    );
    ok(
      "the list header marks exactly the column the URL sorted by",
      !!listHead &&
        listHead.cells.filter((c) => c.active).length === 1 &&
        listHead.cells.some((c) => c.active && c.label.startsWith("Size")),
      listHead
        ? `active: ${listHead.cells.filter((c) => c.active).map((c) => c.label).join(", ") || "(none)"}. ` +
          `The URL asked for sort=size, so Size and nothing else should carry is-active.`
        : "not measured",
    );
    /*
     * Every sortable cell is an anchor, so sorting has an address. Not every href carries `sort=`:
     * `hrefWith` omits a parameter equal to its default.
     */
    ok(
      "every sortable header cell is a real link, so sorting has an address",
      !!listHead &&
        listHead.cells.filter((c) => c.sortable).length === 4 &&
        listHead.cells
          .filter((c) => c.sortable)
          .every((c) => c.href.startsWith("/admin/media") && c.sortKey.length > 0),
      listHead
        ? `${listHead.cells.filter((c) => c.sortable).length} anchor(s) of the four sortable ` +
          `columns; hrefs ${JSON.stringify(listHead.cells.filter((c) => c.sortable).map((c) => c.href))}. ` +
          `A header cell that is not an anchor does not work with scripting off.`
        : "not measured",
    );
    /* `aria-sort="none"` on the others tells a screen reader they can be sorted. */
    ok(
      "exactly one column carries a live aria-sort, and it is the sorted one",
      !!listHead &&
        listHead.cells.filter((c) => c.ariaSort && c.ariaSort !== "none").length === 1 &&
        listHead.cells.some(
          (c) => c.ariaSort === "descending" && c.label.startsWith("Size"),
        ),
      listHead
        ? `aria-sort values ${JSON.stringify(
            listHead.cells.filter((c) => c.sortable).map((c) => `${c.label}=${c.ariaSort}`),
          )}. The URL asked for sort=size and size defaults to descending.`
        : "not measured",
    );

    /* --- (ii) the inspector opens on ?key= ---------------------------------- */

    /* The key comes off the page, never a fixture: the bucket owns it and may delete it. */
    const firstKey = await admin.evaluate(() => {
      const tile = document.querySelector("[data-tile]");
      return tile ? tile.getAttribute("data-tile") : null;
    });
    ok(
      "the media library lists an object to inspect",
      !!firstKey,
      "nothing carries data-tile, so the inspector assertions below examine nothing. " +
        "An empty bucket would do this legitimately, and it would still be worth failing on: " +
        "these cases cannot say anything about a library with no rows in it.",
    );

    if (firstKey) {
      await admin.goto(
        `${ADMIN_ORIGIN}/admin/media?view=list&key=${encodeURIComponent(firstKey)}`,
        { waitUntil: "networkidle0" },
      );
      const inspector = await admin.evaluate((wanted) => {
        const panel = document.querySelector(".media-detail");
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          dialog: panel.getAttribute("role") || panel.closest("[role]")?.getAttribute("role") || "",
          namesKey: (panel.textContent || "").includes(wanted.slice(0, 12)),
          hasClose: !!panel.querySelector(".media-detail-close"),
        };
      }, firstKey);

      ok(
        "/admin/media?key=: the inspector opens on a key in the URL",
        !!inspector,
        "no .media-detail rendered for a key taken off the library page itself. The inspector " +
          "is URL-driven by design, so this is the whole of that contract.",
      );
      ok(
        "the inspector is actually laid out, not present and collapsed",
        !!inspector && inspector.width > 200 && inspector.height > 100,
        inspector
          ? `.media-detail measures ${inspector.width}x${inspector.height}. A panel that exists ` +
            `in the DOM at zero size is the mount class wearing a different hat.`
          : "not measured",
      );
      ok(
        "the inspector names the object it was opened for, and offers a way out",
        !!inspector && inspector.namesKey && inspector.hasClose,
        inspector
          ? `namesKey=${inspector.namesKey} close=${inspector.hasClose}. An inspector showing a ` +
            `DIFFERENT object than the URL asked for is worse than one that does not open.`
          : "not measured",
      );
    }

    /* --- (iii) the bulk bar counts and sizes the selection ------------------ */

    /*
     * Selection is client state, so this is a real click. The size is the half worth asserting:
     * a sum over the wrong subset still renders a plausible number.
     */
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?view=grid`, { waitUntil: "networkidle0" });
    const beforeSelect = await admin.evaluate(() => !!document.querySelector(".posts-bulk"));
    ok(
      "the bulk bar is absent before anything is selected",
      !beforeSelect,
      "a bulk bar rendered with an empty selection would offer actions that act on nothing, " +
        "and it would make the assertion below pass without a click happening at all",
    );

    const boxes = await admin.$$('input[type="checkbox"][name="key"]');
    ok(
      "the media grid renders row checkboxes to select",
      boxes.length > 0,
      "no checkbox carries name=key, so the bulk assertions below examine nothing",
    );

    if (boxes.length > 0) {
      await boxes[0].click();
      // The bar is rendered by React state, so it appears on the next paint
      // rather than synchronously with the click.
      await admin
        .waitForSelector(".posts-bulk", { timeout: 5000 })
        .catch(() => null);
      const bulk = await admin.evaluate(() => {
        const bar = document.querySelector(".posts-bulk");
        if (!bar) return null;
        const count = bar.querySelector(".posts-bulk-count");
        const size = bar.querySelector(".posts-bulk-size");
        return {
          count: (count?.textContent || "").trim(),
          size: (size?.textContent || "").trim(),
          live: count?.getAttribute("aria-live") || "",
          label: bar.getAttribute("aria-label") || "",
        };
      });

      ok(
        "selecting one row opens the bulk bar",
        !!bulk,
        "clicking a row checkbox did not produce .posts-bulk. Either the page is not hydrated " +
          "or the selection state is not reaching the bar.",
      );
      ok(
        "the bulk bar reports the count it was given",
        !!bulk && bulk.count.startsWith("1 selected"),
        bulk ? `count reads ${JSON.stringify(bulk.count)} after exactly one click` : "not measured",
      );
      /*
       * A SIZE, AND NOT A ZERO. `byteSize` over an empty subset renders "0 B",
       * which is exactly what a bar summing the wrong array would show, so the
       * assertion has to exclude it explicitly rather than merely require text.
       */
      ok(
        "the bulk bar sizes the selection rather than rendering an empty sum",
        !!bulk && bulk.size.length > 0 && !/^0\s*B$/i.test(bulk.size),
        bulk
          ? `size reads ${JSON.stringify(bulk.size)}. "0 B" is what summing an empty or wrong ` +
            `subset produces, and one selected object is not zero bytes.`
          : "not measured",
      );
      ok(
        "the bulk bar announces itself to a screen reader",
        !!bulk && bulk.live === "polite" && bulk.label.length > 0,
        bulk ? `aria-live=${JSON.stringify(bulk.live)} aria-label=${JSON.stringify(bulk.label)}` : "not measured",
      );
    }

    /* --- (iv) a destructive delete demands the count typed ------------------ */

    /*
     * The empty-trash ladder, the one confirmation a GET reaches; the others open from
     * `actionData` and need a POST. The required string is read off the page, not computed. It
     * never submits: the enabled state is the assertion. An empty trash is a reported skip.
     */
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?confirm=empty-trash`, {
      waitUntil: "networkidle0",
    });
    const modal = await admin.evaluate(() => {
      const panel = document.querySelector(".media-modal");
      if (!panel) return null;
      const prompt = panel.querySelector(".media-modal-typed .sr-only");
      const typed = /Type\s+(\S+)\s+to confirm/i.exec(prompt?.textContent || "");
      return {
        role: panel.getAttribute("role") || "",
        modal: panel.getAttribute("aria-modal") || "",
        required: typed ? typed[1] : "",
        hasInput: !!panel.querySelector(".media-modal-typed input"),
        confirmDisabled: !!panel.querySelector(".media-modal-actions .btn-danger[disabled]"),
      };
    });

    if (!modal) {
      skip(
        "/admin/media?confirm=empty-trash: the typed-confirmation ladder",
        "the confirmation did not render, which on this deployment means the trash is EMPTY: " +
          "the modal is gated on trashedCount > 0. Nothing is wrong and nothing was measured. " +
          "This case covers itself again as soon as one object is trashed.",
      );
    } else {
      ok(
        "the empty-trash confirmation is a real dialog",
        modal.role === "dialog" && modal.modal === "true",
        `role=${JSON.stringify(modal.role)} aria-modal=${JSON.stringify(modal.modal)}. This ` +
          `replaced window.prompt(), which was unreadable to a screen reader and which did not ` +
          `run at all with scripting off, submitting the destruction unconfirmed.`,
      );
      ok(
        "it asks for a specific string to be typed",
        modal.hasInput && modal.required.length > 0,
        `input=${modal.hasInput} required=${JSON.stringify(modal.required)}. The ladder is the ` +
          `count, and a modal that asks for nothing is a dialog rather than a confirmation.`,
      );
      ok(
        "the confirm button starts DISABLED on a hydrated page",
        modal.confirmDisabled,
        "the destructive button is pressable before anything has been typed. The server still " +
          "re-checks, so this is early feedback rather than the check, but an ungated button " +
          "means the ladder exists only on the server and the page contradicts it.",
      );

      if (modal.hasInput && modal.required) {
        const field = ".media-modal-typed input";
        // The WRONG value first. A button that enables on any input at all would
        // pass an assertion that only ever typed the right answer.
        await admin.type(field, `${modal.required}x`);
        const afterWrong = await admin.evaluate(
          () => !!document.querySelector(".media-modal-actions .btn-danger[disabled]"),
        );
        ok(
          "a WRONG value leaves the confirm button disabled",
          afterWrong,
          `typing ${JSON.stringify(`${modal.required}x`)} enabled the destructive button, so the ` +
            `gate is "something was typed" rather than "the count was typed".`,
        );

        await admin.evaluate((sel) => {
          const el = /** @type {HTMLInputElement | null} */ (document.querySelector(sel));
          if (el) {
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            )?.set;
            setter?.call(el, "");
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, field);
        await admin.type(field, modal.required);
        const afterRight = await admin.evaluate(
          () => !!document.querySelector(".media-modal-actions .btn-danger[disabled]"),
        );
        ok(
          "the exact value ENABLES the confirm button",
          !afterRight,
          `typing ${JSON.stringify(modal.required)}, which is the string the modal itself asks ` +
            `for, left the button disabled. The ladder would then be unpassable and the trash ` +
            `could not be emptied from the browser at all.`,
        );
        /*
         * NOT SUBMITTED. Navigating away is the end of this case, deliberately,
         * and the navigation is what discards the typed value.
         */
        await admin.goto(`${ADMIN_ORIGIN}/admin/media`, { waitUntil: "networkidle0" });
      }
    }

    /* ------------------------- the admin plane does not scroll sideways ---- */

    /*
     * The admin plane at the widths the public pages are gated at. Several widths, because the
     * overflow is linear in the viewport; 1280 catches a fix that collapses desktop. Do not narrow
     * this to pass on a partial fix.
     */
    /*
     * `/admin/*` loads a second sheet, `app/admin.css`, and a layout measurement on an unstyled page
     * measures browser defaults. A rule count proves bytes arrived; the computed style proves the
     * cascade applied them.
     */
    await admin.setViewport({ width: 1280, height: 900 });
    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const adminCss = await admin.evaluate(() => {
      const rules = [...document.styleSheets].reduce((n, s) => {
        try {
          return n + s.cssRules.length;
        } catch {
          return n;
        }
      }, 0);
      const sidebar = document.querySelector(".admin-sidebar");
      const style = sidebar ? getComputedStyle(sidebar) : null;
      return {
        rules,
        sheets: [...document.styleSheets].length,
        display: style?.display ?? "",
        width: style ? Math.round(parseFloat(style.width)) : 0,
      };
    });
    ok(
      "the ADMIN stylesheet is actually applied where the layout is measured",
      adminCss.rules >= 670,
      `${adminCss.rules} CSS rule(s) across ${adminCss.sheets} sheet(s), floor 670, ` +
        `measured 730 on 2026-08-28. Below this admin.css did not load and every ` +
        `overflow number below is about browser defaults.` +
        `
        RE-MEASURED because the public half shrank, not because the admin ` +
        `half did. The old figure was 965 on 2026-08-24, read as 351 public plus 614 ` +
        `admin. The per-route CSS split of 2026-08-27 took the public sheet down to the ` +
        `chrome, so an admin page now loads roughly 116 public rules beside the same ` +
        `admin bundle. A floor set against the old sum is a floor no correct build can ` +
        `clear, which is the unfailable-floor class inverted and is how this same ` +
        `assertion failed after the 2026-08-23 admin split.`,
    );
    ok(
      "the admin shell is laid out by admin.css, not by the browser default",
      adminCss.display === "flex" && adminCss.width > 100,
      `.admin-sidebar computed display=${adminCss.display || "(none)"} width=${adminCss.width}px. ` +
        `An unstyled sidebar is a block at full width, which would make the overflow ` +
        `readings below meaningless while looking like a real measurement.`,
    );

    /* 582 is the measured floor, on the fold boundary; 375 is the common phone width. */
    const OVERFLOW_WIDTHS = [1280, 582, 553, 480, 400, 375, 320];
    for (const width of OVERFLOW_WIDTHS) {
      await admin.setViewport({ width, height: 800 });
      for (const [path, what] of [
        ["/admin", "the cockpit"],
        ["/admin/posts", "the posts list"],
        /* The mentions queue puts chips, an excerpt and three buttons on one line. */
        ["/admin/mentions", "the mentions queue"],
      ]) {
        await admin.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
        const o = await admin.evaluate(() => {
          const doc = document.documentElement;
          const over = [];
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            // Off-screen by design: the skip link, and the closed drawer, which
            // is translated fully out of view at the narrow breakpoint.
            if (r.left < -1000) continue;
            if (r.right > doc.clientWidth + 0.5) {
              const cls = typeof el.className === "string" ? el.className : "";
              over.push(
                `${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""}@${Math.round(r.right)}`,
              );
            }
          }
          return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over: over.slice(0, 4) };
        });
        ok(
          `${path}: ${what} does not scroll sideways at ${width}px`,
          o.scrollW <= o.clientW,
          `scrollWidth ${o.scrollW} exceeds clientWidth ${o.clientW} by ` +
            `${o.scrollW - o.clientW}px. Widest: ${o.over.join(", ") || "(nothing measured wider " +
              "than the viewport, so the overflow is on an element this scan skipped)"}`,
        );
      }
    }

    /*
     * The bar itself fits: an ancestor with `overflow: hidden` would clip its children while the
     * document does not scroll.
     */
    await admin.setViewport({ width: 320, height: 800 });
    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const bar = await admin.evaluate(() => {
      const el = document.querySelector(".admin-topbar");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const kids = [...el.children].map((k) => {
        const kr = k.getBoundingClientRect();
        const cls = typeof k.className === "string" ? k.className : "";
        return {
          sel: `${k.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""}`,
          right: Math.round(kr.right),
          visible: kr.width > 0,
        };
      });
      const out = kids.filter((k) => k.visible && k.right > Math.round(r.right) + 0.5);
      return { right: Math.round(r.right), kids, out };
    });
    ok(
      "the admin topbar exists to measure at 320px",
      bar !== null,
      "no .admin-topbar, so the containment assertion below would examine nothing",
    );
    ok(
      "no admin topbar child overflows the bar at 320px",
      bar !== null && bar.out.length === 0,
      bar === null
        ? "not measured"
        : `bar ends at ${bar.right} and ${bar.out
            .map((k) => `${k.sel}@${k.right}`)
            .join(", ")} extend past it. The document may not scroll, but the ` +
          `controls are being clipped.`,
    );

    /*
     * The fold keeps every action: narrow may add controls but never lose one. Compared by
     * accessible name, since a swap holds a count steady. Opened via the `open` property, as a
     * scriptless `<summary>` click does, because rule 9 is about the markup.
     */
    const NARROW = 375;
    /** Focusable controls in the topbar, by accessible name, at this width. */
    const topbarActions = async (/** @type {number} */ width, /** @type {boolean} */ openDetails) => {
      await admin.setViewport({ width, height: 800 });
      await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
      return admin.evaluate((shouldOpen) => {
        const bar = document.querySelector(".admin-topbar");
        if (!bar) return { names: [], details: 0, summary: "" };
        const detailsEls = [...bar.querySelectorAll("details")];
        if (shouldOpen) for (const d of detailsEls) d.open = true;
        const names = [];
        for (const el of bar.querySelectorAll(
          'a[href], button, summary, input:not([type="hidden"]), select, textarea',
        )) {
          // display:none is out of the accessibility tree, so it is not
          // reachable and must not be counted at either width.
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const name = (
            el.getAttribute("aria-label") ||
            el.textContent ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim();
          if (name) names.push(name);
        }
        return {
          names: [...new Set(names)].sort(),
          details: detailsEls.length,
          summary: detailsEls[0]?.querySelector("summary")?.tagName ?? "",
        };
      }, openDetails);
    };

    const wide = await topbarActions(1280, false);
    const narrow = await topbarActions(NARROW, true);

    // Scope, proven before the comparison is read. An empty wide set makes the
    // subset test vacuously true, which is the shape that passes on a topbar
    // that has stopped rendering entirely.
    ok(
      "the wide admin topbar offers actions to compare against",
      wide.names.length >= 2,
      `only ${wide.names.length} named control(s) at 1280px: [${wide.names.join(" | ")}]. ` +
        `The subset assertion below would agree with anything.`,
    );
    ok(
      `the folded topbar is a native disclosure at ${NARROW}px`,
      narrow.details >= 1 && narrow.summary === "SUMMARY",
      `${narrow.details} <details> in the bar, first summary tag ` +
        `${JSON.stringify(narrow.summary)}. The fold has to open with no script, so a ` +
        `button plus a state hook is not the shape; hard rule 9 and the admin plane's ` +
        `own no-script door.`,
    );

    const lost = wide.names.filter((name) => !narrow.names.includes(name));
    ok(
      `every wide topbar action is still reachable at ${NARROW}px through the disclosure`,
      lost.length === 0,
      `${lost.length} action(s) disappear when the bar folds: [${lost.join(" | ")}].\n` +
        `        1280px offers [${wide.names.join(" | ")}]\n` +
        `        ${NARROW}px offers [${narrow.names.join(" | ")}]\n` +
        `        A fold that drops controls passes every width assertion above, ` +
        `because nothing overflows if nothing is there.`,
    );

    await admin.close();
  }

} catch (error) {
  /*
   * ONLY the sentinel is swallowed. The diagnosis for it is already printed and
   * the exit code is already set; anything else is a real fault and keeps its
   * stack, because a harness that eats unknown errors reports a clean failure
   * for a broken instrument.
   */
  if (!(error instanceof Error) || error.message !== "SUBJECT_UNREACHABLE") throw error;
} finally {
  await cleanupChildren(browser);
}

/*
 * Executed-count floor, one per mode, measured by running the gate, never summed. A browser gate
 * has many ways to examine nothing: a 404, a stale selector, an error page.
 */
/*
 * Only if something was measured: an unreachable subject would print `0 checks, 0 failures`,
 * which reads as a pass. The exit code is already 1.
 */
if (subjectReachable) {
  /*
   * Two floors, one per mode, because CI runs both: the preview and the deployed site. Each floor sits
   * `max(3, ceil(count * 0.05))` under a run; check:floors never sees this network-tier gate,
   * so re-measure when touching this file.
   */
  const MINIMUM_CHECKS = DRIVES_PREVIEW ? 248 : 230;
  console.log(
    `\n${checks} checks, ${failures} failures` +
      (skipped.length ? `, ${skipped.length} skipped` : "") +
      "\n",
  );
  /* Name what was not covered on the last line, the one that gets read. */
  if (!adminCasesRan) {
    console.log(
      "  NOT COVERED: the admin plane. No surface under /admin was rendered, the editor\n" +
        "  mount was not checked, neither mark fill was measured, and NOTHING ON THIS PLANE\n" +
        "  WAS MEASURED AT ANY NARROW WIDTH. The public pages are gated at 320 and the admin\n" +
        "  plane was not, which is how it came to scroll sideways below 576 unnoticed. The\n" +
        "  run above is RED for this reason since 2026-09-06: it used to be a skip under a\n" +
        "  halved floor, which let a quarter-run print green. A\n" +
        "  green result above is a statement about the public pages only.\n",
    );
  }

  /*
   * What still needs a human, printed every run. Widening the read-only credential to reach the
   * by-construction items would grant the authority the design withholds; they stay human.
   */
  console.log(
    "  REMAINING HUMAN, and why:\n" +
      "    BY CONSTRUCTION, and deliberately permanent:\n" +
      "      - the single-delete and index-rebuild confirmations. Both open from actionData,\n" +
      "        so reaching them needs the POST a read-only credential is refused. Their SERVER\n" +
      "        half is gated by check:destructive; only the browser half is uncovered.\n" +
      "      - every write outcome: upload, tag, trash, restore, rebuild. The gate proves the\n" +
      "        controls RENDER and never that a submission lands.\n" +
      "    BY THE HARNESS:\n" +
      "      - hover states, including the heading permalinks. Puppeteer rejects hover\n" +
      "        emulation, so this is owed as a real-device eyeball.\n" +
      "      - drag and drop onto the library, and the paste-to-upload path. Both need a real\n" +
      "        DataTransfer that the automation API does not synthesise faithfully.\n" +
      "      - the clipboard buttons. The headless permission prompt is not the real one.\n" +
      "    BY JUDGEMENT:\n" +
      "      - whether any of it LOOKS right. Every assertion here is a number or an\n" +
      "        attribute; a page that lays out correctly and is unreadable passes.\n",
  );
  /*
   * The breach is folded into `failures`, which the exit code is computed from; setting
   * `process.exitCode` alone is overwritten by the assignment below.
   */
  /* The floor name carries the mode, so each reading is judged against its own floor. */
  const floorBreach = assertFloor(
    "check:browser",
    DRIVES_PREVIEW ? "checks:preview" : "checks:deployed",
    checks,
    MINIMUM_CHECKS,
  );
  if (floorBreach) {
    console.error(`check:browser REFUSED: ${floorBreach}`);
    failures += 1;
  }
  process.exitCode = failures > 0 ? 1 : 0;

}