/**
 * The consent step and the upstream sign-in through Cloudflare Access: the shared handler
 * (@dustinedwards/site-runtime/mcp-login), configured for this server. It lets in only the single
 * configured administrator (ADMIN_EMAIL). Capsid, Carrel and Foxing Admin sign in the same way, so
 * one Access login covers every server.
 *
 * Access rather than dustinedwards.info's own Better Auth: this server's identity stays independent
 * of the site's Google project, so a change there cannot affect operator access here.
 */

import { isAdminUser, loginHandler, type LoginEnv as SharedLoginEnv } from "@dustinedwards/site-runtime/mcp-login";

import { SCOPE_READ, SCOPE_WRITE } from "./auth";
import { SERVER_INFO } from "./mcp-handler";

export interface LoginEnv extends SharedLoginEnv {
  ADMIN_EMAIL?: string;
}

/** Everything the OAuth provider does not own: the consent flow and /health. */
export const defaultHandler = loginHandler<LoginEnv>({
  name: "Dustin Edwards Admin",
  scopes: { read: SCOPE_READ, write: SCOPE_WRITE },
  about: `<p>Dustin Edwards Admin runs dustinedwards.info: site health, drift repair,
webmentions, media, registries, citations and procedures. It cannot write posts;
Carrel owns writing.</p>
<p>It will always be able to read. Changes (repairing drift, deciding mentions,
uploading and backing up media, refreshing citations, saving a procedure) need the
box below. It will not be able to publish a procedure for the first time; that
stays with you.</p>`,
  admit: isAdminUser,
  // Every sign-in, admitted or refused, is a row in the tool-call log.
  audit: { name: SERVER_INFO.name, version: SERVER_INFO.version },
});
