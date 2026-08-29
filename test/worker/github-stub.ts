import { vi } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";

/**
 * The GitHub boundary, stubbed at the OUTBOUND FETCH LAYER.
 *
 * ## WHY HERE AND NOT AT THE MODULE
 *
 * `github.server.ts` is the subject, not a dependency to be swapped out. Its
 * job is to build the four-call Git Data commit (blob, tree, commit, ref), send
 * the `expectedHeadSha` guard, and read back the per-path blob shas that
 * `renderAndWrite` then checks the rendered bytes against. Mocking the module
 * would delete exactly that and leave a test of the caller's argument list.
 *
 * Every function in it calls the bare global `fetch`, resolved at call time, so
 * replacing the global intercepts the wire and nothing else.
 *
 * ## IT REFUSES EVERY HOST IT DOES NOT KNOW
 *
 * The one property that makes "never hit live" a mechanism rather than an
 * intention. A request to anything but `api.github.com`, or to a github path
 * with no recorded shape, THROWS and names what was asked for. A stub that fell
 * through to the real network would pass locally against a live repository and
 * be one token away from writing to it.
 *
 * ## THE SHAPES ARE RECORDED, AND THE BLOB SHA IS REAL
 *
 * `blobShas` from `commitFiles` comes off the tree entries, and `savePost`
 * hands the markdown's entry to `renderAndWrite`, which refuses unless the
 * bytes it rendered hash to it. So this stub computes a REAL `gitBlobSha` over
 * the content it is handed rather than returning a placeholder. A fixed fake
 * would make the provenance assertion unfailable, which is the class hard rule
 * 10 names first.
 *
 * ## THE REPOSITORY CHANGES ONLY WHEN THE REF MOVES
 *
 * A tree POST is held; the PATCH on `refs/heads/main` is what applies it. That
 * is not decoration: `savePost`'s conflict case refuses at `expectedHeadSha`
 * before any blob is written, and a stub that applied the tree eagerly would
 * report a repository that had changed after a refusal.
 */

/** One recorded call, for a test to assert what the code actually sent. */
export type RecordedCall = {
  method: string;
  path: string;
  body: unknown;
};

export type GitHubStub = {
  /** Every api.github.com request, in order. */
  calls: RecordedCall[];
  /** The files the repository holds, by path. A landed commit mutates it. */
  files: Map<string, string>;
  /** What `main` points at. A landed commit moves it. */
  head: { commitSha: string; treeSha: string };
  /**
   * Fail the next `times` requests whose path contains `fragment`, with a 500.
   *
   * For the divergence path: the D1 retry is exercised by making a write fail
   * once, and the honest place to do that is the boundary rather than inside
   * the retry helper.
   */
  failNext: (fragment: string, times: number) => void;
  /** Restores the real global `fetch`. */
  restore: () => void;
};

const API = "https://api.github.com";
const REPO_PREFIX = "/repos/DrDustinEdwards/dustinedwards-info";

/** The commit sha `main` starts at, so a conflict test has something to disagree with. */
export const STUB_HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/**
 * Installs the stub over `globalThis.fetch` and returns the handle.
 *
 * @param seed files the repository already holds, by path
 */
