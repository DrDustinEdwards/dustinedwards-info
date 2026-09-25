import { afterEach, describe, expect, it } from "vitest";

import { postPath } from "~/lib/content/pipeline.mjs";
import { loader as editLoader } from "~/routes/admin.posts.$slug.edit";

import { post } from "./fixtures";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { routeContext } from "./route-helpers";

let gh: GitHubStub | undefined;

afterEach(() => {
  gh?.restore();
  gh = undefined;
});

async function loadEditor(slug: string) {
  return editLoader({
    params: { slug },
    request: new Request(`https://example.com/admin/posts/${slug}/edit`),
    context: routeContext(),
  } as never);
}

describe("the edit loader", () => {
  it("names a failed head read instead of reporting a missing token", async () => {
    gh = stubGitHub({ [postPath("head-read-fails")]: post("head-read-fails") });
    gh.failNext("git/ref/heads/main", 1);

    const data = await loadEditor("head-read-fails");

    expect(data.headSha).toBe("");
    expect(data.headError).toMatch(/planted failure|500/);
  });

  it("reports a failed version list rather than an empty history", async () => {
    /* The stub has no commit-list shape, so that read throws, which is the outage being modeled. */
    gh = stubGitHub({ [postPath("history-read-fails")]: post("history-read-fails") });

    const data = await loadEditor("history-read-fails");

    expect(data.revisions).toEqual([]);
    expect(data.revisionsError).toBeTruthy();
    expect(data.headError).toBeNull();
  });
});
