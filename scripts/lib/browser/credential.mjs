// The admin credential check:browser runs with: the smoke token, how it is read and applied, and
// the repair each refusal names.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { root } from "./harness.mjs";

/**
 * There is no test-only auth bypass: the defects these cases catch live in the real authenticated
 * render. The origin is the deployed admin, never the preview: SMOKE_TOKEN is a wrangler secret that
 * the preview does not have.
 */
export const ADMIN_ORIGIN = (process.env.ADMIN_ORIGIN ?? "").replace(/\/+$/, "");

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
    `request for the smoke path, so this is a failure rather than a skip.`;
}

const SMOKE_REQUESTED = Boolean(SMOKE_TOKEN || SMOKE_ERROR);

export const CREDENTIAL = "smoke";
export const CREDENTIAL_PRESENT = SMOKE_REQUESTED;
export const CREDENTIAL_ERROR = SMOKE_ERROR;
export const CREDENTIAL_SOURCE = SMOKE_SOURCE;

/**
 * A pinned header is safe here: a bearer token has no refresh to fight.
 *
 * @param {import("puppeteer").Page} page
 * @param {string} [_origin] kept so callers pass the origin they drive; a header needs none
 */
export async function applyCredential(page, _origin) {
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${SMOKE_TOKEN}` });
}

/**
 * `redirect: "manual"`: a followed 302 to the sign-in reports 200.
 *
 * @param {string} origin
 */
export async function credentialAuthenticates(origin) {
  try {
    const res = await fetch(`${origin}/admin`, {
      headers: { authorization: `Bearer ${SMOKE_TOKEN}` },
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
