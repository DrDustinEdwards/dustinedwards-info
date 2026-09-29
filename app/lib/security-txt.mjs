/**
 * RFC 9116. Expires is a fixed date, not "a year from now": a file that renews itself on every
 * request would keep vouching for a contact nobody has checked. test/security-txt.test.mjs fails
 * 30 days before it lapses, which is the prompt to confirm the address still works and move it on.
 */
export const SECURITY_CONTACT = "security@dustinedwards.info";
export const SECURITY_TXT_EXPIRES = "2027-09-28T00:00:00.000Z";

/** @param {string} origin */
export function securityTxt(origin) {
  return [
    `Contact: mailto:${SECURITY_CONTACT}`,
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    "Preferred-Languages: en",
    `Canonical: ${origin}/.well-known/security.txt`,
    "",
  ].join("\n");
}
