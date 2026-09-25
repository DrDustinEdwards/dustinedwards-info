import { currentHead } from "~/lib/editor/publish.server";
import { errorMessage } from "~/lib/error-message.mjs";

type HeadEnv = Parameters<typeof currentHead>[0];

/**
 * For a loader that must render with no head. The error travels with the empty sha, so the editor
 * names what failed rather than guessing a missing token.
 */
export async function readHead(
  env: HeadEnv,
): Promise<{ headSha: string; headError: string | null }> {
  try {
    return { headSha: await currentHead(env), headError: null };
  } catch (error) {
    console.error("editor head read failed", error);
    return { headSha: "", headError: errorMessage(error) };
  }
}
