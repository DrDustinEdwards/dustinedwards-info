// The admin credential check:browser runs with: the smoke token or a pasted session cookie, how
// each is read and applied, and the repair each refusal names.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { root } from "./harness.mjs";

/**
 * There is no test-only auth bypass: the defects these cases catch live in the real authenticated
 * render. Never infer the name from an `=`: base64 padding puts one in a bare token.
 */
export const SESSION_COOKIE_NAME = "__Secure-better-auth.session_token";
const SESSION_FILE = join(root, ".admin-session");
export const SESSION_EXAMPLE = ".admin-session.example";

/** @param {string} path */
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
 * Never prints a cookie value.
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
export const COOKIE_SOURCE = process.env.ADMIN_SESSION_COOKIE
  ? "the ADMIN_SESSION_COOKIE environment variable"
  : `.admin-session`;
const { pair: ADMIN_COOKIE, error: COOKIE_ERROR } = sessionPair(RAW_COOKIE);

export const REFILL_HINT = process.env.ADMIN_SESSION_COOKIE
  ? `ADMIN_SESSION_COOKIE is set in this shell and OVERRIDES the file. Update it, or unset ` +
    `it to fall back to .admin-session. ${SESSION_EXAMPLE} has the five Chrome clicks.`
  : `refill .admin-session. ${SESSION_EXAMPLE} has the five Chrome clicks.`;

/** The admin origin, not the preview: preview KV cannot hold a production session. */
export const ADMIN_ORIGIN = (process.env.ADMIN_ORIGIN ?? fileSession?.origin ?? "").replace(/\/+$/, "");

const SMOKE_TOKEN_ENV = process.env.SMOKE_TOKEN_FILE;
const SMOKE_TOKEN_PATH = SMOKE_TOKEN_ENV ?? join(root, ".smoke-token");
export const SMOKE_SOURCE = SMOKE_TOKEN_ENV ? `SMOKE_TOKEN_FILE (${SMOKE_TOKEN_ENV})` : ".smoke-token";
/** The Worker's own floor, restated here so a short token fails before a request. */
const SMOKE_MIN_LENGTH = 32;

export let SMOKE_TOKEN = "";
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

const SMOKE_REQUESTED = Boolean(SMOKE_TOKEN || SMOKE_ERROR);

/** Smoke wins because it runs unattended; the cookie remains a full fallback. */
export const CREDENTIAL = SMOKE_REQUESTED ? "smoke" : "cookie";
export const CREDENTIAL_PRESENT = SMOKE_REQUESTED || Boolean(RAW_COOKIE);
export const CREDENTIAL_ERROR = SMOKE_REQUESTED ? SMOKE_ERROR : COOKIE_ERROR;
export const CREDENTIAL_SOURCE = SMOKE_REQUESTED ? SMOKE_SOURCE : COOKIE_SOURCE;

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
 * @param {import("puppeteer").Page} page
 * @param {string} origin
 */
export async function applyCredential(page, origin) {
  if (CREDENTIAL === "smoke") await applySmoke(page);
  else await applySession(page, origin);
}

/**
 * `redirect: "manual"`: a followed 302 to /login reports 200.
 *
 * @param {string} origin
 */
export async function credentialAuthenticates(origin) {
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

/** @param {number} status */
export function smokeRepair(status) {
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
