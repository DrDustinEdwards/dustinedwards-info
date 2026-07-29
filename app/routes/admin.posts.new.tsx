import { redirect } from "react-router";

import { Panel } from "~/components/admin/panel";
import { PostEditor } from "~/components/admin/post-editor";
import { getEnv } from "~/lib/context";
import { handleEditorAction } from "~/lib/editor/action.server";
import { savedRedirectPath } from "~/lib/editor/feedback";
import { EMPTY_FIELDS } from "~/lib/editor/frontmatter";
import { currentHead } from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.posts.new";

export function meta() {
  return [{ title: "New post · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const today = new Date().toISOString().slice(0, 10);
  // A missing or broken token must not blank the page. Preview does not touch
  // GitHub, so the editor stays usable and only saving reports the problem.
  const headSha = await currentHead(getEnv(context)).catch(() => "");
  return { headSha, fields: { ...EMPTY_FIELDS, date: today } };
}

export async function action({ request, context }: Route.ActionArgs) {
  const result = await handleEditorAction(getEnv(context), request);
  if (result.kind === "saved") return redirect(savedRedirectPath(result));
  return result;
}

export default function NewPost({ loaderData, actionData }: Route.ComponentProps) {
  const fields = actionData && "fields" in actionData ? actionData.fields : loaderData.fields;
  const headSha = actionData && "headSha" in actionData ? actionData.headSha : loaderData.headSha;

  return (
    <Panel title="New post" description="Saving creates content/posts/<slug>.md on main.">
      <PostEditor
        fields={fields}
        isNew
        headSha={headSha}
        previewHtml={actionData?.kind === "preview" ? actionData.previewHtml : null}
        // A success never renders here: it redirects to the edit route, where
        // the slug is fixed and the message belongs. Only a failure stays.
        feedback={
          actionData?.kind === "problem"
            ? {
                state: "failed",
                message: actionData.problem.message,
                conflict: Boolean(actionData.problem.conflict),
              }
            : null
        }
      />
    </Panel>
  );
}
