// The operator's media delete: removes library pictures through site-api's own library delete (the one Carrel and the
// admin run), so a picture a post, a page or repository code still uses is refused and named, only an upload's
// content-addressed key is deletable (isManagedKey), and the file's last bytes go to MEDIA_REVISIONS, where Carrel can
// revert them. Nothing here touches a bucket or a row itself.
import { MediaInUseError, NotFoundError, RefusedError, describeUses } from "@dustinedwards/site-api";

import { carrelMediaAdapter } from "~/lib/carrel/media-adapter.server";
import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";

const MAX_DELETE_KEYS = 25;

export async function deleteMediaTool(env: OperatorEnv, args: Record<string, unknown>): Promise<ToolResult> {
  const asked = args.keys;
  if (!Array.isArray(asked) || asked.length === 0 || asked.some((k) => typeof k !== "string" || k === "")) {
    return { ok: false, status: 400, error: `delete_media takes \`keys\`: a list of 1 to ${MAX_DELETE_KEYS} library keys.` };
  }
  const keys = [...new Set(asked as string[])];
  if (keys.length > MAX_DELETE_KEYS) return { ok: false, status: 400, error: `delete_media takes at most ${MAX_DELETE_KEYS} keys a call.` };

  const deleted: string[] = [];
  const refused: Array<{ key: string; reason: string }> = [];
  const missing: string[] = [];
  const media = carrelMediaAdapter(env);
  const batch = crypto.randomUUID();
  for (const [n, key] of keys.entries()) {
    try {
      await media.delete(key, { changeId: `operator-delete-${batch}-${n}` });
      deleted.push(key);
    } catch (error) {
      if (error instanceof NotFoundError) missing.push(key);
      else if (error instanceof MediaInUseError) refused.push({ key, reason: `in use: ${describeUses(error.usedBy)}` });
      else if (error instanceof RefusedError) refused.push({ key, reason: error.message });
      else throw error;
    }
  }
  return { ok: true, data: { deleted, refused, missing } };
}
