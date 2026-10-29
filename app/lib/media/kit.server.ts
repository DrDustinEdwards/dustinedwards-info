// The admin library's server half: site-api's content kit over the same adapter Carrel's requests reach,
// in process through localClient, so the admin and Carrel run one loader, one set of intents and one
// set of the site's rules. The admin is behind Cloudflare Access and only Dustin signs in, so every
// step is his to take; the kit still asks before a delete or emptying the trash.

import { runMediaIntent, type ContentSource, type IntentResult } from "@dustinedwards/site-api/admin";
import { localClient } from "@dustinedwards/site-api/client";
import type { RouterContextProvider } from "react-router";

import { carrelSiteAdapter } from "~/lib/carrel/site-adapter.server";
import { documentHandlerContext, getEnv, getExecutionContext } from "~/lib/context";

/** Where a place that uses a file opens: a post is written in Carrel, so it opens on the site. */
export function useHref(use: { type: string; id: string }): string {
  return use.type === "post" ? `/writing/${encodeURIComponent(use.id)}` : "";
}

export function adminMediaSource(context: Readonly<RouterContextProvider>, request: Request): ContentSource {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const adapter = carrelSiteAdapter({ env, ctx: getExecutionContext(context), origin, renderDocument: context.get(documentHandlerContext) });
  return {
    site: { id: "dustinedwards", name: "dustinedwards.info", origin },
    client: localClient(adapter),
    can: { edit: true, publish: true, deleteContent: true, deleteMedia: true, decideMentions: true },
    editorHref: (id) => useHref({ type: "post", id }),
  };
}

/** One posted intent, as the kit runs it: the page's forms with no script and its fetches with script alike. */
export function runAdminMediaIntent(context: Readonly<RouterContextProvider>, request: Request, form: FormData): Promise<IntentResult> {
  return runMediaIntent(adminMediaSource(context, request), form);
}
