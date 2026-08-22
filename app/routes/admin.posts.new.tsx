import { data, redirect } from "react-router";

import { serverTiming, timed, timingsContext } from "~/lib/timing";

import { PostEditor } from "~/components/admin/post-editor";
import { listAllPostsForAdmin, listBlogTags } from "~/db";
import { getEnv } from "~/lib/context";
import { loadLinkTargets } from "~/lib/editor/link-targets.server";
import { handleEditorAction } from "~/lib/editor/action.server";
import { savedRedirectPath } from "~/lib/editor/feedback";
import { EMPTY_FIELDS } from "~/lib/editor/frontmatter";
import { currentHead } from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.posts.new";

export function meta() {
  return [{ title: "New post · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * FOUR SERIAL AWAITS, three of them inside the returned object literal, same
   * shape as the editor. Marked without reordering, so the numbers describe
   * what ships.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  const today = new Date().toISOString().slice(0, 10);
  // A missing or broken token must not blank the page. Preview does not touch
  // GitHub, so the editor stays usable and only saving reports the problem.
  const headSha = await timed(timings, "gh_head", () => currentHead(env).catch(() => ""));
  const payload = {
    headSha,
    fields: { ...EMPTY_FIELDS, date: today },
    tagOptions: (
      await timed(timings, "d1_tags", () => listBlogTags(env).catch(() => []))
    ).map((tag) => tag.slug),
    // The site's own posts, for the body editor's Cmd+K link search.
    linkTargets: await timed(timings, "d1_link_targets", () => loadLinkTargets(env)),
    // So the slug field can say "taken" while the author is still typing,
    // rather than after a round trip that gets refused. The save gate remains
    // the authority; this only saves a wasted submit.
    existingSlugs: (
      await timed(timings, "d1_all_posts", () => listAllPostsForAdmin(env).catch(() => []))
    ).map((post) => post.slug),
  };

  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return timings
    ? data(payload, { headers: { "Server-Timing": serverTiming(timings) } })
    : data(payload);
}

/**
 * Carries the loader's `Server-Timing` to the response. Same shape as
 * admin.tsx and admin.media._index, and deliberately no Cache-Control.
 */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers();
  const timing = loaderHeaders.get("Server-Timing");
  if (timing) headers.set("Server-Timing", timing);
  return headers;
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
    <PostEditor
      fields={fields}
      isNew
      headSha={headSha}
      previewHtml={actionData?.kind === "preview" ? actionData.previewHtml : null}
      // A success never renders here: it redirects to the edit route, where the
      // slug is fixed and the message belongs. Only a failure stays.
      feedback={
        actionData?.kind === "problem"
          ? {
              state: "failed",
              message: actionData.problem.message,
              conflict: Boolean(actionData.problem.conflict),
            }
          : null
      }
      // A post that does not exist yet is a draft that has never been public,
      // so the primary action is Publish behind the ceremony, exactly as it
      // would be on the first edit after creating it.
      state="draft"
      everPublished={false}
      tagOptions={loaderData.tagOptions}
      linkTargets={loaderData.linkTargets}
      existingSlugs={loaderData.existingSlugs}
    />
  );
}
