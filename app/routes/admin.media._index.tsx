import { Form, data, useRevalidator, type FormProps } from "react-router";

import { loadMedia, readMediaQuery, type IntentResult } from "@dustinedwards/site-api/admin";
import { mediaDataOfKit, readMediaView } from "capsomer/behavior/media-library";
import type { MediaRecord } from "capsomer/behavior/media";
import { MediaLibrary, type FormComponent } from "capsomer/react/media-library";
import { PageHead } from "capsomer/react/page-head";

import { prefersType } from "~/lib/negotiate.mjs";
import { adminMediaSource, runAdminMediaIntent, useHref } from "~/lib/media/kit.server";
import type { Route } from "./+types/admin.media._index";

/*
 * The media library: Capsomer's MediaLibrary over site-api's content kit, the same screen and the same
 * intents as Carrel's, through the adapter Carrel's requests reach (lib/media/kit.server.ts). Browse,
 * search, tags, the lenses, upload, the inspector (alt text, tags, caption, focal point, crop and
 * replace), Trash with Undo, and delete for good after the kit asks for the count. Every action is a
 * form post, so it all works with no script; with script the posts answer in place. Rebuilding the
 * index is on /admin/tools.
 */

export function meta() {
  return [{ title: "Media · Admin" }, { name: "robots", content: "noindex" }];
}

/** The page's data, for the library and for a fetch that asks for JSON (quick search, and posts with script). */
async function libraryData(context: Route.LoaderArgs["context"], request: Request) {
  const search = new URL(request.url).searchParams;
  const kit = await loadMedia(adminMediaSource(context, request), readMediaQuery(search));
  // site-api v0.13.0 sorts by use; Capsomer's library (v0.39.0) has no such control yet, so it shows the default order.
  const sort = kit.query.sort === "used" ? undefined : kit.query.sort;
  return mediaDataOfKit({ ...kit, query: { ...kit.query, sort } }, { usedHref: useHref, view: readMediaView(search) });
}

/*
 * A fetch that asks for JSON is answered here, after the admin layout's middleware has authenticated
 * the request: a document loader cannot return JSON.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    if (!prefersType(request, "application/json")) return next();
    if (request.method === "POST") {
      return Response.json(await runAdminMediaIntent(context, request, await request.formData()));
    }
    return Response.json(await libraryData(context, request), { headers: { "cache-control": "private, no-store" } });
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  return data({ library: await libraryData(context, request) });
}

/* The kit asks before a delete or emptying the trash (`confirm`), and changes nothing until the count is typed. */
export async function action({ request, context }: Route.ActionArgs): Promise<IntentResult> {
  return runAdminMediaIntent(context, request, await request.formData());
}

// Moving between views (search, a tag, a file to open) is the router's GET, so it stays in the app; a
// post is a plain form, which the library sends through `submit` with script and the browser sends to
// this route's action without.
const LibraryForm: FormComponent = ({ method, action, ...props }) =>
  (method ?? "get").toLowerCase() === "get" ? (
    <Form {...(props as Omit<FormProps, "method" | "action">)} action={typeof action === "string" ? action : undefined} method="get" />
  ) : (
    <form {...props} action={action} method={method} />
  );

const BASE = "/admin/media";
const JSON_HEADERS = { accept: "application/json" };

export default function AdminMedia({ loaderData, actionData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  const submit = async (form: FormData): Promise<IntentResult> => {
    const response = await fetch(BASE, { method: "POST", body: form, headers: JSON_HEADERS });
    const body = (await response.json().catch(() => null)) as IntentResult | null;
    if (body && "ok" in body) {
      if (!body.confirm) void revalidator.revalidate();
      return body;
    }
    return { ok: false, message: `The server answered ${response.status}.` };
  };
  const search = async (q: string, signal: AbortSignal): Promise<MediaRecord[]> => {
    const response = await fetch(`${BASE}?q=${encodeURIComponent(q)}`, { signal, headers: JSON_HEADERS });
    const body = (await response.json().catch(() => null)) as { rows?: MediaRecord[] } | null;
    return body?.rows ?? [];
  };
  return (
    <div className="app-page">
      <PageHead title="Media" lead="The files the site stores and serves, the same library Carrel shows." />
      <MediaLibrary
        data={loaderData.library}
        action={BASE}
        Form={LibraryForm}
        submit={submit}
        result={actionData ?? null}
        inspector="form"
        search={search}
        bytesHref={(id) => `/media/${id}`}
      />
    </div>
  );
}
