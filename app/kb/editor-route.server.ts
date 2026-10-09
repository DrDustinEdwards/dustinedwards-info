// The two editor routes' shared half (admin.kb.entry.tsx and admin.kb.item.tsx): read the file for the page, and run
// Check or Save for its form. A save that lands redirects back to the page, so a reload never posts it twice.

import { data, redirect, type RouterContextProvider } from "react-router";

import type { KbEditorActionData } from "~/components/admin/kb-file-editor";
import { adminActorContext } from "~/lib/admin-actor.server";
import { getEnv } from "~/lib/context";

import { checkFile, loadFile, saveFile, type KbTarget } from "./editor.server";

type Args = { request: Request; context: Readonly<RouterContextProvider> };

export async function kbEditorLoader({ request, context }: Args, target: KbTarget) {
  const file = await loadFile(getEnv(context), target);
  if (!file) throw new Response("There is no such file in the Knowledge Base.", { status: 404 });
  const url = new URL(request.url);
  const commit = url.searchParams.get("saved");
  return data({ file, saved: commit ? { commit, unchanged: url.searchParams.get("unchanged") === "1" } : null });
}

export async function kbEditorAction({ request, context }: Args, target: KbTarget) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const raw = String(form.get("raw") ?? "").replace(/\r\n/g, "\n");

  if (intent === "check") {
    const checked = await checkFile(env, target, raw);
    return data<KbEditorActionData>({ intent: "check", raw, ...checked });
  }
  if (intent === "save") {
    const sha = String(form.get("sha") ?? "");
    const result = await saveFile(env, target, raw, sha, context.get(adminActorContext));
    if (result.outcome === "saved") {
      const url = new URL(request.url);
      const params = new URLSearchParams({ saved: result.commitSha.slice(0, 7) });
      if (result.unchanged) params.set("unchanged", "1");
      return redirect(`${url.pathname}?${params}`);
    }
    return data<KbEditorActionData>(
      result.outcome === "refused" ? { intent: "save", raw, refused: result.errors } : { intent: "save", raw, conflict: result.message },
      { status: result.outcome === "refused" ? 422 : 409 },
    );
  }
  return data({ intent: "check" as const, raw, ok: false, errors: ["Unknown action."], gaps: [] }, { status: 400 });
}
