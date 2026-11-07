import { ADMIN_FORM_BYTES, cappedForm } from "~/lib/body.server";
import { data, useRevalidator } from "react-router";

import { loadMentions, readMentionsQuery, type IntentResult } from "@dustinedwards/site-api/admin";
import { kitMentionsSearch, mentionsDataOfKit } from "capsomer/behavior/mentions-list";
import { MentionsList } from "capsomer/react/mentions-list";
import { PageHead } from "capsomer/react/page-head";

import { adminKitSource, runAdminMentionsIntent } from "~/lib/admin-kit.server";
import { prefersType } from "~/lib/negotiate.mjs";
import { FAILED_RETENTION_DAYS, REJECTED_RETENTION_DAYS } from "~/lib/webmention/retention.mjs";

import type { Route } from "./+types/admin.mentions";

/*
 * The webmention queue: Capsomer's MentionsList over site-api's content kit, the same screen and the same
 * intents as Carrel's, through the adapter Carrel's requests reach (lib/carrel/mentions-adapter.server.ts).
 * Tabs by state with the queue's counts, each row's decisions, the bulk bar, Undo, paging, and delete and the
 * retention sweep, which the kit asks about first. Everything a stranger sent is drawn as text. Every action
 * is a form post, so it all works with no script; with script the posts answer in place.
 */

export function meta() {
  return [{ title: "Mentions · Admin" }, { name: "robots", content: "noindex" }];
}

const RETENTION =
  `A mention whose source was not found is removed after ${FAILED_RETENTION_DAYS} days, ` +
  `a rejected one after ${REJECTED_RETENTION_DAYS}.`;

export async function loader({ request, context }: Route.LoaderArgs) {
  const search = new URL(request.url).searchParams;
  const kit = await loadMentions(
    adminKitSource(context, request),
    readMentionsQuery(kitMentionsSearch(search)),
  );
  return data({ mentions: { ...mentionsDataOfKit(kit, search), retention: RETENTION } });
}

/*
 * A fetch that asks for JSON is answered here, after the admin layout's middleware has authenticated the
 * request: a document action cannot return JSON.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    if (request.method !== "POST" || !prefersType(request, "application/json")) return next();
    return Response.json(
      await runAdminMentionsIntent(context, request, await cappedForm(request, ADMIN_FORM_BYTES)),
    );
  },
];

export async function action({ request, context }: Route.ActionArgs): Promise<IntentResult> {
  return runAdminMentionsIntent(context, request, await cappedForm(request, ADMIN_FORM_BYTES));
}

const BASE = "/admin/mentions";

export default function AdminMentions({ loaderData, actionData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  const submit = async (form: FormData): Promise<IntentResult> => {
    const response = await fetch(BASE, {
      method: "POST",
      body: form,
      headers: { accept: "application/json" },
    });
    const body = (await response.json().catch(() => null)) as IntentResult | null;
    if (body && "ok" in body) {
      if (!body.confirm) void revalidator.revalidate();
      return body;
    }
    return { ok: false, message: `The server answered ${response.status}.` };
  };
  return (
    <div className="app-page">
      <PageHead
        title="Mentions"
        lead="Webmentions about posts here, the same queue Carrel shows. Approving one shows it on the post within seconds."
      />
      <MentionsList
        data={loaderData.mentions}
        action={BASE}
        submit={submit}
        result={actionData ?? null}
      />
    </div>
  );
}
