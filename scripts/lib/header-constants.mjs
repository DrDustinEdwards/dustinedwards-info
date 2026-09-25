import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./strip-comments.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The header object a module assigns to `const NAME`, read from comment-stripped source, or null when
 * it declares none. Identifiers are captured as values too, as `<identifier X>`, so a swapped-in
 * constant reports as a wrong value rather than as an absent header.
 *
 * @param {string} code comment-stripped source
 * @param {string} name
 * @returns {Record<string, string> | null}
 */
export function headerConstant(code, name) {
  const block = new RegExp(`const\\s+${name}\\s*(?::[^=]*)?=\\s*\\{([\\s\\S]*?)\\}\\s*;`).exec(code);
  if (!block) return null;
  /** @type {Record<string, string>} */
  const declared = {};
  for (const m of block[1].matchAll(
    /(?:"([A-Za-z-]+)"|([A-Za-z][A-Za-z-]*))\s*:\s*(?:"([^"]*)"|([A-Za-z_$][\w$]*))/g,
  )) {
    declared[m[1] ?? m[2]] = m[3] !== undefined ? m[3] : `<identifier ${m[4]}>`;
  }
  return declared;
}

/**
 * workers/app.ts's SECURITY_HEADERS, which check:headers holds to the ratified set and verify-live
 * holds the deployed responses to. Comments first, or docblock prose parses.
 */
export function declaredSecurityHeaders() {
  return headerConstant(
    stripComments(readFileSync(join(root, "workers", "app.ts"), "utf8")),
    "SECURITY_HEADERS",
  );
}
