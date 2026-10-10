import { renderToStaticMarkup } from "react-dom/server";

import { ProcedureView } from "~/components/procedure";
import { getEnv } from "~/lib/context";
import { errorMessage } from "~/lib/error-message.mjs";
import { rawFromForm } from "~/kb/form.server";
import { compile } from "~/kb/procedures/save.server";

import type { Route } from "./+types/admin.kb.preview";

// The public page's stylesheets, in the order its layout and route link them (legacy-public.tsx, procedure.tsx), which
// the preview frame links: the admin links none of them.
import appCss from "~/app.css?url";
import pageShellCss from "~/styles/page-shell.css?url";
import shellCss from "~/styles/shell.css?url";
import proseCss from "~/styles/prose.css?url";
import procedureCss from "~/styles/procedure.css?url";

const STYLES = [appCss, pageShellCss, shellCss, proseCss, procedureCss];

/**
 * The Knowledge Base editor's live preview (docs/KNOWLEDGE-BASE.md): the entry the form describes, compiled by the save's
 * own compile and drawn by the public page's own component, so the preview is the page. Read only although it is a POST:
 * a whole form does not belong in a query string, and nothing is written. A file the checks refuse answers with their
 * messages, as a 200, since a half-made edit is ordinary.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const slug = params.slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return Response.json({ error: "No such entry." }, { status: 404 });
  const form = await request.formData();
  const written = rawFromForm(String(form.get("original") ?? ""), String(form.get("model") ?? ""));
  if ("errors" in written) return Response.json({ errors: written.errors });
  try {
    const compiled = await compile(getEnv(context), slug, written.raw);
    if (!compiled.ok) return Response.json({ errors: compiled.errors });
    const { record } = compiled;
    const count = record.profile === "recipe" ? (record.servings ?? 1) : (record.scale?.count ?? 1);
    const html = renderToStaticMarkup(
      <main className="page">
        <div className="page-inner">
          <h1 className="page-title">{record.title}</h1>
          <ProcedureView record={record} count={count} factor={1} sheetPath={null} />
        </div>
      </main>,
    );
    return Response.json({ html, styles: STYLES });
  } catch (error) {
    console.error("kb preview failed", error);
    return Response.json({ error: `The preview failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
