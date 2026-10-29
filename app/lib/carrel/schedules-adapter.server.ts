// Scheduled updates (site-api v0.10.0, the `schedules` group): a live post carries one waiting update in the
// scheduled_updates table (drizzle/0033), and the cron (workers/app.ts scheduled()) puts it live at its time.
// Posts only: every other kind refuses, as it did before the group existed. A post that was never live needs no
// row: its publish_at already makes it go live by time, with no write.
//
// One departure from the package's contract, recorded here: a post's version is the git blob sha of its file
// (site-adapter.server.ts), so storing or dropping an update does not move it. A write to the post itself still
// moves it, and apply checks the stored update's time and change id before it writes, so a reschedule or a cancel
// made in between is never overwritten.

import { NotFoundError, RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { SchedulesAdapter, WriteResult } from "@dustinedwards/site-api";
import { d1ScheduledUpdates, utc } from "@dustinedwards/site-api/schedules";

import { DEFAULT_KIND, decodeContentId } from "~/lib/carrel/content-id.mjs";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { postPath } from "~/lib/content/slug.mjs";
import { parsePost } from "~/lib/editor/frontmatter";
import { readFile } from "~/lib/source/store.server";

type Write = (id: string, changeId: string, raw: string, expectedVersion: string | null) => Promise<WriteResult>;
type Status = (raw: string, now?: number) => WriteResult["status"];


export function postSchedules(env: Env, write: Write, statusOf: Status): SchedulesAdapter {
  const stored = d1ScheduledUpdates(env.DB);

  /** The post's file, refusing an id that is not a post. */
  async function postFile(id: string) {
    // The registry's own words for a kind with no schedule (content-kinds.server.ts).
    const { kind } = decodeContentId(id);
    if (kind !== DEFAULT_KIND) throw new RefusedError(`A ${kind} cannot be scheduled; publish it now.`);
    return readFile(env, postPath(id));
  }

  return {
    async get(id) {
      if (decodeContentId(id).kind !== DEFAULT_KIND) return null;
      return stored.get(id);
    },

    async update(id, input) {
      const file = await postFile(id);
      if (!file) throw new NotFoundError(`No post "${id}" exists.`);
      if (file.sha !== input.expectedVersion) throw new VersionConflictError(file.sha);
      if (statusOf(file.content) !== "published") {
        throw new RefusedError("Only a live post can carry a scheduled update; schedule the post itself instead.");
      }
      const at = Date.parse(input.publishAt);
      if (!(at > Date.now())) throw new RefusedError("publishAt is not in the future; publish the change now instead.");
      const publishAt = utc(new Date(at));
      await stored.put(id, { source: input.source, publishAt, changeId: input.changeId }).run();
      return {
        id,
        version: file.sha,
        status: "published",
        changeId: input.changeId,
        scheduledUpdate: { publishAt, changeId: input.changeId },
      };
    },

    async cancel(id, input) {
      const file = await postFile(id);
      if (!file) throw new NotFoundError(`No post "${id}" exists.`);
      if (file.sha !== input.expectedVersion) throw new VersionConflictError(file.sha);
      if (await stored.get(id)) {
        await stored.remove(id).run();
        return { id, version: file.sha, status: statusOf(file.content), changeId: input.changeId };
      }
      // A scheduled post that was never live goes back to draft, as the contract says.
      if (statusOf(file.content) === "scheduled") {
        return write(id, input.changeId, withPublication(file.content, { draft: true }), input.expectedVersion);
      }
      throw new RefusedError("Nothing is scheduled for this post.");
    },

    due({ now, limit }) {
      return stored.due(now, limit);
    },

    async apply(id, input) {
      if (input.kind !== "update") return null;
      const update = await stored.get(id);
      if (!update || update.publishAt !== input.publishAt || update.changeId !== input.changeId) return null;
      if (Date.parse(update.publishAt) > input.now.getTime()) return null;
      const file = await readFile(env, postPath(id));
      if (!file || statusOf(file.content, input.now.getTime()) !== "published") return null;
      // The update's source goes live under the live post's own publication fields, so it stays published at its date.
      const raw = withPublication(update.source, {
        draft: false,
        publishAt: parsePost(file.content).publishAt.trim() || null,
      });
      const result = await write(id, update.changeId, raw, file.sha);
      await stored.remove(id, { publishAt: update.publishAt, changeId: update.changeId }).run();
      return result;
    },
  };
}
