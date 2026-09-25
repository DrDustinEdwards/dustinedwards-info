import { data, redirect } from "react-router";

import { timed, timedLoader } from "~/lib/timing";

import { PostEditor } from "~/components/admin/post-editor";
import { listAllPostsForAdmin } from "~/db";
import { getEnv } from "~/lib/context";
import { loadEditorOptions } from "~/lib/editor/link-targets.server";
import { handleEditorAction } from "~/lib/editor/action.server";
import { savedRedirectPath } from "~/lib/editor/feedback";
import { EMPTY_FIELDS } from "~/lib/editor/frontmatter";
import { readHead } from "~/lib/editor/head.server";
import { adminActorContext } from "~/lib/auth.server";
import type { Route } from "./+types/admin.posts.new";
import { errorMessage } from "~/lib/error-message.mjs";

/* Always: the exact-preview pane copies this document's stylesheets into its iframe. */
export const handle = { math: true };

export function meta() {
  return [{ title: "New post · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const today = new Date().toISOString().slice(0, 10);
    // A broken token must not blank the page: preview does not touch GitHub, and the editor names the failure.
    const { headSha, headError } = await timed(timings, "gh_head", () => readHead(env));
    const { tagOptions, linkTargets, problems: loadProblems } = await loadEditorOptions(env, timings);
    const failed = (what: string, sentence: string) => (error: unknown) => {
      console.error(`editor ${what} read failed`, error);
      loadProblems.push(`${sentence}: ${errorMessage(error)}`);
      return [];
    };
    const payload = {
      headSha,
      headError,
      fields: { ...EMPTY_FIELDS, date: today },
      tagOptions,
      linkTargets,
      // The save gate remains the authority; this only saves a wasted submit.
      existingSlugs: (
        await timed(timings, "d1_all_posts", () =>
          listAllPostsForAdmin(env).catch(
            failed("posts", "Existing posts could not be read, so a taken slug is only caught on save"),
          ),
        )
      ).map((post) => post.slug),
      loadProblems,
    };

    return data(payload);
  });
}


export async function action({ request, context }: Route.ActionArgs) {
  const result = await handleEditorAction(getEnv(context), request, context.get(adminActorContext));
  if (result.kind === "saved") return redirect(savedRedirectPath(result));
  return result;
}

export default function NewPost({ loaderData, actionData }: Route.ComponentProps) {
  const fields = actionData && "fields" in actionData ? actionData.fields : loaderData.fields;
  const headSha = actionData && "headSha" in actionData ? actionData.headSha : loaderData.headSha;

  return (
    <PostEditor
      fields={fields}
      isNew
      headSha={headSha}
      headError={headSha ? null : loaderData.headError}
      loadProblems={loaderData.loadProblems}
      previewHtml={actionData?.kind === "preview" ? actionData.previewHtml : null}
      feedback={
        actionData?.kind === "problem"
          ? {
              state: "failed",
              message: actionData.problem.message,
              conflict: Boolean(actionData.problem.conflict),
              field: actionData.problem.field,
              line: actionData.problem.line,
            }
          : null
      }
      state="draft"
      everPublished={false}
      awaitingPublishConfirmation={actionData?.kind === "confirm-publish"}
      tagOptions={loaderData.tagOptions}
      linkTargets={loaderData.linkTargets}
      existingSlugs={loaderData.existingSlugs}
    />
  );
}
