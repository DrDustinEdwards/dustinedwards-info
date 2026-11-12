import { UPLOAD_FORM_BYTES } from "~/lib/body.server";
import { readForm } from "@dustinedwards/site-runtime/body";
import { data } from "react-router";

import {
  loadMedia,
  loadMediaChanges,
  readMediaQuery,
  type IntentResult,
} from "@dustinedwards/site-api/admin";
import {
  mediaDataOfKit,
  readMediaView,
  type KitMediaChanges,
} from "capsomer/behavior/media-library";
import type { MediaRecord } from "capsomer/behavior/media";
import { KitForm, useKitSubmit } from "capsomer/react/kit-form";
import { MediaLibrary } from "capsomer/react/media-library";
import { PageHead } from "capsomer/react/page-head";

import { prefersType } from "~/lib/negotiate.mjs";
import { adminKitSource, runAdminMediaIntent, hrefForUse } from "~/lib/admin-kit.server";
import type { Route } from "./+types/admin.media._index";
import { UNCACHED } from "@dustinedwards/site-runtime/edge-cache";

/*
 * The media library: Capsomer's MediaLibrary over site-api's content kit, the same screen and the same
 * intents as Carrel's, through the adapter Carrel's requests reach (lib/admin-kit.server.ts). Browse,
 * search, tags, the lenses, upload, the inspector (alt text, tags, caption, focal point, crop and
 * replace), Trash with Undo, and delete for good after the kit asks for the count. Every action is a
 * form post, so it all works with no script; with script the posts answer in place, and the page picks
 * up what Carrel or another tab changed (`?changes=<cursor>`). Rebuilding the index is on /admin/tools.
 */

export function meta() {
  return [{ title: "Media · Admin" }, { name: "robots", content: "noindex" }];
}

/** The page's data, for the library and for a fetch that asks for JSON (quick search, and posts with script). */
async function libraryData(context: Route.LoaderArgs["context"], request: Request) {
  const search = new URL(request.url).searchParams;
  const kit = await loadMedia(adminKitSource(context, request), readMediaQuery(search));
  return mediaDataOfKit(kit, { usedHref: hrefForUse, view: readMediaView(search) });
}

/*
 * A fetch that asks for JSON is answered here, after the admin layout's middleware has authenticated
 * the request: a document loader cannot return JSON.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    if (!prefersType(request, "application/json")) return next();
    if (request.method === "POST") {
      return Response.json(
        await runAdminMediaIntent(context, request, await readForm(request, UPLOAD_FORM_BYTES)),
      );
    }
    const cursor = new URL(request.url).searchParams.get("changes");
    const body =
      cursor === null
        ? await libraryData(context, request)
        : await loadMediaChanges(adminKitSource(context, request), cursor);
    return Response.json(body, { headers: { "cache-control": UNCACHED } });
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  return data({ library: await libraryData(context, request) });
}

/* The kit asks before a delete or emptying the trash (`confirm`), and changes nothing until the count is typed. */
export async function action({ request, context }: Route.ActionArgs): Promise<IntentResult> {
  return runAdminMediaIntent(context, request, await readForm(request, UPLOAD_FORM_BYTES));
}

const BASE = "/admin/media";
const JSON_HEADERS = { accept: "application/json" };

export default function AdminMedia({ loaderData, actionData }: Route.ComponentProps) {
  const submit = useKitSubmit(BASE);
  const search = async (q: string, signal: AbortSignal): Promise<MediaRecord[]> => {
    const response = await fetch(`${BASE}?q=${encodeURIComponent(q)}`, {
      signal,
      headers: JSON_HEADERS,
    });
    const body = (await response.json().catch(() => null)) as { rows?: MediaRecord[] } | null;
    return body?.rows ?? [];
  };
  const changes = async (
    cursor: string,
    signal: AbortSignal,
  ): Promise<KitMediaChanges | { reload: true }> => {
    const response = await fetch(`${BASE}?changes=${encodeURIComponent(cursor)}`, {
      signal,
      headers: JSON_HEADERS,
    });
    if (!response.ok) throw new Error(`The server answered ${response.status}.`);
    return (await response.json()) as KitMediaChanges | { reload: true };
  };
  return (
    <div className="app-page">
      <PageHead
        title="Media"
        lead="The files the site stores and serves, the same library Carrel shows."
      />
      <MediaLibrary
        data={loaderData.library}
        action={BASE}
        Form={KitForm}
        submit={submit}
        result={actionData ?? null}
        inspector="form"
        search={search}
        bytesHref={(id) => `/media/${id}`}
        changes={changes}
      />
    </div>
  );
}
