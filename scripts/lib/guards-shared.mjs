/** What every ask-guards pass shares: the tally, the policy assertions and the actors and post files they use. */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTally } from "@dustinedwards/devkit/node";
import { PolicyError } from "../../app/lib/editor/publish-policy.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const tally = createTally({ print: false });
const { ok } = tally;
export const { eq } = tally;

/** @param {string} label @param {() => void} fn @param {string} policy */
export function refuses(label, fn, policy) {
  let problem = "expected a PolicyError, got none";
  try {
    fn();
  } catch (error) {
    if (!(error instanceof PolicyError)) problem = `expected PolicyError, got ${error}`;
    else if (error.policy !== policy) problem = `expected policy ${policy}, got ${error.policy}`;
    else problem = "";
  }
  ok(`${label}\n    ${problem}`, problem === "");
}

/** @param {string} label @param {() => void} fn */
export function permits(label, fn) {
  let problem = "";
  try {
    fn();
  } catch (error) {
    problem = `expected no error, got ${error}`;
  }
  ok(`${label}\n    ${problem}`, problem === "");
}

/** @param {{draft: boolean, firstPublished?: string | null}} o */
export function file(o) {
  const lines = [
    "---",
    'title: "T"',
    "slug: t",
    'description: "D"',
    "date: 2026-07-28",
    "tags: [a]",
    `draft: ${o.draft}`,
  ];
  if (o.firstPublished) lines.push(`first_published: ${o.firstPublished}`);
  lines.push("---", "", "Body.", "");
  return lines.join("\n");
}

export const OPERATOR = /** @type {const} */ ({ kind: "operator", id: "abcd1234" });
export const ADMIN = /** @type {const} */ ({ kind: "admin" });
export const SMOKE = /** @type {const} */ ({ kind: "smoke", id: "beef0001" });
