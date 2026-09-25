// The URL allowlist lives at the render layer so one guard binds every writer: build, editor save,
// operator API and preview all call renderBody.
// Pure predicates: rehypeUrlProtocols in pipeline.mjs applies them to the rendered tree.

import { SLUG_PATTERN } from "./slug.mjs";

const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/**
 * Browsers drop tab and newline anywhere in a URL, so java<TAB>script: is live. Every C0 control and DEL
 * goes, stricter than the spec, which can only block more: a NUL left in makes the scheme look relative.
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeForProtocolTest(raw) {
  let out = "";
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) continue;
    // U+FFFD is what markdown makes of a NUL in a link destination; removing it exposes a hidden scheme.
    if (code === 0xfffd) continue;
    out += character;
  }
  return out.toLowerCase();
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function protocolOf(value) {
  const match = /^([a-z][a-z0-9+.-]*):/.exec(normalizeForProtocolTest(value));
  return match ? `${match[1]}:` : null;
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeOrSelf(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Schemeless means relative and is allowed: footnotes and heading autolinks are fragments. The decoded
 * form must pass too, so a percent-encoded scheme cannot be smuggled past.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedUrl(value) {
  for (const form of [value, decodeOrSelf(value)]) {
    const protocol = protocolOf(form);
    if (protocol !== null && !ALLOWED_PROTOCOLS.has(protocol)) return false;
  }
  return true;
}

const INTERNAL_LINK_PREFIX = "/blog/";

/**
 * Composed with isAllowedUrl, never instead of it. The protocol is checked explicitly because the URL
 * constructor parses mailto:, which is not further reading.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isFurtherReadingUrl(value) {
  if (value.startsWith(INTERNAL_LINK_PREFIX)) return internalLinkSlug(value) !== null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" || parsed.protocol === "http:";
}

/**
 * Exported so check:content resolves internal links without a second copy of the prefix rule.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function internalLinkSlug(value) {
  if (!value.startsWith(INTERNAL_LINK_PREFIX)) return null;
  const slug = value.slice(INTERNAL_LINK_PREFIX.length);
  return SLUG_PATTERN.test(slug) ? slug : null;
}
