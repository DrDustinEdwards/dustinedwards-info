/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Gate: the site as a BROWSER LAYS IT OUT, not as markup.
 *
 *   npm run check:browser
 *   npm run check:browser -- --keep    leave the preview server running
 *
 * ## OBSERVATION BOUNDARY
 *
 * **ONE BROWSER, ONE ENGINE.** Chromium, via the Puppeteer already installed in
 * this repo. Nothing here says anything about Firefox, Safari or WebKit on iOS,
 * and the layout defects this repo has shipped were engine-agnostic, so that is
 * a real limit rather than a theoretical one.
 *
 * **TWO VIEWPORTS**, 1280x900 and 320x800. A defect that appears only at 768 or
 * only at 1440 is invisible here. 320 is the narrowest commonly cited phone
 * width and the one the recorded defects were about; 1280 is where the column
 * layout is supposed to be at its widest.
 *
 * **IT LOADS A LOCAL PREVIEW BUILD, not the deployed Worker.** So it proves what
 * the working tree renders, which is the point, and proves nothing about what is
 * live. `verify-live` owns that and needs the wire. **The admin cases are the
 * one exception and they invert this**, for a reason measured below.
 *
 * **UNLESS `PUBLIC_ORIGIN` IS SET, WHICH INVERTS THE SENTENCE ABOVE.** With it,
 * the public cases drive a deployed site, nothing is built and no server is
 * started, and the whole gate speaks about one live build. That is what the
 * daily CI schedule runs, and it is a DIFFERENT question: a green run there
 * proves nothing about uncommitted work, exactly as a green local run proves
 * nothing about what is live. The banner names which one ran, every run,
 * because these two are easy to confuse and expensive to confuse.
 *
 * **IT DOES NOT LOOK.** Every assertion is a number from `getBoundingClientRect`
 * or an attribute from the DOM. A page that lays out correctly and is unreadable,
 * mis-coloured, or has its z-order inverted passes here. Screenshots would need a
 * human or a baseline, and a baseline is a fixture that drifts.
 *
 * **THE ADMIN CASES ARE OPT-IN, AND THERE ARE NOW TWO WAYS TO OPT IN.**
 * Preferred: the read-only SMOKE credential, a bearer token in `.smoke-token`
 * or at `SMOKE_TOKEN_FILE`, which authenticates as its own machine principal
 * and is the one a CI run can hold. Fallback: a real admin session cookie in
 * `.admin-session`, pasted out of Chrome by a human. Either way, ABSENT they
 * skip loudly, and SUPPLIED AND UNUSABLE they FAIL, because a file on disk is a
 * request for them.
 *
 * **WHICH ONE RAN DECIDES WHAT A GREEN RESULT MEANS, and the run says so.** The
 * smoke actor is read-only by construction, so under it these cases prove what
 * a machine can RENDER and nothing about any write surface. Under the cookie
 * they run as Dustin, which proves more and proves it only when Dustin is
 * sitting there. The banner names the credential and the residue.
 *
 * **NOTHING HERE SUBMITS ANYTHING, under either credential.** The interaction
 * cases click client state and read numbers back; the destructive ladder is
 * asserted by whether its button is ENABLED, never by pressing it.
 *
 * **THE ADMIN CASES DO NOT OBSERVE THE PREVIEW BUILD.** They cannot, and that is
 * measured rather than assumed: sessions live in the PRODUCTION KV namespace,
 * the preview server runs against local miniflare storage, and a real session
 * cookie presented to the preview lands on /login every time. So when they run
 * at all they run against `ADMIN_ORIGIN`, a DEPLOYED Worker, which means they
 * prove what is live and prove nothing about the working tree. That is the
 * opposite of every other case in this file. It is the price of the "cannot be
 * faked" rule below, and the banner says so at runtime.
 *
 * ## Why this exists
 *
 * Audit 2.3. Twenty-seven gates and none of them had ever laid out a page:
 * `check:admin-ui` renders routes with `.server` imports stubbed AND NO
 * STYLESHEET, and says so in its own header. Five layout defects shipped
 * invisible to the whole suite, and a sixth class, a component that renders in
 * markup and fails to MOUNT, took the editor down for two days with every gate
 * green.
 *
 * ## Why Puppeteer rather than Playwright
 *
 * Playwright is the better tool in the abstract: three engines, better tracing,
 * better waiting primitives. It was rejected on cost that is specific to this
 * repo. **Puppeteer 25.4.0 is ALREADY a declared devDependency** and its Chrome
 * is already downloaded, because `build:diagrams` renders mermaid through
 * `@mermaid-js/mermaid-cli`, which drives Puppeteer. Adding Playwright means a
 * second browser stack, a second ~150MB download in `npm ci`, and two automation
 * APIs in one repo, to gain engines this gate's own boundary already says it is
 * not testing. Verified before choosing: `puppeteer.launch()` succeeded headless
 * on Chrome/151.0.7922.47 with no install step.
 *
 * ## Why a PREVIEW build and not the dev server
 *
 * MEASURED, and it nearly produced a spec that asserted nothing. Against
 * `npm run dev` the page came back with `document.styleSheets.length === 1`,
 * `0` total CSS rules, `getComputedStyle(.page-head).maxWidth === "none"` and an
 * 8px body margin: the app stylesheet was not applied at all, so `.blog-search`
 * and `.page-head` measured identical full-bleed widths and every column
 * assertion would have passed on an unstyled page. That is exactly the
 * `check:admin-ui` failure this gate exists to replace, reproduced by accident.
 * The preview build serves `assets/root-*.css` as a real stylesheet and the same
 * measurement immediately separated 1216px from 768px.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;

/**
 * WHERE THE PUBLIC CASES LOOK, and it changes what a green run MEANS.
 *
 * Unset, which is every local run: the gate builds the working tree, serves it
 * with `vite preview`, and the public cases observe THIS DISK. That is the
 * whole reason the preview exists, and it is the instrument that can see a
 * layout defect before it ships.
 *
 * Set, which is the CI schedule: the public cases observe the DEPLOYED site
 * instead, no build and no preview server. That is a different question with a
 * different answer, and the banner says which one ran, because a green run
 * against production proves nothing about uncommitted work and a green run
 * against the preview proves nothing about what is live.
 *
 * The ADMIN cases have always observed the deployment (the smoke credential is
 * a wrangler secret and no local server can answer for it), so under this
 * variable the whole gate speaks about one build for the first time.
 */
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "");
/** Whether this run builds and serves the working tree. */
const DRIVES_PREVIEW = !PUBLIC_ORIGIN;
const BASE = PUBLIC_ORIGIN || `http://localhost:${PORT}`;

/**
 * A real admin session, read from a FILE first and the environment second.
 *
 * **THE ADMIN CASES CANNOT BE FAKED AND ARE NOT.** Better Auth holds the session
 * in KV, the single admin signs in through Google, and this repo has NO
 * `.dev.vars` by design, so no local server can mint a session. A test-only
 * bypass would mean the spec authenticates through a path production does not
 * have, and the defect it exists to catch, the editor's Suspense boundary
 * failing under the enforced CSP, lives in the real authenticated render. A
 * stub would have passed while the editor was broken in production.
 *
 * ## WHY A FILE, AND NOT THE ENVIRONMENT VARIABLE ALONE
 *
 * `ADMIN_SESSION_COOKIE` has to be exported in the SAME SHELL the gate runs in,
 * and it was absent in three consecutive sessions. That is not bad luck, it is
 * the design: a variable that lives in one shell cannot survive the next one,
 * and nothing in the repo can carry it forward. The cost is recorded rather
 * than theoretical. The admin block's executed-count floor is DERIVED instead
 * of measured, and its sideways-scroll plant is still owed, both because the
 * cases have never once run.
 *
 * A gitignored file at the repo root survives shells, survives sessions, and is
 * checked by `git check-ignore` rather than by assumption. `.admin-session.example`
 * is tracked beside it and carries the five Chrome clicks that refill it.
 *
 * THE ENVIRONMENT STILL WINS where it is set, so nothing that works today stops
 * working. It is not free: the variable now has to carry the same `name=value`
 * form the file does, because the old leniency is the defect below.
 *
 * ## WHAT THE VALUE HAS TO BE, AND WHY GUESSING FAILED
 *
 * MEASURED 2026-08-21: `ADMIN_SESSION_COOKIE` held the cookie's VALUE with no
 * `name=` segment, was passed whole to a `Cookie:` header, and produced a header
 * with no name that no server can parse. The repair at the time was to ask
 * whether the string contained an `=` and to prepend the canonical name when it
 * did not.
 *
 * **THAT TEST CANNOT WORK AND IS REPLACED HERE.** A Better Auth token is
 * `<id>.<base64 hmac>`, and base64 pads with `=`. So a bare value carrying
 * padding contains an `=`, is read as already-named, and gets split at the
 * padding: the name becomes the token and the value becomes the empty string.
 * Silently, and the failure that follows blames the session.
 *
 * There is no string test that separates those two cases, so the gate stops
 * guessing and states the requirement instead: the pair, with its name. The one
 * unambiguous case is kept, because it cannot be misread: a value with NO `=`
 * anywhere is a bare token and is given the canonical name here.
 */
const SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";
const SESSION_FILE = join(root, ".admin-session");
const SESSION_EXAMPLE = ".admin-session.example";

/**
 * Reads the session file, or null when there is none.
 *
 * `key = value`, `#` comments, blank lines ignored. A non-comment line whose key
 * is not one this understands is taken as the cookie itself, so a bare
 * `name=value` pasted straight out of DevTools works without the `cookie = `
 * prefix. Forgiving about the shape of the line, exact about the cookie, which
 * is the half that cannot be guessed at.
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
 * Turns whatever was supplied into the one `name=value` pair to send, or names
 * what was wrong with it.
 *
 * Accepts a whole `Cookie:` header, so pasting from the Network tab works: the
 * session cookie is picked out by name and everything else is dropped, because
 * `applySession` sets ONE cookie and the wire check sends one pair.
 *
 * **RETURNS NAMES, NEVER VALUES.** The diagnostic says which cookie names were
 * found and how long the string was. A gate that echoes a live session token
 * into a terminal, a CI log or a report has published it.
 *
 * @param {string} raw
 * @returns {{ pair: string, error: string }}
 */
function sessionPair(raw) {
  const value = raw.trim();
  if (!value) return { pair: "", error: "" };

  /*
   * THE PLACEHOLDER IS CHECKED FIRST, and the plant is why.
   *
   * `__Secure-better-auth.session_token=PASTE_THE_VALUE_HERE` is a WELL FORMED
   * pair carrying the right name, so every structural test below passes it and
   * the request goes out and is refused. That reached the "almost certainly
   * EXPIRED" branch and told an operator who had never pasted anything that
   * their session had run out. The repair it named happened to be right; the
   * diagnosis was invented.
   *
   * A file copied and not filled in is its own state and gets its own sentence.
   */
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

  /*
   * REDACTED BY DEFAULT, because the thing being described might be the secret.
   *
   * The malformed case that matters most is a bare token pasted with no name.
   * Parsed as pairs, its "name" IS the session token, so a diagnostic that
   * helpfully lists the names it found would print a live credential into the
   * terminal, and into any CI log the gate ever runs in. Measured on the first
   * plant, which is how this exists.
   *
   * So a segment is echoed only when it LOOKS like a cookie name: short, and
   * built from the characters names actually use. A Better Auth token is
   * neither, so it redacts to its length. This heuristic decides only what to
   * PRINT, never what to accept, and it errs toward printing nothing.
   */
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

/**
 * Where to go and refill, named after WHICH source was actually read.
 *
 * The environment wins when it is set, so a stale variable in the shell makes
 * the file irrelevant, and "refill .admin-session" would send the reader to edit
 * a file the gate is not reading. Naming the wrong repair is the exact failure
 * this block was rewritten to remove.
 */
const REFILL_HINT = process.env.ADMIN_SESSION_COOKIE
  ? `ADMIN_SESSION_COOKIE is set in this shell and OVERRIDES the file. Update it, or unset ` +
    `it to fall back to .admin-session. ${SESSION_EXAMPLE} has the five Chrome clicks.`
  : `refill .admin-session. ${SESSION_EXAMPLE} has the five Chrome clicks.`;

/**
 * The origin the admin cases drive, which is NOT the preview server.
 *
 * MEASURED, and it is why this exists at all: a valid production session
 * presented to `vite preview` renders the login page, because the preview's
 * APP_KV is local miniflare storage and the session is a key in the production
 * namespace. Nothing about the cookie is wrong in that case, so the gate must
 * not report it as a rejected session.
 *
 * Comes from the same file as the cookie, so setting the session up is one file
 * and not a file plus a variable. The environment overrides it, on the same
 * footing as the cookie above.
 */
const ADMIN_ORIGIN = (process.env.ADMIN_ORIGIN ?? fileSession?.origin ?? "").replace(/\/+$/, "");

/**
 * THE SMOKE CREDENTIAL, and it is the preferred way in since 2026-08-24.
 *
 * A read-only bearer token that authenticates as its own machine principal
 * rather than as Dustin. It is what moves these cases out of his hands: a
 * session cookie has to be pasted out of Chrome by a human, expires, and cannot
 * be minted by CI, so the admin block had NEVER RUN unattended and the header
 * above still records its floor as derived rather than measured because of it.
 *
 * Read from a FILE, on the `.admin-session` precedent and for the same reason:
 * a variable exported in one shell cannot survive the next one, and that cost
 * three consecutive sessions. `SMOKE_TOKEN_FILE` names the path; absent, the
 * gitignored `.smoke-token` at the repo root is used if it is there.
 *
 * **THE VALUE IS NEVER PRINTED, and no diagnostic below quotes it.** The
 * failures report the SOURCE and the LENGTH only, which is everything needed to
 * repair a bad token and nothing that helps anyone use a good one.
 *
 * ## THREE STATES, AND THE MIDDLE ONE IS A FAILURE
 *
 *   env set, file missing   FAILURE. Naming a path is a request for this path,
 *                           and falling back to the cookie silently would run a
 *                           different credential than the one CI asked for.
 *   nothing anywhere        absent. Fall back to the cookie, saying so.
 *   file present, unusable  FAILURE, exactly as a malformed cookie is.
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

/**
 * WHICH CREDENTIAL THE ADMIN CASES USE, decided once, here.
 *
 * Smoke wins when it is present, because it is the one that runs unattended.
 * The cookie remains a complete fallback rather than a deprecated path: a
 * machine credential proves what a machine can reach, and there are things only
 * a real signed-in session can (see the remaining-human list at the end).
 */
const CREDENTIAL = SMOKE_REQUESTED ? "smoke" : "cookie";
const CREDENTIAL_PRESENT = SMOKE_REQUESTED || Boolean(RAW_COOKIE);
const CREDENTIAL_ERROR = SMOKE_REQUESTED ? SMOKE_ERROR : COOKIE_ERROR;
const CREDENTIAL_SOURCE = SMOKE_REQUESTED ? SMOKE_SOURCE : COOKIE_SOURCE;

/**
 * Puts the session in the browser's COOKIE JAR rather than on a pinned header.
 *
 * MEASURED, 40 navigations: `setExtraHTTPHeaders({ cookie })` bounced to /login
 * on 6 of 16, while the jar bounced on 0 of 20 and 0 of 4 more in the full
 * render sweep. A pinned header is also sent in place of whatever the server
 * most recently Set-Cookie'd, so it fights Better Auth's own session refresh.
 * The jar is what a real browser does and it is what the gate does now.
 *
 * `url` rather than `domain` so the browser derives the host and the secure
 * attribute from the origin, which keeps this correct for http and https alike.
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
 * Puts the smoke credential on the page as a pinned `Authorization` header.
 *
 * **A PINNED HEADER IS WRONG FOR THE COOKIE AND RIGHT FOR THIS**, and the
 * difference is worth stating because the note above says the opposite. The
 * cookie was measured bouncing to /login on 6 of 16 navigations when pinned,
 * because a pinned `Cookie` is sent INSTEAD of whatever the server most
 * recently `Set-Cookie`d and therefore fights Better Auth's session refresh. A
 * bearer token has no refresh and no server-side counterpart: it is a constant,
 * so there is nothing for a pin to fight.
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
 * Does this origin accept the supplied session? Answered over the WIRE, before
 * a browser is driven at it.
 *
 * A redirect to the login page is the whole signal, and it is read with
 * `redirect: "manual"` on purpose: a browser follows the 302 and reports 200 for
 * the login page it lands on, so a status check after following would call a
 * rejected session a success.
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
    /*
     * THE STATUS IS THE ANSWER, and for the smoke path it is a RICHER answer
     * than for the cookie. The middleware refuses a PRESENTED bearer token with
     * a status that names the repair rather than redirecting: 401 wrong token,
     * 503 not configured on that deployment, 429 rate limited. Those need three
     * different fixes, so the status is carried out of here rather than
     * collapsed into a boolean the caller cannot interpret.
     */
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
      `401: the deployment did not recognise this token. The SMOKE_TOKEN wrangler secret and ` +
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

/**
 * Whether the admin block actually got past authentication and ran its cases.
 *
 * NOT derived from `skipped.length`, which cannot tell the difference between
 * "the admin cases ran" and "the session was rejected, so one assertion failed
 * and the other fifteen never happened". Those need different floors and the
 * second must not be reported as a collapsed run on top of its real failure.
 */
let adminCasesRan = false;

/**
 * The wire pre-check's full result, kept so the failure branch can name a
 * repair from the STATUS rather than from a boolean that discarded it.
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

/** @param {string} label @param {string} why */
function skip(label, why) {
  skipped.push(label);
  console.log(`  SKIP  ${label}\n        ${why}`);
}

/* ------------------------------------------------------------- the server */

console.log("\ncheck:browser\n");

/*
 * IT BUILDS, rather than trusting whatever is in build/.
 *
 * A stale build is the disk-versus-HEAD class wearing a different hat: the gate
 * would lay out code nobody is looking at and report on it confidently. 24s
 * measured, which is the price of the assertions below meaning anything.
 */
if (DRIVES_PREVIEW) {
  console.log("  building ...");
  // The enhancement bundles first: the app build's ?url imports name files
  // under the gitignored app/enhance/dist/, and this gate runs standalone as
  // well as inside check:all, so it cannot assume a runner already built them.
  const bundled = spawnSync("npm", ["run", "build:enhance"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (bundled.status !== 0) {
    console.error("check:browser failed. build:enhance did not succeed, so the build below cannot.");
    console.error((bundled.stderr || bundled.stdout || "").slice(-1200));
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
    process.exit(1);
  }
} else {
  // Nothing is built and nothing is served: the subject is already running
  // somewhere else. Said out loud, because "building ..." missing from the log
  // is exactly the kind of silence a reader fills in wrongly.
  console.log(`  NOT building: the public cases observe ${PUBLIC_ORIGIN}, a deployed site.`);
}

/*
 * THE SERVER'S OUTPUT IS KEPT, and until 2026-08-24 it was thrown away.
 *
 * `stdio: "ignore"` meant that when the startup poll timed out, the gate could
 * say only that nothing answered on the port. The server had usually said
 * exactly what was wrong on its own stderr (a port already bound, a config it
 * could not read, a crash on boot) and the gate discarded it and then reported
 * a symptom with no cause. That cost a session, which is why this is here.
 *
 * A RING BUFFER, not a transcript. `vite preview` is quiet, but a crash loop is
 * not, and a gate that prints an unbounded server log buries its own result.
 * The last 40 non-empty lines are what a startup failure needs.
 */
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

const server = DRIVES_PREVIEW
  ? spawn("npx", ["vite", "preview", "--port", String(PORT)], {
      cwd: root,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    })
  : null;
server?.stdout?.on("data", recordServerOutput);
server?.stderr?.on("data", recordServerOutput);
server?.on("error", (error) => recordServerOutput(`spawn failed: ${error.message}`));

/*
 * WHETHER THE SERVER PROCESS IS STILL ALIVE, which is the half the poll could
 * not see.
 *
 * A process that exited immediately and a process still booting look identical
 * to a fetch that refuses to connect. The old loop treated both as "not up
 * yet" and waited out the entire bound before saying anything, so the single
 * commonest startup failure, the server dying on boot, took a full minute to
 * report and reported the wrong thing.
 */
let serverExit = /** @type {{ code: number | null, signal: string | null } | null} */ (null);
server?.on("exit", (code, signal) => {
  serverExit = { code, signal };
});

/**
 * Polls until the server answers, rather than sleeping a guessed interval.
 *
 * ## THE BOUND, AND A CORRECTION TO WHAT THIS COMMENT FIRST CLAIMED
 *
 * The 2026-08-24 watch item asked whether the 60s bound was the real problem,
 * given the gate's own `npm run build` completes first. This comment answered
 * "`vite preview` answers in about a second" and cut the bound to 30s.
 *
 * **THAT NUMBER WAS A PREDICTION WRITTEN AS A MEASUREMENT, and the very first
 * run refuted it: 17,277ms.** Not one second, seventeen. So the 30s bound this
 * file briefly carried had 1.7x of headroom, which is TIGHTER than the 60s it
 * replaced and would have started failing on a loaded machine. Restored to 60s,
 * which against the worst reading is about 3.5x and is the honest bound.
 *
 * THREE SAMPLES, 2026-08-24, same machine, each after the gate's own build:
 * **17,277ms, 13,782ms, 12,040ms.** A dated observation, not a maintained
 * value: `npx` resolving through a shell on Windows is most of it, and the
 * spread across three consecutive runs is already 5 seconds, which is the
 * argument against a tight bound on its own. The gate PRINTS the figure every
 * run, so the next reader has a current number rather than this sentence.
 *
 * **AND THE BOUND WAS NEVER THE PROBLEM ANYWAY.** The recorded overrun was a
 * startup that never happened, and against that a tighter bound only shortens
 * the wait before an undiagnosed message. What actually fixes it is below: the
 * wait now ENDS EARLY when the process dies, and whatever the server said is
 * printed either way.
 */
/** What a deployed origin said, when it said something. Read by the diagnosis. */
let originStatus = /** @type {number | null} */ (null);
/** What a deployed origin threw, when it could not be reached at all. */
let originError = "";

async function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();

  /*
   * A DEPLOYED ORIGIN IS NOT BOOTING, so it gets ONE attempt and no loop.
   *
   * The retry above exists for a process that has been started and needs a
   * moment; none of that is true of a site that is already serving. A 404 from
   * a live origin is a WRONG PATH, and asking it again 85 times over a minute
   * cannot turn it into a right one: it would spend 60 seconds converting an
   * answer the origin gave immediately into a timeout, and a timeout is the
   * one diagnosis that names nothing. So the status is captured and reported.
   */
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
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/blog`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        console.log(`  preview server answered in ${Date.now() - started}ms`);
        return true;
      }
    } catch {
      /* not up yet */
    }
    // The process is gone, so no amount of further waiting will help. Reported
    // in the caller with the output, which is the point of not waiting here.
    if (serverExit) return false;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

/**
 * What to print when the server never answered. THE SERVER'S OWN LAST WORDS.
 *
 * Named rather than inlined so the failure carries its diagnosis in one place,
 * and so a run that captured NOTHING says that explicitly instead of printing
 * an empty region that reads like a clean log.
 */
function serverDiagnosis() {
  // No server was started, so there is nothing to diagnose ABOUT one: the
  // subject is a deployed origin that did not answer, and saying "the preview
  // server exited" would name a process this run never had.
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
  return `${how}\n  ${tail}`;
}

function stopServer() {
  if (!server) return;
  if (process.argv.includes("--keep")) return;
  try {
    if (process.platform === "win32") {
      if (server.pid) spawnSync("taskkill", ["/F", "/T", "/PID", String(server.pid)], { stdio: "ignore" });
    } else {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    /* already gone */
  }
}

/** False when the subject never answered, so nothing below was measured. */
let subjectReachable = true;
let browser;
try {
  if (!(await waitForServer())) {
    console.error(`check:browser failed. ${serverDiagnosis()}`);
    stopServer();
    /*
     * `process.exitCode`, NOT `process.exit()`, and this is the recorded
     * Windows class at a new site.
     *
     * MEASURED here on the origin plant: `process.exit(1)` on this path left
     * the undici handle from the probe above in flight, libuv aborted with
     * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\winsync.c`,
     * and the process died 127 with a C-level assertion printed UNDER the
     * gate's own diagnosis. The refusal was correct and the last thing on
     * screen was a crash, which is the one way to make a clear diagnosis
     * unreadable. Setting the code and letting the loop drain exits 1 cleanly.
     */
    process.exitCode = 1;
    subjectReachable = false;
    throw new Error("SUBJECT_UNREACHABLE");
  }

  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  /*
   * WHICH BUILD THE PUBLIC CASES ARE ABOUT, stated on the same footing as the
   * admin credential below. Two runs of this gate can now disagree while both
   * are correct, because they are answering about different artifacts, and a
   * reader who does not know which one ran cannot tell a shipped defect from an
   * unshipped one.
   */
  console.log(
    DRIVES_PREVIEW
      ? `  public cases: observing the PREVIEW BUILD of the working tree (${BASE})`
      : `  public cases: observing ${BASE} (DEPLOYED). This run says nothing about uncommitted work.`,
  );

  /* ------------------------------------------------- the stylesheet itself */

  /*
   * SCOPE, ASSERTED FIRST, and it is the assertion that makes the rest mean
   * anything. Against the dev server this gate measured an unstyled page and
   * every column assertion below passed on it. If the stylesheet is not applied
   * the numbers are about the browser's defaults, not about this site.
   */
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
   * RE-MEASURED 2026-08-24, AND THE FLOOR WAS THE THING THAT WAS WRONG.
   *
   * This read `> 500` and went RED when `app/admin.css` was split out of
   * `app/app.css`. Nothing about the page had broken: the public bundle simply
   * stopped carrying the admin plane's seven stylesheets, which is what the
   * split was FOR. Measured on the preview build: 351 rules from `root-*.css`,
   * and the page is genuinely styled (body background resolves to the token
   * colour, not to white).
   *
   * So this was a floor set against a stylesheet that no longer exists, and it
   * had been failing ever since. It is the unfailable-floor class inverted: a
   * threshold ABOVE its subject cannot pass rather than cannot fail, and it is
   * just as useless, because a red that is always red stops being read.
   *
   * Floored at 320, about eight percent under the measurement.
   *
   * **AND THIS ASSERTION IS ABOUT THE PUBLIC PLANE ONLY.** It runs on `/blog`.
   * It never said anything about the admin pages, which load a second sheet;
   * they now have their own scope check where they are measured.
   */
  ok(
    "the app stylesheet is actually applied",
    css >= 320,
    `${css} CSS rule(s) reachable on the public plane, floor 320, measured 351 on ` +
      `2026-08-24. Below this the page is effectively unstyled and every layout ` +
      `assertion below is measuring browser defaults.`,
  );

  /* ------------------------------------- 1. the search field and the column */

  /*
   * THE DEFECT: `.blog-search` carries no max-width while `.page-head`,
   * `.tag-chips` and `.post-list` are each `max-width: 48rem; margin: 0 auto`.
   * MEASURED at 1280: search 1216px against a 768px column, left 32 against 256.
   *
   * Asserted as ALIGNMENT against a sibling rather than against the literal
   * 48rem. A hardcoded 768 would be a second statement of a value app.css owns,
   * and it would go red the day the column is deliberately widened, which is a
   * design decision and not a defect.
   */
  const cols = await page.evaluate(() => {
    const box = (/** @type {string} */ sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    };
    return { search: box(".blog-search"), head: box(".page-head"), list: box(".post-list") };
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
        `form is full-bleed while everything around it is centred in a 48rem column.`,
    );
  }

  /* ------------------------------------------------ 2. the skip link target */

  /*
   * Both halves. A skip link whose target does not exist is a keyboard trap
   * dressed as an affordance, and the audit records it as a dead hash on the
   * login page and the error boundary. The public pages are checked here; login
   * is checked below because it is a different layout entirely.
   */
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

  /* ------------------------------- 3. aria-current is not on Blog on a post */

  /*
   * THE DEFECT: `<NavLink to="/blog">` has no `end`, so React Router marks it
   * active for every `/blog/*` descendant and stamps `aria-current="page"` on a
   * link that is not the current page. The admin nav already uses `end: true`,
   * so the repo disagrees with itself.
   */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const firstPost = await page.evaluate(() => {
    const a = document.querySelector('.post-list a[href^="/blog/"]');
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

  /* --------------------------------------- 4. no horizontal scroll at 320px */

  /*
   * THE WIDEST-REACHING OF THE FIVE. Measured on every public page rather than
   * one, because the culprit turned out to be shared chrome: `.site-header-nav`
   * is `display: flex` with no `flex-wrap` and no narrow media query, so four
   * links plus the search control plus the theme toggle measure 414px inside a
   * 320px viewport and every public page scrolls sideways.
   *
   * The offending element is NAMED in the failure, not just the page, because
   * "something overflows" sends the next reader hunting through 8,700 lines of
   * CSS.
   */
  await page.setViewport({ width: 320, height: 800 });
  for (const path of ["/", "/blog", "/search?q=workers", "/colophon", "/projects"]) {
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

  /* ------------------------------------------------- 5. the login skip link */

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

  /* --------------------- 5b. THE ENHANCEMENTS RUN, and nothing else ships */

  /*
   * The public plane stopped hydrating React (2026-08-26), so "works without
   * script" stopped being the risky half of rule 9's standing ruling: the
   * server-rendered page is now also what a scripted reader gets, plus four
   * nonced enhancement bundles. What can silently die is the OTHER half,
   * "fast with it": a bundle the CSP refuses, a selector that moved, or a
   * ?url import gone stale produces a page that renders perfectly and
   * enhances nothing, with every source-reading gate green. These cases run
   * the bundles in a real browser, which is the only instrument that can see
   * that class.
   *
   * WHAT IS DELIBERATELY NOT DRIVEN: the Ask stream. Clicking the trigger
   * bills a Workers AI generation per run, which is why the billed probe
   * lives in verify-live and not in a gate (same ruling as its Ask probes).
   * Asserted here instead: the affordance is visible and bound, which is the
   * half that dies silently.
   *
   * CONSOLE ERRORS ARE COLLECTED ACROSS THESE CASES and asserted empty at the
   * end. A CSP refusal of an un-nonced or mis-pathed bundle surfaces exactly
   * there and nowhere else this gate looks; this assertion is what makes
   * "remove the nonce" a plant this gate can catch by name.
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

  /*
   * The expected script set, derived from the SOURCE listing rather than the
   * build: an enhancement asset's stem is its module's basename (the ?url
   * asset is dist/<name>.js emitted as <name>-<hash>.js), and app/enhance/ is
   * present in any checkout while build/client may belong to another build.
   * Stems, not names, for the reason chunkStem gives in check-script-payload.
   */
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

  /*
   * A post that actually carries code blocks, found by walking the listing
   * rather than naming a slug: a slug pinned here goes stale the day the post
   * is retitled, and the corpus is the loader's business. Capped so a corpus
   * with no code posts skips loudly instead of crawling everything.
   */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const postPaths = await page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('.post-list a[href^="/blog/"]')]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && !h.endsWith(".md")),
    )].slice(0, 6),
  );
  let codePost = null;
  let probedPost = null;
  for (const path of postPaths) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    probedPost = probedPost ?? path;
    const hasCode = await page.evaluate(
      () => document.querySelectorAll(".prose pre[data-lang]").length > 0,
    );
    if (hasCode) {
      codePost = path;
      break;
    }
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
    /*
     * WHEN THE BUNDLE IS DEAD THE CLICK REALLY NAVIGATES, because the form
     * is the fallback and it works. That navigation destroys the execution
     * context, and an evaluate racing it throws rather than returning, which
     * on the first plant run crashed this gate instead of failing it. So the
     * evaluate is caught, and a destroyed context IS the finding: the submit
     * was not intercepted.
     */
    await page.evaluate(() => {
      /** @type {any} */ (window).__probe = "same-document";
    });
    await page.click('.theme-toggle button[value="dark"]');
    await new Promise((r) => setTimeout(r, 250));
    /** @type {{ attr: string | null, sameDocument: boolean, pressed: string | null | undefined } | null} */
    let flipped = null;
    try {
      flipped = await page.evaluate(() => ({
        attr: document.documentElement.getAttribute("data-theme"),
        sameDocument: /** @type {any} */ (window).__probe === "same-document",
        pressed: document
          .querySelector('.theme-toggle button[value="dark"]')
          ?.getAttribute("aria-pressed"),
      }));
    } catch {
      flipped = null;
    }
    ok(
      "the theme flips in place, without a navigation",
      flipped !== null &&
        flipped.attr === "dark" &&
        flipped.sameDocument &&
        flipped.pressed === "true",
      flipped === null
        ? "the click caused a real navigation: the theme bundle did not intercept the " +
            "submit (the form fallback is what carried the click)"
        : `data-theme=${JSON.stringify(flipped.attr)}, same document ${flipped.sameDocument}, ` +
            `aria-pressed=${JSON.stringify(flipped.pressed)}. The theme bundle did not run ` +
            `or the submit interception broke; the form itself still posts either way.`,
    );

    /*
     * THE PALETTE. "/" must open it, which also proves the hint's honesty
     * contract: the hint is server-rendered `hidden` and unhidden only once
     * the listener exists.
     */
    // The element must EXIST and be unhidden: a missing hint would make a
    // bare `!hidden` read true and pass on markup that lost the hint.
    const hintShown = await page.evaluate(() => {
      const hint = document.querySelector("[data-search-hint]");
      return hint instanceof HTMLElement && !hint.hidden;
    });
    ok(
      "the palette hint is unhidden once the palette is listening",
      hintShown,
      "the [data-search-hint] element is missing or still hidden, so the palette " +
        "bundle did not run or the header lost the hint",
    );
    await page.keyboard.press("/");
    await new Promise((r) => setTimeout(r, 250));
    const paletteOpen = await page.evaluate(() => ({
      open: Boolean(document.querySelector("dialog.palette[open]")),
      focused: document.activeElement?.classList.contains("palette-input") ?? false,
    }));
    ok(
      'pressing "/" opens the palette with focus in its input',
      paletteOpen.open && paletteOpen.focused,
      `open ${paletteOpen.open}, input focused ${paletteOpen.focused}`,
    );
    if (paletteOpen.open) {
      await page.type(".palette-input", "cloudflare");
      // Debounce is 140ms and the first D1 query on a cold preview has been
      // measured at 360ms; poll rather than sleep, bounded at 5s.
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
      await page.keyboard.press("Escape");
    }
  }

  /*
   * THE IMAGE LINK, both states, because this enhancement has two halves that
   * fail in opposite directions and no source-reading gate can see either.
   *
   * WITHOUT SCRIPT the image's parent must be an anchor, and its href must
   * actually SERVE an image. An href is a string; a 200 with an image
   * content-type is the only thing that distinguishes a working fallback from
   * a plausible one, and the defect this replays produced a URL that was
   * merely well formed.
   *
   * WITH SCRIPT the overlay must show THE ANCHOR'S HREF. That comparison is
   * the whole case: the bug it replays opened `currentSrc`, the rung of the
   * srcset ladder already downloaded, which renders an overlay that looks
   * completely correct while showing the resized copy. Nothing but comparing
   * the two URLs can tell those apart.
   *
   * COMPARED RAW, attribute against attribute, deliberately not as resolved
   * URLs. `currentSrc` is always ABSOLUTE, so the raw form discriminates on
   * any image; a resolved comparison only discriminates on an image that
   * carries a `srcset`, and whether the post that gets found has one is a
   * content accident. The correct implementation assigns the href verbatim,
   * so this asserts exactly that and nothing weaker.
   *
   * The scriptless half runs on its own page with JavaScript disabled rather
   * than on a DOM the bundle has already touched, so "the markup carries the
   * anchor" is a claim about what the SERVER sent.
   */
  {
    /*
     * THE SUBJECT COMES FROM THE ARTIFACT, not from crawling the listing.
     *
     * It was a crawl of the same capped `postPaths` the code case uses, and
     * that was wrong in the way this repo keeps paying for: with a planted
     * image in an OLDER post the case skipped, and its skip said "the corpus
     * carries no body image at all" on the strength of a SIX-POST SAMPLE. A
     * silent cap that reads as full coverage is the exact shape FAILURES.md
     * names, and here it was writing the false claim into its own reason.
     *
     * The artifact knows which posts carry the anchor, over the whole corpus
     * and with no crawl, so the skip below is now a measurement rather than an
     * inference. BOUNDARY: it is the artifact on THIS DISK. Driving a deployed
     * origin (PUBLIC_ORIGIN) can therefore name a post the deployment has not
     * got, which is why a named candidate that does not show the anchor in the
     * browser SKIPS naming the discrepancy instead of failing.
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
      /*
       * MEASURED 2026-08-26 against content/posts/: ZERO body images across the
       * 12 posts, by every form the pipeline recognises (`:::figure`, a
       * markdown image, a `/media/` citation, a raw `<img>`). The 2026-08-11
       * record of "6 images across 12 posts" is stale in the numerator: the
       * charts post's figure was removed. So this is a CONTENT fact and not a
       * defect, exactly like the no-code-post skip above, and it is loud
       * because a silent pass here would be indistinguishable from a working
       * anchor.
       */
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
      await page.keyboard.press("Escape");
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
   * THE SCRIPT SET, per page: only enhancement bundles, no framework, no
   * modulepreload. This is the wire half of check:script-payload's claim, on
   * the artifact this gate drives; verify-live section 16 makes the same
   * assertion against the deployed origin.
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

  /* ------------------------------- 6. THE ADMIN PLANE, opt-in, DEPLOYED ONLY */

  /*
   * The class no gate in this repo had ever seen: markup that renders and a
   * component that never MOUNTS. The editor's lazily imported CodeMirror sat
   * behind a Suspense boundary that the enforced CSP broke, and it was down for
   * two days with all twenty-seven gates green, because every one of them reads
   * source or stub-rendered markup.
   *
   * Widened 2026-08-21 from one editor case to the whole plane, because the
   * first session to render the admin with an instrument found two defects on
   * surfaces nobody had ever laid out, and roughly 5,500 lines of the split CSS
   * are admin with no assertion touching any of it.
   *
   * READ THE BANNER. These cases observe ADMIN_ORIGIN, a deployed Worker. Every
   * other case in this file observes the preview build of the working tree.
   */
  /*
   * THREE STATES, AND ONLY THE FIRST IS A SKIP.
   *
   * ABSENT means nobody asked for these cases, so the gate says loudly what it
   * did not cover and moves on. That is the one honest skip here.
   *
   * SUPPLIED BUT NOT USABLE is a FAILURE, every variety of it. A session file
   * on disk is a request for the admin cases, and the operator who wrote it is
   * entitled to be told they did not happen. Skipping instead would be the
   * silent-skip failure wearing the shape of a precondition, and it is what made
   * an expired session read like a broken test.
   *
   * The varieties are told apart because they need DIFFERENT REPAIRS, and a
   * message that cannot tell them apart sends the reader to the wrong one:
   *
   *   malformed  the file exists and its cookie cannot be used. Fix the FORMAT.
   *   no origin  a session was supplied and there is nowhere to send it.
   *   rejected   the format is right and the server said no. REFILL the file.
   *
   * "Rejected" is overwhelmingly an EXPIRED session, so the message leads with
   * that and names the file that explains the refill rather than describing the
   * clicks here, where they would rot next to a second copy of themselves.
   */
  if (!CREDENTIAL_PRESENT) {
    skip(
      "the admin plane (6 surfaces, the editor mount, the two mark fills, the four media " +
        "interactions, and the sideways-scroll cases at 1280, 553, 480, 400 and 320)",
      `no admin credential of either kind. These cases need a REAL one and are deliberately ` +
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
     * THE PATH SELECTION IS STATED, BOTH WAYS, and it is the line a reader needs
     * most: these cases now have two completely different principals available,
     * and which one ran decides what the result MEANS. The smoke credential is
     * read-only, so a green run under it says nothing about any write surface;
     * the cookie is Dustin, so a green run under it says nothing about whether
     * CI could have produced it.
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
     * The SHELL is the assertion, not the page title, because a title is set by
     * the route module and survives a body that rendered nothing. The sidebar
     * and the topbar are the two elements every admin route inherits from the
     * layout, so their absence means the layout itself failed.
     *
     * The login page is named explicitly in the failure. A bounced session
     * renders a complete, correct, fully styled page, and without this the
     * failure would read as "the sidebar is missing" on a page that never had
     * one.
     */
    const SURFACES = [
      ["/admin", "the cockpit"],
      ["/admin/posts", "the posts list"],
      ["/admin/media?view=grid", "the media library, grid"],
      ["/admin/media?view=list", "the media library, list"],
      ["/admin/tools", "tools"],
      ["/admin/origin-requests", "origin requests"],
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

    /* ------------------------- 6b. the two mark fills, across the split */

    /*
     * app.css split into sixteen files on 2026-08-21 and the only evidence the
     * admin half survived was that the BUILT stylesheet was byte-identical.
     * That is a real check and it cannot see this: the mark's base fill lives in
     * app.css and its header override in styles/public-chrome.css, so the two
     * are separated by a file boundary and by the @import order that decides
     * which one wins.
     *
     * Asserted as RESOLVED COLOUR from getComputedStyle, compared against the
     * TOKEN read off the same document, never against a literal hex. A hex here
     * would be a second statement of a value the palette owns, and it would go
     * red the day the brand is deliberately re-toned.
     *
     * Both halves, on the two planes where each is supposed to win: the admin
     * sidebar mark takes the (0,1,0) base rule, the public header mark takes the
     * (0,2,0) override. Asserting only one would pass with the override deleted.
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
      const el = document.querySelector(".site-header .site-logo-brand");
      const root = getComputedStyle(document.documentElement);
      return {
        present: !!el,
        fill: el ? getComputedStyle(el).fill : "",
        onChrome: root.getPropertyValue("--mark-on-chrome").trim(),
      };
    });
    ok(
      "the public header mark exists to measure",
      publicMark.present,
      "no .site-header .site-logo-brand, so the fill assertion below would examine nothing",
    );
    ok(
      "the public header mark's fill resolves to --mark-on-chrome, the override in public-chrome.css",
      publicMark.present && publicMark.fill === rgb(publicMark.onChrome),
      `fill is ${JSON.stringify(publicMark.fill)} and --mark-on-chrome is ` +
        `${JSON.stringify(publicMark.onChrome)} (${rgb(publicMark.onChrome || "#000")}). The ` +
        `(0,2,0) override in styles/public-chrome.css is not beating the (0,1,0) base in app.css, ` +
        `which is what the sixteen-file split put at risk.`,
    );

    /* ----------------------------------------- 6c. THE MOUNT CLASS */

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

    /* ------------- 6d. THE MEDIA INTERACTIONS, previously Dustin's clicks --- */

    /*
     * FOUR INTERACTIONS ON /admin/media, ASSERTED, and they used to be a list
     * of things for Dustin to click after every media change.
     *
     * ## WHAT THEY ARE, AND WHY EXACTLY THESE
     *
     * The media route split moved 1,699 lines of markup between files, and
     * `check:admin-ui` proved every number identical across the move. That gate
     * renders routes with `.server` imports stubbed AND NO STYLESHEET, so what
     * it cannot see is precisely what these cover: a header that renders but
     * sorts nothing, an inspector that never opens, a bulk bar that appears
     * with the wrong arithmetic in it, and a confirmation ladder that is
     * enforced on the server and silently ungated in the browser.
     *
     * ## THE READ-ONLY BOUNDARY IS VISIBLE HERE AND IT IS NOT A LIMITATION
     *
     * Every case below is a GET or a click on client state. NOTHING SUBMITS.
     * Under the smoke credential a submission would be refused by the
     * middleware anyway, but these are written not to submit under EITHER
     * credential, because the cookie path runs as Dustin and a gate that
     * trashes a file to prove the trash button works is not a gate anybody can
     * afford to run.
     *
     * That boundary is why two of the destructive confirmations are NOT here:
     * see the remaining-human list at the end of this file.
     */
    await admin.setViewport({ width: 1280, height: 900 });

    /* --- (i) the list view renders a header, and it marks the sorted column - */

    /*
     * SORTED BY SIZE, chosen because it is not the default: a header that
     * hardcoded its active column would pass on `sort=name` and fail here.
     * The active column is read back from the DOM and compared against the sort
     * this URL ASKED for, so the assertion cannot be satisfied by whichever
     * column happens to be marked.
     */
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
     * EVERY SORTABLE CELL IS AN ANCHOR, which is the property. NOT "every href
     * carries sort=", which is what this asserted first and which was WRONG.
     *
     * Measured: 4 anchors, 3 carrying `sort=`. The missing one is Added, and it
     * is missing correctly. `hrefWith` omits any parameter equal to its default
     * and `DEFAULTS.sort` is `added`, so the link to the default sort is a
     * shorter URL by design rather than a link that has lost its sort. The
     * first assertion could not tell those apart and reported a defect in code
     * that was behaving exactly as its own URL builder is written to.
     *
     * What actually has to hold is that sorting has an ADDRESS: an anchor with
     * an href, so it is shareable, restored by the back button and usable with
     * scripting off, which a click handler on a cell is none of.
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
    /*
     * AND EXACTLY ONE COLUMN ANNOUNCES ITSELF SORTED, to assistive technology.
     * `aria-sort="none"` on the others is not noise: it is what tells a screen
     * reader the column CAN be sorted and currently is not. Two columns claiming
     * to be sorted, or none, are both wrong and both render identically.
     */
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

    /*
     * THE KEY COMES OFF THE PAGE, never from a fixture. A hardcoded key would be
     * a second copy of a content hash that the bucket owns, and it would go red
     * the day that object is deleted rather than the day the inspector breaks.
     */
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
     * A CLICK, and the only case here that is not a navigation.
     *
     * Selection is the one piece of client state this page has, so the bulk bar
     * cannot be reached by a URL and `check:admin-ui` reaches it only through a
     * seeded fixture. This is the live version of that fixture: a real click, on
     * a real hydrated page, with the arithmetic read back out.
     *
     * The SIZE is the half worth asserting. A count is hard to get wrong; the
     * size sums a field over the selected subset, and a sum over the wrong
     * subset still renders a plausible number.
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
        !!bulk && /^1 selected/.test(bulk.count),
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
     * THE EMPTY-TRASH LADDER, which is the ONE destructive confirmation a
     * read-only credential can reach.
     *
     * It opens from a URL (`?confirm=empty-trash`), so it is server-rendered and
     * a GET reaches it. The other two confirmations in this route open from
     * `actionData`, which means reaching them requires the POST the smoke
     * credential is refused: they are unreachable BY CONSTRUCTION, not by any
     * limit of the harness, and they are on the remaining-human list with that
     * reason.
     *
     * ## THE REQUIRED STRING IS READ OFF THE PAGE
     *
     * The modal states what to type, and this reads it from there rather than
     * computing a trash count independently. A gate that derived the expected
     * count itself would be asserting its own arithmetic against the page's, and
     * when they disagreed it could not say which was wrong.
     *
     * ## IT NEVER SUBMITS
     *
     * The button's ENABLED state is the assertion. Pressing it would empty the
     * trash, and the ladder exists precisely because that is not undoable.
     *
     * ## CONDITIONAL, AND THE CONDITION IS REPORTED
     *
     * The modal renders only when the trash is non-empty (`trashedCount > 0`),
     * so on a deployment with an empty bin there is genuinely nothing to
     * measure. That is a SKIP with the reason, never a silent pass: an
     * assertion that quietly examines nothing reports what a working ladder
     * reports.
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
     * THE SAME WIDTH THE PUBLIC PAGES ARE GATED AT, and it had never been
     * applied to this plane. Case 4 above drives every public page at 320 and
     * has since the `.site-header-nav` defect; the admin shell was exempt for
     * no reason beyond needing a session, so it was never measured and it was
     * broken.
     *
     * MEASURED BEFORE THE REPAIR: 23px of overflow at 553, 96 at 480, 176 at
     * 400, 256 at 320. Those four are one number. 553 + 23, 480 + 96,
     * 400 + 176 and 320 + 256 are 576 every time, because `.admin-topbar-user`
     * had a min-content floor it could not shrink past (the operator's email is
     * one unbreakable token, 199px, in a 343px block once the drawer toggle
     * appears) and the document simply grew to meet it.
     *
     * **THE TOPBAR WAS ONE FLOOR AND NOT THE ONLY ONE. THIS ASSERTION IS STILL
     * RED WITH THE TOPBAR REPAIR APPLIED, and the number it reports is the
     * correction to a claim made when the repair landed.**
     *
     * That claim was "0 overflow at 320, 400, 480 and 553", and it was measured
     * by constraining `.admin-topbar` directly and reading its children back. It
     * was true about the topbar and false about the document, which is the
     * instrument seeing only what it was threaded through: the topbar was
     * constrained, so the topbar was what got measured.
     *
     * MEASURED PROPERLY on the deployed page with HEAD's stylesheet swapped into
     * the response and PROVEN in the cascade first: the document floor moves
     * 576 to 542, not below 320. 553 goes green. 480, 400 and 320 stay red at
     * 62, 142 and 222.
     *
     * The chain, at 320: two `.stat-card`s at 234 each hold `.card-grid` at 480,
     * which holds `.panel` at 480 and `.admin-content` at 528 once its padding
     * is added. `.admin-content` sizes the grid track, the track stretches
     * `.admin-topbar` to 528, and `.admin-signout` (correctly refusing to shrink)
     * ends up 14px past that at 542. So the remaining floor is the COCKPIT
     * CONTENT, not the bar, and the bar's own repair did what it claimed: its
     * min-content is no longer the binding constraint.
     *
     * ## RE-READ 2026-08-24 ON A PAGE PROVEN STYLED, AND THE PARAGRAPH ABOVE
     * ## IS A PREDICTION THAT DID NOT HOLD
     *
     * The two assertions above this loop now prove `admin.css` is applied where
     * these numbers are taken, which is what the re-read was for. All EIGHT
     * failures survive, so they were never the artefact of an unstyled page
     * that the public stylesheet assertion's unrelated red made them look like.
     *
     * What did NOT survive is the prediction. Measured against the deployed
     * build, the document floor is **582**, uniform across all four widths:
     *
     *   553 -> 29px over    480 -> 102px over
     *   400 -> 182px over   320 -> 262px over
     *
     * Three specifics differ from what was written above, and each matters to
     * whoever fixes this:
     *
     *   1. **553 did not go green.** It is 29px over, not 0.
     *   2. **The floor is 582, higher than both 576 and the predicted 542.**
     *   3. **The binding chain is the TOPBAR again**, not the cockpit content:
     *      `header.admin-topbar@582` over `div.admin-topbar-user@558`,
     *      `form@558`, `button.admin-signout@558`. No `.stat-card` or
     *      `.card-grid` appears in the widest set at any width; at 400 and 320
     *      the third widest is `span.muted@446`.
     *
     * The earlier reading was taken by swapping a stylesheet into a response
     * rather than by observing the built page, which is the simulated-element
     * class: a probe that is not the element measures the probe. The numbers
     * here come from the deployed build through the same harness that reports
     * them.
     *
     * NOTHING ABOUT THE LAYOUT IS CHANGED HERE. The fix is Dustin's design
     * call, and it now rests on readings whose scope is asserted.
     *
     * This assertion stays exactly as it is. Narrowing it to pass on the half
     * that is fixed would be tuning the assertion to the defect.
     *
     * FOUR WIDTHS, NOT ONE, and that is the point of the arithmetic above. A
     * single assertion at 320 would pass the moment the floor dropped to 320,
     * while 553 still scrolled. The failure was linear in the viewport, so the
     * gate has to sample the line rather than its worst point. 553 is included
     * precisely because it is the shallowest of the four and the first to go
     * green under a partial fix.
     *
     * 1280 is asserted too. Everything here shrinks and truncates, and a fix
     * built out of `min-width: 0` can easily buy the narrow case by collapsing
     * something that was fine at desktop width.
     *
     * The offending element is NAMED, exactly as case 4 names it.
     */
    /*
     * THE ADMIN PLANE'S OWN STYLESHEET CHECK, added 2026-08-24.
     *
     * The public check near the top of this file runs on `/blog` and says
     * nothing about these pages: since the CSS split, `/admin/*` loads a SECOND
     * sheet, `app/admin.css`, linked only by `routes/admin.tsx`. Every number
     * the overflow loop below reads is a layout measurement, and a layout
     * measurement on a page missing its stylesheet is a measurement of the
     * browser's defaults. The scope check belongs where the measurement is
     * taken, and it was not here.
     *
     * That gap had a cost. With the public assertion red for an unrelated
     * reason, the eight overflow failures were recorded as INCONCLUSIVE, and
     * the design decision resting on them was parked waiting for a styled
     * re-read. MEASURED 2026-08-24: the admin pages were styled the whole time,
     * 965 rules against the public plane's 351, with `.admin-sidebar`
     * resolving to `display: flex` at 240px. The readings were sound and the
     * instrument that would have said so did not exist.
     *
     * ASSERTED THREE WAYS, because a rule count alone is the weakest of them.
     * A count proves bytes arrived; the computed style proves the cascade
     * applied them to the element the overflow loop is about to measure.
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
      adminCss.rules >= 880,
      `${adminCss.rules} CSS rule(s) across ${adminCss.sheets} sheet(s), floor 880, ` +
        `measured 965 on 2026-08-24 (351 public + 614 admin). Below this admin.css did ` +
        `not load and every overflow number below is about browser defaults.`,
    );
    ok(
      "the admin shell is laid out by admin.css, not by the browser default",
      adminCss.display === "flex" && adminCss.width > 100,
      `.admin-sidebar computed display=${adminCss.display || "(none)"} width=${adminCss.width}px. ` +
        `An unstyled sidebar is a block at full width, which would make the overflow ` +
        `readings below meaningless while looking like a real measurement.`,
    );

    /*
     * 582 AND 375 ADDED 2026-08-26, and each earns its place.
     *
     * 582 is the MEASURED FLOOR itself, the widest width that scrolled before
     * the fold landed. Every other narrow width in this list is comfortably
     * inside the folded branch; none of them sits on the boundary, and a
     * breakpoint that drifted from 640 down past 582 would go unnoticed by all
     * four. 375 is the common phone width the four skip between 400 and 320.
     */
    const OVERFLOW_WIDTHS = [1280, 582, 553, 480, 400, 375, 320];
    for (const width of OVERFLOW_WIDTHS) {
      await admin.setViewport({ width, height: 800 });
      for (const [path, what] of [
        ["/admin", "the cockpit"],
        ["/admin/posts", "the posts list"],
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
     * AND THE BAR ITSELF FITS, which is a different claim from the document not
     * scrolling.
     *
     * `.admin-topbar` could stay inside the viewport while its own children
     * overflowed it, if something above it ever gained `overflow: hidden`. Then
     * the document would not scroll, this section's assertions would all pass,
     * and the email and Sign out would simply be clipped off the right edge
     * with nothing reporting it. Asserted at the narrowest width only, because
     * that is where it would happen.
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
     * THE FOLD KEEPS EVERY ACTION, which is the half none of the assertions
     * above can see.
     *
     * Everything before this measures WIDTH. A fold that simply deleted the
     * email and Sign out below the breakpoint would satisfy every one of them:
     * nothing overflows if nothing is there. That is not a hypothetical repair,
     * it is the cheapest one, and it is why the ruling asked for the items to
     * be the same controls rather than a reduced set.
     *
     * SUBSET, NOT EQUAL COUNT, and the reason is that the two widths are not
     * supposed to offer the same things. Narrow legitimately has MORE: the
     * drawer toggle appears, and the Account disclosure exists only when the
     * bar has folded. What must never happen is narrow having FEWER. So the
     * claim is that every action the wide bar offers is still reachable once
     * the disclosure is open, and the failure names the ones that went missing.
     *
     * BY ACCESSIBLE NAME rather than by count, because a count can be held
     * steady by a swap: lose Sign out, gain something else, and the arithmetic
     * agrees while the fold has eaten the one control that matters.
     *
     * The name is APPROXIMATED, `aria-label` then text content, and that is
     * stated because it is not the full accname algorithm: no `aria-labelledby`
     * chase, no `title` fallback, no alt on an image child. It was enough to
     * find a real one on its first run. The folded Sign out was named
     * "Sign outEnds this session. You will need to sign in again with Google.",
     * because the hint span is a CHILD of the button and name-from-content
     * takes descendants. Fixed at the component with an explicit label and a
     * description, so the two variants are now the same control by name as well
     * as by markup.
     *
     * OPENED THROUGH THE `open` PROPERTY, which is what a click on a
     * `<summary>` does with no script running at all. Driving it with a
     * synthetic click would test the enhancement's listeners instead of the
     * markup, and the markup is what rule 9 is about here.
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
  if (browser) await browser.close().catch(() => {});
  stopServer();
}

/*
 * EXECUTED-COUNT FLOOR, one per MODE.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, 2026-08-21: **15**
 * with the admin cases skipped and **31** with them running. Never summed.
 * Floored at 13 and 29, slack of two either way.
 *
 * **THE PREVIOUS RECORDED FIGURE, 16, WAS WRONG BY ONE**, and it had been in
 * this comment since the gate was written. Counted by hand from the eight
 * non-admin `ok()` sites: one stylesheet, one three-element presence, one
 * alignment, four skip links, one post-link presence, one aria-current, five
 * overflow paths, one login skip link. That is 15, and running it says 15. The
 * old floor of 14 still passed, so the stale number never failed anything,
 * which is exactly why it survived: a recorded count nothing re-measures is a
 * claim, not a property.
 *
 * ONE FLOOR WOULD NOT DO. A single value low enough for the skip mode would let
 * the admin block collapse from sixteen assertions to nothing in the run mode
 * and still clear the bar, which is the failure this floor exists to catch.
 *
 * A gate that drives a browser has more ways to examine nothing than most: a
 * page that 404s, a selector that stopped matching after a class rename, and a
 * server that came up but served an error page all produce assertions that
 * never run rather than assertions that fail.
 */
/*
 * **BOTH FLOORS ARE NOW MEASURED THROUGH THIS GATE'S OWN PIPELINE, by RUNNING
 * it. 15 with the admin cases skipped, 43 with them running.** Never summed.
 * Floored at 13 and 41, slack of two either way.
 *
 * The run-mode figure was DERIVED until 2026-08-22 and said so, because the
 * admin cases need a session and no session had ever been present. It was
 * 29 + 12 counted from the source, and the count that replaced it is 43, so the
 * derivation happened to be right and the floor does not move. **That is the
 * least interesting possible outcome and it is still worth the run**: a summed
 * floor that agrees with the measurement is indistinguishable, before the
 * measurement, from one that does not. The previous figure in this file was
 * wrong by one for years, and the comment above says why nothing noticed.
 *
 * The cross-check that makes 43 credible rather than merely observed: the
 * recorded pre-overflow measurement was 31, twelve assertions were added, and
 * the run reports 43.
 *
 * RE-MEASURED 2026-08-24 by running it: **45** with the admin cases, after the
 * two admin-stylesheet assertions landed beside the overflow loop. The same
 * cross-check holds, 43 plus two. The floor stays at 41, which is about nine
 * percent under and inside the margin this repo uses; it is not raised on every
 * pair of assertions, only when the gap stops meaning anything.
 *
 * ## RE-MEASURED AGAIN 2026-08-24 WITH THE FOUR MEDIA INTERACTIONS: **59**
 *
 * Run through this gate's own pipeline, never summed. Floored at 54, about
 * eight percent under. 45 to 59 is fourteen assertions and the gap at 41 had
 * stopped meaning anything, which is the condition the paragraph above names
 * for raising it.
 *
 * **59 IS THE FLOOR OF THE RANGE, NOT THE MIDDLE OF IT, and that is why the
 * floor is not higher.** The empty-trash ladder is gated on the deployment
 * actually having something in its trash, so it contributes 0 assertions on a
 * clean bin and 5 on a dirty one. The measured 59 is the 0 case. A floor set
 * against a run that happened to catch a full trash would go red on the next
 * clean one and report a collapsed block where nothing had collapsed.
 *
 * The cross-check that makes 59 credible rather than merely observed: 45 was
 * the last measurement, the media block adds three list-header assertions, four
 * inspector, six bulk-bar and one skip, and 45 + 14 is 59.
 *
 * ## RE-MEASURED 2026-08-26 WITH THE PUBLIC ENHANCEMENT CASES: **71**
 *
 * Run through this gate's own pipeline after the public plane stopped
 * hydrating. The unhydration block (5b) adds twelve assertions in both modes:
 * one listing scope, one code-copy, one progress bar, one theme flip, one
 * hint, one palette open, one palette results, one Ask affordance, three
 * script-set pages, one console-error sweep. 59 + 12 is 71 in run mode, and
 * the skip mode moves from 15 to 27 by the same twelve. Floors 65 and 25,
 * about eight percent under, raised because the old gaps stopped meaning
 * anything. The code-copy case can skip on a corpus with no code post, which
 * is why the slack is not smaller.
 */
/*
 * THE SUMMARY AND THE FLOOR RUN ONLY IF SOMETHING WAS MEASURED.
 *
 * When the subject never answered, the diagnosis above is the whole result:
 * zero assertions ran, so a summary would print `0 checks, 0 failures`, which
 * reads like a pass, and the floor would refuse with `a block was SKIPPED`,
 * which names the wrong cause. Nothing was skipped; there was nothing to talk
 * to. The exit code is already 1.
 */
if (subjectReachable) {
  const MINIMUM_CHECKS = adminCasesRan ? 65 : 25;
  console.log(
    `\n${checks} checks, ${failures} failures` +
      (skipped.length ? `, ${skipped.length} skipped` : "") +
      "\n",
  );
  /*
   * The summary says WHAT WAS NOT COVERED, not just that something was skipped.
   *
   * A reader who sees "15 checks, 0 failures" and a SKIP line four screens up has
   * been told the admin plane was not looked at, in a way nobody reads. This is
   * the last line before the exit code, which is the one line that gets read.
   */
  if (!adminCasesRan) {
    console.log(
      "  NOT COVERED: the admin plane. No surface under /admin was rendered, the editor\n" +
        "  mount was not checked, neither mark fill was measured, and NOTHING ON THIS PLANE\n" +
        "  WAS MEASURED AT ANY NARROW WIDTH. The public pages are gated at 320 and the admin\n" +
        "  plane was not, which is how it came to scroll sideways below 576 unnoticed. A\n" +
        "  green result above is a statement about the public pages only.\n",
    );
  }

  /*
   * WHAT STILL NEEDS A HUMAN, PRINTED EVERY RUN, INCLUDING GREEN ONES.
   *
   * The smoke credential moved a list of manual clicks into assertions. It did not
   * empty the list, and a gate that reports only what it covered lets the
   * remainder quietly become "everything is covered". Each line names the reason,
   * because the reasons are different in kind and only one of them is a limit of
   * this harness:
   *
   *   BY CONSTRUCTION  the credential is read-only, so any surface that can only
   *                    be reached THROUGH a write is unreachable to it. Widening
   *                    the credential to reach them would give the machine actor
   *                    the authority the whole design exists to withhold, so
   *                    these stay human on purpose and are not a backlog item.
   *   BY THE HARNESS   Puppeteer cannot express it. These ARE backlog items.
   *   BY JUDGEMENT     it needs an eye rather than a number.
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
  if (checks < MINIMUM_CHECKS) {
    console.error(
      `check:browser REFUSED: only ${checks} assertion(s) ran, expected at least ` +
        `${MINIMUM_CHECKS}. A block was skipped rather than failing.`,
    );
    process.exitCode = 1;
  }
  process.exitCode = failures > 0 ? 1 : 0;

}