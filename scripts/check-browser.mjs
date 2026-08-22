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
 * **IT DOES NOT LOOK.** Every assertion is a number from `getBoundingClientRect`
 * or an attribute from the DOM. A page that lays out correctly and is unreadable,
 * mis-coloured, or has its z-order inverted passes here. Screenshots would need a
 * human or a baseline, and a baseline is a fixture that drifts.
 *
 * **THE ADMIN CASES ARE OPT-IN.** They read a session from `.admin-session`, a
 * gitignored file whose tracked `.example` sibling carries the refill
 * instructions. ABSENT, they skip loudly. SUPPLIED AND UNUSABLE, they FAIL,
 * because a file on disk is a request for them. See SESSION_COOKIE_NAME below.
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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

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
async function sessionAuthenticates(origin) {
  try {
    const res = await fetch(`${origin}/admin`, {
      headers: { cookie: ADMIN_COOKIE },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
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
console.log("  building ...");
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

const server = spawn("npx", ["vite", "preview", "--port", String(PORT)], {
  cwd: root,
  shell: true,
  stdio: "ignore",
  detached: false,
});

/** Polls until the server answers, rather than sleeping a guessed interval. */
async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/blog`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function stopServer() {
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

let browser;
try {
  if (!(await waitForServer())) {
    console.error("check:browser failed. the preview server never answered on " + BASE);
    stopServer();
    process.exit(1);
  }

  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

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
  ok(
    "the app stylesheet is actually applied",
    css > 500,
    `${css} CSS rule(s) reachable. Under ~500 the page is effectively unstyled and ` +
      `every layout assertion below is measuring browser defaults.`,
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
  if (!RAW_COOKIE) {
    skip(
      "the admin plane (6 surfaces, the editor mount, the two mark fills, and the " +
        "sideways-scroll cases at 1280, 553, 480, 400 and 320)",
      `no admin session. These cases need a REAL one and are deliberately not stubbed: ` +
        `a fake auth path would not render what production renders, and the defects they ` +
        `exist to catch live in the authenticated render.\n` +
        `        TO RUN THEM: copy ${SESSION_EXAMPLE} to .admin-session and paste a live ` +
        `session cookie into it. That file carries the five Chrome clicks. It is gitignored.`,
    );
  } else if (COOKIE_ERROR) {
    ok(
      `the session supplied in ${COOKIE_SOURCE} is a usable cookie`,
      false,
      `${COOKIE_ERROR}\n` +
        `        This is a FORMAT problem, not an expired session. See ${SESSION_EXAMPLE}. ` +
        `The admin cases below did not run.`,
    );
  } else if (!ADMIN_ORIGIN) {
    ok(
      "the admin cases have an origin to drive",
      false,
      `a session was supplied in ${COOKIE_SOURCE} and no origin was. These cases CANNOT run ` +
        `against the preview server: sessions live in the production KV namespace and the ` +
        `preview reads local miniflare storage, so a valid session renders the login page ` +
        `there. Measured, not assumed.\n` +
        `        Add an \`origin =\` line to .admin-session, or set ADMIN_ORIGIN. The admin ` +
        `cases below did not run.`,
    );
  } else if (!(await sessionAuthenticates(ADMIN_ORIGIN))) {
    ok(
      `the session supplied in ${COOKIE_SOURCE} authenticates against ${ADMIN_ORIGIN}`,
      false,
      `GET /admin with it did not return 200, so the session is almost certainly EXPIRED. ` +
        `The format parsed fine and the cookie was named ${SESSION_COOKIE_NAME}, so this is ` +
        `not a broken test and not a code defect.\n` +
        `        TO FIX: ${REFILL_HINT}\n` +
        `        The other possibility is that ${ADMIN_ORIGIN} does not share the production ` +
        `KV namespace. The admin cases below did not run.`,
    );
  } else {
    console.log(
      `\n  admin session: read from ${COOKIE_SOURCE}` +
        `\n  admin cases: observing ${ADMIN_ORIGIN} (DEPLOYED, not the preview build)\n`,
    );
    ok(`the supplied session authenticates against ${ADMIN_ORIGIN}`, true);
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
    await applySession(admin, ADMIN_ORIGIN);
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
    const OVERFLOW_WIDTHS = [1280, 553, 480, 400, 320];
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

    await admin.close();
  }

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
 */
const MINIMUM_CHECKS = adminCasesRan ? 41 : 13;
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
if (checks < MINIMUM_CHECKS) {
  console.error(
    `check:browser REFUSED: only ${checks} assertion(s) ran, expected at least ` +
      `${MINIMUM_CHECKS}. A block was skipped rather than failing.`,
  );
  process.exit(1);
}
process.exit(failures > 0 ? 1 : 0);
