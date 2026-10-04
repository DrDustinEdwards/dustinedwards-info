// The site's refusals, in the package's terms, for every kind handler.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";

import { readFile } from "~/lib/editor/github.server";
import { EditorError, GitHubError, PolicyError } from "~/lib/editor/publish.server";

/** A file the site's own validator refused, with every message so the writer can fix all of them at once. */
export class ContentInvalid extends Error {
  errors: string[];
  constructor(message: string, errors: string[]) {
    super(message);
    this.name = "ContentInvalid";
    this.errors = errors;
  }
}

/**
 * The site's refusals, in the package's terms. Anything else is a failure and stays one. `path` is the item's
 * file: a version conflict answers that file's current blob sha, which is the version the next save must carry.
 */
export async function asSiteApiError(env: Env & { GITHUB_TOKEN?: string }, error: unknown, path: string): Promise<never> {
  if (error instanceof GitHubError && error.conflict) {
    throw new VersionConflictError((await readFile(env, path))?.sha ?? null);
  }
  if (error instanceof EditorError || error instanceof PolicyError) {
    throw new RefusedError(error.message);
  }
  if (error instanceof ContentInvalid) {
    const lines = error.errors.map((message) => `- ${message}`);
    throw new RefusedError([error.message, ...lines].join("\n"));
  }
  throw error;
}