export function stubGitHub(seed: Record<string, string> = {}): GitHubStub {
  const files = new Map(Object.entries(seed));
  const calls: RecordedCall[] = [];
  const head = { commitSha: STUB_HEAD_SHA, treeSha: "tree-initial" };
  /** Pending forced failures, by path fragment. */
  const failures = new Map<string, number>();
  /** sha -> the bytes the blob POST that created it carried. */
  const blobBodies = new Map<string, string>();
  /** The tree of a commit that has not landed on the ref yet. */
  let pendingTree: Array<{ path: string; content: string | null }> = [];
  let commitCounter = 0;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(API)) {
      throw new Error(
        `the GitHub stub refuses ${url}: this layer never reaches the network. ` +
          `If a new outbound call is legitimate, record its shape here.`,
      );
    }

    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.slice(API.length);
    const rawBody = typeof init?.body === "string" ? init.body : null;
    const body: unknown = rawBody ? JSON.parse(rawBody) : null;
    calls.push({ method, path, body });

    for (const [fragment, remaining] of failures) {
      if (remaining > 0 && path.includes(fragment)) {
        failures.set(fragment, remaining - 1);
        return json({ message: `planted failure on ${fragment}` }, 500);
      }
    }

    /* ---------------------------------------------------------- reads --- */

    if (method === "GET" && path === `${REPO_PREFIX}/git/ref/heads/main`) {
      return json({ object: { sha: head.commitSha } });
    }
    if (method === "GET" && path.startsWith(`${REPO_PREFIX}/git/commits/`)) {
      return json({ tree: { sha: head.treeSha } });
    }
    if (method === "GET" && path.startsWith(`${REPO_PREFIX}/contents/`)) {
      const target = decodeURI(path.slice(`${REPO_PREFIX}/contents/`.length).split("?")[0] ?? "");

      /*
       * A DIRECTORY answers with an ARRAY and a file with an OBJECT, and
       * `listDirectory` refuses anything that is not an array. Both shapes are
       * here because `regenerateAllFromRepo` reads the first and `readFile`
       * the second, and collapsing them would make the rebuild door untestable.
       */
      const children = [...files.keys()].filter((p) => p.startsWith(`${target}/`));
      if (!files.has(target) && children.length > 0) {
        return json(
          await Promise.all(
            children.map(async (p) => ({
              name: p.slice(target.length + 1),
              path: p,
              sha: await gitBlobSha(files.get(p) ?? ""),
              type: "file",
              size: (files.get(p) ?? "").length,
            })),
          ),
        );
      }

      const content = files.get(target);
      if (content === undefined) return json({ message: "Not Found" }, 404);
      const bytes = new TextEncoder().encode(content);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return json({
        content: btoa(binary),
        encoding: "base64",
        sha: await gitBlobSha(content),
        size: bytes.byteLength,
      });
    }

    /* --------------------------------------------------------- writes --- */

    if (method === "POST" && path === `${REPO_PREFIX}/git/blobs`) {
      const { content } = body as { content: string };
      const sha = await gitBlobSha(content);
      blobBodies.set(sha, content);
      return json({ sha });
    }

    if (method === "POST" && path === `${REPO_PREFIX}/git/trees`) {
      const { tree } = body as { tree: Array<{ path: string; sha: string | null }> };
      pendingTree = tree.map((entry) => {
        if (entry.sha === null) return { path: entry.path, content: null };
        const content = blobBodies.get(entry.sha);
        if (content === undefined) {
          throw new Error(
            `the tree names blob ${entry.sha}, which no recorded blob POST created.`,
          );
        }
        return { path: entry.path, content };
      });
      commitCounter += 1;
      return json({ sha: `tree-${commitCounter}` });
    }

    if (method === "POST" && path === `${REPO_PREFIX}/git/commits`) {
      return json({ sha: `commit${String(commitCounter).padStart(34, "0")}` });
    }

    if (method === "PATCH" && path === `${REPO_PREFIX}/git/refs/heads/main`) {
      const { sha } = body as { sha: string };
      for (const entry of pendingTree) {
        if (entry.content === null) files.delete(entry.path);
        else files.set(entry.path, entry.content);
      }
      pendingTree = [];
      head.commitSha = sha;
      head.treeSha = `tree-after-${sha}`;
      return json({ object: { sha } });
    }

    throw new Error(
      `the GitHub stub has no recorded shape for ${method} ${path}. ` +
        `Record it rather than letting the call through.`,
    );
  };

  vi.stubGlobal("fetch", stub);

  return {
    calls,
    files,
    head,
    failNext: (fragment, times) => failures.set(fragment, times),
    restore: () => vi.unstubAllGlobals(),
  };
}
