import { KbFileEditor } from "~/components/admin/kb-file-editor";
import { kbEditorAction, kbEditorLoader } from "~/kb/editor-route.server";

import type { Route } from "./+types/admin.kb.entry";

/* One Knowledge Base entry's file, edited and saved through the procedure save (docs/KNOWLEDGE-BASE.md, step 3). */

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Edit ${params.slug} · Knowledge Base · Admin` }, { name: "robots", content: "noindex" }];
}

export function loader(args: Route.LoaderArgs) {
  return kbEditorLoader(args, { type: "entry", slug: args.params.slug });
}

export function action(args: Route.ActionArgs) {
  return kbEditorAction(args, { type: "entry", slug: args.params.slug });
}

export default function EditEntry({ loaderData, actionData }: Route.ComponentProps) {
  return <KbFileEditor key={loaderData.file.sha} file={loaderData.file} saved={loaderData.saved} actionData={actionData} />;
}
