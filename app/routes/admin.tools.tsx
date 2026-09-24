import { Form, data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { auditSecrets } from "~/lib/admin/secrets.server";
import { getEnv } from "~/lib/context";
import { purgePosts } from "~/lib/cache-purge.server";
import { chooseEpisode, parsePodcastSlot } from "~/lib/podcast/feed.mjs";
import { readPodcastFeed, readPodcastSlot, writePodcastSlot } from "~/lib/podcast/podcast.server";
import { purgeZeroResults, topZeroResults } from "~/lib/search/zero-result.server";
/* The window comes from the client-safe module: the component below reads it, and importing it
   from the .server one would pull that module into the client bundle. */
import { ZERO_RESULT_RETENTION_SECONDS } from "~/lib/search/zero-result.mjs";
import type { Route } from "./+types/admin.tools";

const RETENTION_DAYS = ZERO_RESULT_RETENTION_SECONDS / 86400;

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  /* Presence only: a name and a boolean per secret, never a value. */
  // Spread rather than asserted: `Env` is an interface, so it has no implicit index signature.
  const secrets = auditSecrets({ ...env });
  const misses = await topZeroResults(env);
  /* The admin may wait on a cold feed cache so the picker has episodes; the home page never does. */
  const [feed, slot] = await Promise.all([
    timed(timings, "tools_podcast_feed", () => readPodcastFeed(context, { wait: true })),
    timed(timings, "tools_podcast_slot", () => readPodcastSlot(env)),
  ]);
  const episodes = (feed?.episodes ?? []).map(({ guid, title, publishedAt }) => ({
    guid,
    title,
    publishedAt,
  }));
  const chosen = chooseEpisode(feed?.episodes ?? [], slot);
  const podcast = {
    slot,
    episodes,
    showing: chosen.episode?.title ?? null,
    fellBack: chosen.fellBack,
    fetchedAt: feed?.fetchedAt ?? null,
  };
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ secrets, misses, podcast });
}

/**
 * A button, not a cron: this Worker has no cron, and the watchdog, which has one, holds no DB
 * binding and cannot reach this table.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "podcast-slot") {
    const env = getEnv(context);
    const guid = String(form.get("guid") ?? "");
    const slot = parsePodcastSlot(
      JSON.stringify(form.get("mode") === "featured" ? { mode: "featured", guid } : { mode: "latest" }),
    );
    const feed = await readPodcastFeed(context, { wait: true });
    if (slot.mode === "featured" && !feed?.episodes.some((e) => e.guid === slot.guid)) {
      return data({ purged: null }, { status: 400 });
    }
    await writePodcastSlot(env, slot);
    // The home page is tagged with the corpus tag, so this purge reaches it.
    await purgePosts("home podcast slot");
    return data({ purged: null });
  }
  if (form.get("intent") !== "purge-zero-results") {
    return data({ purged: null }, { status: 400 });
  }
  const purged = await purgeZeroResults(getEnv(context));
  return data({ purged });
}


export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const { secrets, misses, podcast } = loaderData;
  const missing = secrets.filter((s) => !s.present);
  return (
    <Panel
      title="Tools"
      description="Which of the ratified secrets this deployment holds. Names and a word, never a value."
    >
      <h3 className="tool-audit-heading">
        Secrets{" "}
        <span className="chip">
          {missing.length === 0
            ? `all ${secrets.length} set`
            : `${missing.length} of ${secrets.length} missing`}
        </span>
      </h3>
      <ul className="tool-list">
        {secrets.map((secret) => (
          <li key={secret.name} className="tool-row">
            <p className="tool-row-label">{secret.name}</p>
            <span className={secret.present ? "chip" : "chip chip-error"}>
              {secret.present ? "set" : "NOT SET"}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="tool-heading">
        Searches that found nothing
        <span className="chip">{misses.length === 0 ? "none" : `${misses.length} shown`}</span>
      </h3>
      {misses.length === 0 ? (
        <p className="muted">Nothing recorded yet, which is the good case.</p>
      ) : (
        <ul className="tool-list">
          {misses.map((miss) => (
            <li key={miss.query} className="tool-row">
              <p className="tool-row-label">{miss.query}</p>
              <span className="chip">
                {miss.count} time{miss.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Form method="post">
        <input type="hidden" name="intent" value="purge-zero-results" />
        <p className="muted">
          {`Queries nobody has repeated in ${RETENTION_DAYS} days are removed by this button. ` +
            `There is no cron: this Worker has none, and the watchdog that does cannot reach ` +
            `the database.`}
        </p>
        <button type="submit" className="btn-secondary" disabled={misses.length === 0}>
          Remove expired queries
        </button>
      </Form>

      {/* A featured episode that has left the feed is not an error on home, which plays the latest. */}
      <h3 className="tool-audit-heading" id="home-podcast">
        Home podcast
        <span className={podcast.fellBack ? "chip chip-error" : "chip"}>
          {podcast.fellBack ? "featured episode gone" : podcast.slot.mode}
        </span>
      </h3>
      <p className="muted" data-podcast-showing>
        {podcast.showing === null
          ? "The feed has not been read yet, so the home page links to germomics.com instead."
          : podcast.fellBack
            ? `The featured episode is no longer in the feed, so the home page is playing the latest: ${podcast.showing}.`
            : `The home page is playing: ${podcast.showing}.`}
      </p>
      <Form method="post" aria-labelledby="home-podcast">
        <input type="hidden" name="intent" value="podcast-slot" />
        <ul className="tool-list">
          <li className="tool-row">
            <label className="tool-row-label">
              <input
                type="radio"
                name="mode"
                value="latest"
                defaultChecked={podcast.slot.mode === "latest"}
              />
              Latest episode
            </label>
          </li>
          <li className="tool-row">
            <label className="tool-row-label">
              <input
                type="radio"
                name="mode"
                value="featured"
                defaultChecked={podcast.slot.mode === "featured"}
                disabled={podcast.episodes.length === 0}
              />
              Featured episode
            </label>
            <label className="sr-only" htmlFor="podcast-guid">
              Featured episode
            </label>
            <select
              id="podcast-guid"
              name="guid"
              className="tool-select"
              defaultValue={podcast.slot.mode === "featured" ? podcast.slot.guid : undefined}
              disabled={podcast.episodes.length === 0}
            >
              {podcast.episodes.map((episode) => (
                <option key={episode.guid} value={episode.guid}>
                  {episode.title} ({episode.publishedAt.slice(0, 10)})
                </option>
              ))}
            </select>
          </li>
        </ul>
        <button type="submit" className="btn-secondary">
          Save the home podcast
        </button>
      </Form>
    </Panel>
  );
}
