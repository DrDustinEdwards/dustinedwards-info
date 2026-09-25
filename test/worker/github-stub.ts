import { vi } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";

/* Stubbed at the outbound fetch, not the module, because `github.server.ts` is the subject.
 * An unknown host or path THROWS, so nothing can fall through to the live repository. Blob
 * shas are REAL `gitBlobSha`s, or the provenance check in `renderAndWrite` could not fail. A
 * tree applies only when the ref moves, so a refused save leaves the repository unchanged. */

export type RecordedCall = {
  method: string;
  path: string;
  body: unknown;
};

export type GitHubStub = {
  calls: RecordedCall[];
  files: Map<string, string>;
  /** Fail the next `times` requests whose path contains `fragment`, with a 500. */
  failNext: (fragment: string, times: number) => void;
  restore: () => void;
};

const API = "https://api.github.com";
const REPO_PREFIX = "/repos/DrDustinEdwards/dustinedwards-info";

const STUB_HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export function stubGitHub(seed: Record<string, string> = {}): GitHubStub {
  const files = new Map(Object.entries(seed));
  const calls: RecordedCall[] = [];
  const head = { commitSha: STUB_HEAD_SHA, treeSha: "tree-initial" };
  const failures = new Map<string, number>();
  const blobBodies = new Map<string, string>();
  let pendingTree: Array<{ path: string; content: string | null }> = [];
  let commitCounter = 0;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  /** Each recorded endpoint: `path` is matched exactly, or as a prefix when `prefix` is set. */
  const routes: Array<{
    method: string;
    path: string;
    prefix?: boolean;
    handle: (path: string, body: unknown) => Response | Promise<Response>;
  }> = [
    {
      method: "GET",
      path: `${REPO_PREFIX}/git/ref/heads/main`,
      handle: () => json({ object: { sha: head.commitSha } }),
    },
    {
      method: "GET",
      path: `${REPO_PREFIX}/git/commits/`,
      prefix: true,
      handle: () => json({ tree: { sha: head.treeSha } }),
    },
    { method: "GET", path: `${REPO_PREFIX}/contents/`, prefix: true, handle: getContents },
    { method: "POST", path: `${REPO_PREFIX}/git/blobs`, handle: postBlob },
    { method: "POST", path: `${REPO_PREFIX}/git/trees`, handle: postTree },
    {
      method: "POST",
      path: `${REPO_PREFIX}/git/commits`,
      handle: () => json({ sha: `commit${String(commitCounter).padStart(34, "0")}` }),
    },
    { method: "PATCH", path: `${REPO_PREFIX}/git/refs/heads/main`, handle: patchRef },
  ];

  async function getContents(path: string) {
    const target = decodeURI(path.slice(`${REPO_PREFIX}/contents/`.length).split("?")[0] ?? "");

    /* A directory answers with an ARRAY and a file with an OBJECT, and `listDirectory`
     * refuses anything that is not an array. */
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

  async function postBlob(_path: string, body: unknown) {
    const { content } = body as { content: string };
    const sha = await gitBlobSha(content);
    blobBodies.set(sha, content);
    return json({ sha });
  }

  function postTree(_path: string, body: unknown) {
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

  function patchRef(_path: string, body: unknown) {
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

    const route = routes.find(
      (r) => r.method === method && (r.prefix ? path.startsWith(r.path) : path === r.path),
    );
    if (route) return route.handle(path, body);

    throw new Error(
      `the GitHub stub has no recorded shape for ${method} ${path}. ` +
        `Record it rather than letting the call through.`,
    );
  };

  vi.stubGlobal("fetch", stub);

  return {
    calls,
    files,
    failNext: (fragment, times) => failures.set(fragment, times),
    restore: () => vi.unstubAllGlobals(),
  };
}
