// The two editor routes' shared half (admin.kb.entry.tsx and admin.kb.item.tsx): read the file for the page, and run
// Check or Save for its form. A save that lands redirects back to the page, so a reload never posts it twice.

import { data, redirect, type RouterContextProvider } from "react-router";

import type { KbEditorActionData } from "~/components/admin/kb-file-editor";
import { adminActorContext } from "~/lib/admin-actor.server";
import { getEnv } from "~/lib/context";

import { checkFile, loadFile, saveFile, type KbTarget } from "./editor.server";
import { duplicateEntry, formFor, rawFromForm } from "./form.server";

type Args = { request: Request; context: Readonly<RouterContextProvider> };

export async function kbEditorLoader({ request, context }: Args, target: KbTarget) {
  const file = await loadFile(getEnv(context), target);
  if (!file) throw new Response("There is no such file in the Knowledge Base.", { status: 404 });
  const url = new URL(request.url);
  const commit = url.searchParams.get("saved");
  // The form is the editor; the file itself is behind Advanced (?view=file), which also works with no script at all.
  const view = url.searchParams.get("view") === "file" ? ("file" as const) : ("form" as const);
  return data({
    file,
    view,
    form: view === "form" ? await formFor(getEnv(context), file) : null,
    saved: commit ? { commit, unchanged: url.searchParams.get("unchanged") === "1" } : null,
    created: url.searchParams.get("created") === "1",
  });
}

export async function kbEditorAction({ request, context }: Args, target: KbTarget) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const posted = form.get("model");

  if (intent === "duplicate" && target.type === "entry") {
    const file = await loadFile(env, target);
    if (!file) throw new Response("There is no such file in the Knowledge Base.", { status: 404 });
    const made = await duplicateEntry(
      env,
      { slug: target.slug, raw: file.raw },
      { title: String(form.get("title") ?? ""), slug: String(form.get("slug") ?? "") },
      context.get(adminActorContext),
    );
    if (made.outcome === "created") return redirect(`/admin/kb/entry/${made.slug}?created=1`);
    return data<KbEditorActionData>({ intent: "duplicate", raw: "", refused: made.errors }, { status: 422 });
  }

  // From the form, the file is written from what it sent over the file it was opened from; from Advanced, it is the text.
  let raw = String(form.get("raw") ?? "").replace(/\r\n/g, "\n");
  const model = typeof posted === "string" ? posted : undefined;
  if (model !== undefined) {
    const written = rawFromForm(String(form.get("original") ?? "").replace(/\r\n/g, "\n"), model);
    if ("errors" in written) {
      return data<KbEditorActionData>({ intent: "check", raw: "", model, ok: false, errors: written.errors, gaps: [] }, { status: 422 });
    }
    raw = written.raw;
  }

  if (intent === "check") {
    const checked = await checkFile(env, target, raw);
    return data<KbEditorActionData>({ intent: "check", raw, model, ...checked });
  }
  if (intent === "save") {
    const sha = String(form.get("sha") ?? "");
    const result = await saveFile(env, target, raw, sha, context.get(adminActorContext));
    if (result.outcome === "saved") {
      const url = new URL(request.url);
      const params = new URLSearchParams({ saved: result.commitSha.slice(0, 7) });
      if (result.unchanged) params.set("unchanged", "1");
      if (model === undefined) params.set("view", "file");
      return redirect(`${url.pathname}?${params}`);
    }
    return data<KbEditorActionData>(
      result.outcome === "refused" ? { intent: "save", raw, model, refused: result.errors } : { intent: "save", raw, model, conflict: result.message },
      { status: result.outcome === "refused" ? 422 : 409 },
    );
  }
  return data({ intent: "check" as const, raw, ok: false, errors: ["Unknown action."], gaps: [] }, { status: 400 });
}
