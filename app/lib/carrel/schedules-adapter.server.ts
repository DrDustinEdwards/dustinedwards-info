// Scheduled updates (site-api v0.10.0, the `schedules` group): a live post carries one waiting update in the
// scheduled_updates table (drizzle/0033), and the per-minute cron (workers/app.ts scheduled(), site-api's
// runSchedules) puts it live at its time. Posts only: every other kind refuses, as it did before the group existed.
//
// A post that was never live goes live by its publish_at, with no write. So the publish hooks (IndexNow, the cache
// purge, webmentions) still hear it, the schedule leaves a row in scheduled_publishes (drizzle/0038), which `due` lists
// as kind "publish" once its time comes, and `apply` answers the post's write without writing and drops it (v0.17.0).
//
// One departure from the package's contract, recorded here: a post's version is the git blob sha of its file
// (site-adapter.server.ts), so storing or dropping an update does not move it. A write to the post itself still
// moves it, and apply checks the stored update's time and change id before it writes, so a reschedule or a cancel
// made in between is never overwritten.

import { NotFoundError, RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { SchedulesAdapter, WriteResult } from "@dustinedwards/site-api";
import { d1ScheduledUpdates, utc } from "@dustinedwards/site-api/schedules";

import { DEFAULT_KIND, decodeContentId } from "~/lib/carrel/content-id.mjs";
import { effectivePublishAt, frontKey, statusOf, withPublication } from "~/lib/carrel/front-matter-lines";
import {
  dropScheduledPublish,
  dueScheduledPublishes,
  scheduledPublishOf,
} from "~/lib/carrel/post-state.server";
import { postPath } from "~/lib/content/slug.mjs";
import { readFile } from "~/lib/source/store.server";

type Write = (id: string, changeId: string, raw: string, expectedVersion: string | null) => Promise<WriteResult>;

/** Two times are the same schedule to the second: a seeded row (drizzle/0038) was read off a whole-second column. */
const sameSecond = (a: number, b: number) => Math.floor(a / 1000) === Math.floor(b / 1000);

export function postSchedules(env: Env, write: Write): SchedulesAdapter {
  const stored = d1ScheduledUpdates(env.DB);

  /** The post's file, refusing an id that is not a post. */
  async function postFile(id: string) {
    // The registry's own words for a kind with no schedule (content-kinds.server.ts).
    const { kind } = decodeContentId(id);
    if (kind !== DEFAULT_KIND) throw new RefusedError(`A ${kind} cannot be scheduled; publish it now.`);
    return readFile(env, postPath(id));
  }

  /** The first publish the cron announces: still scheduled for exactly that time, and the time has come. */
  async function applyPublish(id: string, input: { publishAt: string; changeId: string; now: Date }) {
    const marker = await scheduledPublishOf(env, id);
    if (!marker || marker.publish_at !== utc(input.publishAt) || marker.change_id !== input.changeId) return null;
    await dropScheduledPublish(env, id).run();
    const file = await readFile(env, postPath(id));
    if (!file || statusOf(file.content, input.now.getTime()) !== "published") return null;
    if (!sameSecond(effectivePublishAt(file.content), Date.parse(input.publishAt))) return null;
    return { id, version: file.sha, status: "published", changeId: input.changeId } satisfies WriteResult;
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
        const result = await write(id, input.changeId, withPublication(file.content, { draft: true }), input.expectedVersion);
        await dropScheduledPublish(env, id).run();
        return result;
      }
      throw new RefusedError("Nothing is scheduled for this post.");
    },

    async due({ now, limit }) {
      const due = [...(await stored.due(now, limit)), ...(await dueScheduledPublishes(env, now, limit))];
      return due.sort((a, b) => a.publishAt.localeCompare(b.publishAt) || a.id.localeCompare(b.id)).slice(0, limit);
    },

    async apply(id, input) {
      if (input.kind === "publish") return applyPublish(id, input);
      const update = await stored.get(id);
      if (!update || update.publishAt !== input.publishAt || update.changeId !== input.changeId) return null;
      if (Date.parse(update.publishAt) > input.now.getTime()) return null;
      const file = await readFile(env, postPath(id));
      if (!file || statusOf(file.content, input.now.getTime()) !== "published") return null;
      // The update's source goes live under the live post's own publication fields, so it stays published at its date.
      const raw = withPublication(update.source, {
        draft: false,
        publishAt: frontKey(file.content, "publish_at").trim() || null,
      });
      const result = await write(id, update.changeId, raw, file.sha);
      await stored.remove(id, { publishAt: update.publishAt, changeId: update.changeId }).run();
      return result;
    },
  };
}
