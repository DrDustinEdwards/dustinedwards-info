/**
 * The tightened Dynamic Client Registration check. Ruling mcp-2026-10-10,
 * rule 13.
 *
 * DCR is deprecated by the specification and kept only for the clients that
 * still need it (Grok, Gemini). So a registration is allowed only when EVERY
 * redirect URI it names is listed, character for character, in
 * DCR_REDIRECT_URIS. No prefix match, no wildcard, no host match: a redirect URI
 * is where an authorization code is delivered, and "close to an allowed one" is
 * how codes are stolen. An empty or unset list refuses every registration,
 * which is the closed state.
 *
 * Registration still grants nothing. A registered client can only send the
 * administrator to the consent page, and from there to Access and isAdminUser.
 *
 * Pure, so the whole rule is unit tested without the OAuth library.
 */

/** The allowlist, parsed from the comma-separated var. */
export function allowedRedirects(configured: string | undefined): string[] {
  return (configured ?? "")
    .split(",")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

/** Null when the registration may proceed, else why it is refused, naming the URI. */
export function registrationRefusal(
  configured: string | undefined,
  clientMetadata: Record<string, unknown>,
): string | null {
  const allowed = allowedRedirects(configured);
  if (allowed.length === 0) {
    return "Dynamic client registration is closed on this server: no redirect URI is allowlisted.";
  }
  const asked = clientMetadata.redirect_uris;
  if (!Array.isArray(asked) || asked.length === 0) {
    return "A registration must name at least one redirect URI.";
  }
  for (const uri of asked) {
    if (typeof uri !== "string" || !allowed.includes(uri)) {
      return `The redirect URI ${JSON.stringify(uri)} is not allowlisted on this server.`;
    }
  }
  return null;
}
