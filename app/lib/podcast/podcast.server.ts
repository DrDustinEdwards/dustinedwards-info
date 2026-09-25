import type { RouterContextProvider } from "react-router";

import { getSetting, setSetting } from "~/db";
import { getEnv, getExecutionContext } from "~/lib/context";
import {
  PODCAST_FEED_URL,
  PODCAST_SLOT_KEY,
  chooseEpisode,
  parsePodcastFeed,
  parsePodcastSlot,
  type PodcastEpisode,
  type PodcastSlot,
} from "~/lib/podcast/feed.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

// The page never waits on the podcast host: loaders read KV only and refresh in `waitUntil` (this Worker
// has no cron). A failed refresh keeps the episodes and stamps `checkedAt`, so a down host is asked once
// per interval, not on every render.

const CACHE_KEY = "podcast:germomics:v1";
const REFRESH_AFTER_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "dustinedwards.info (+https://dustinedwards.info)";

/**
 * `lastError` says why the last refresh failed; absent after one that landed. With no episodes ever
 * read, a failed refresh still answers (episodes empty, `fetchedAt` null, `lastError` set), so a
 * reader can tell "the read failed" from "not read yet", which is the only thing null means.
 */
export type CachedFeed = {
  episodes: PodcastEpisode[];
  fetchedAt: string | null;
  checkedAt: string;
  lastError?: string;
};

// A failed refresh never takes the page down, but it is logged under one alert key and kept on the
// cached feed as `lastError`, so a host that has been down for a week is not read as a quiet podcast.
function logFailure(stage: string, detail: unknown) {
  console.error(
    JSON.stringify({
      alert: "podcast-refresh-failed",
      stage,
      detail: errorMessage(detail),
    }),
  );
}

async function readCache(kv: KVNamespace): Promise<CachedFeed | null> {
  try {
    return await kv.get<CachedFeed>(CACHE_KEY, "json");
  } catch (error) {
    // A KV hiccup must never take the page down.
    logFailure("kv-read", error);
    return null;
  }
}

async function fetchEpisodes(): Promise<{ episodes: PodcastEpisode[] } | { error: string }> {
  try {
    const res = await fetch(PODCAST_FEED_URL, {
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { error: `the feed answered HTTP ${res.status}` };
    const episodes = parsePodcastFeed(await res.text());
    return episodes.length > 0 ? { episodes } : { error: "the feed parsed to no episodes" };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

async function refresh(kv: KVNamespace, cached: CachedFeed | null): Promise<CachedFeed> {
  const now = new Date().toISOString();
  const fetched = await fetchEpisodes();
  let next: CachedFeed;
  if ("episodes" in fetched) {
    next = { episodes: fetched.episodes, fetchedAt: now, checkedAt: now };
  } else {
    logFailure("fetch", fetched.error);
    // Not stored when nothing was ever read: a cached empty feed would hold off the retry for the
    // whole refresh interval, where today every render retries a cold cache.
    if (!cached) return { episodes: [], fetchedAt: null, checkedAt: now, lastError: fetched.error };
    next = { ...cached, checkedAt: now, lastError: fetched.error };
  }
  try {
    await kv.put(CACHE_KEY, JSON.stringify(next));
  } catch (error) {
    // The next render tries again.
    logFailure("kv-write", error);
  }
  return next;
}

const isStale = (cached: CachedFeed) =>
  Date.now() - Date.parse(cached.checkedAt) > REFRESH_AFTER_MS;

// `wait` is for the admin's cold cache only; a public render never blocks on the host. With `wait` the
// answer is never null, because a refresh always answers.
export async function readPodcastFeed(
  context: Readonly<RouterContextProvider>,
  { wait = false }: { wait?: boolean } = {},
): Promise<CachedFeed | null> {
  const env = getEnv(context);
  const ctx = getExecutionContext(context);
  const kv = env.APP_KV;
  const cached = await readCache(kv);
  if (cached && !isStale(cached)) return cached;
  if (wait) return refresh(kv, cached);
  ctx.waitUntil(refresh(kv, cached));
  return cached;
}

export async function readPodcastSlot(env: Env): Promise<PodcastSlot> {
  return parsePodcastSlot(await getSetting(env, PODCAST_SLOT_KEY));
}

export async function writePodcastSlot(env: Env, slot: PodcastSlot): Promise<void> {
  await setSetting(env, PODCAST_SLOT_KEY, JSON.stringify(slot));
}

export async function homePodcastEpisode(
  context: Readonly<RouterContextProvider>,
): Promise<PodcastEpisode | null> {
  const env = getEnv(context);
  const [feed, slot] = await Promise.all([readPodcastFeed(context), readPodcastSlot(env)]);
  return chooseEpisode(feed?.episodes ?? [], slot).episode;
}
