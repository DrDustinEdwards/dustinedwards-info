/**
 * The Germomics podcast feed, parsed, and the choice of which episode the home page plays.
 *
 * Pure: no fetch, no KV, so node:test and the CSP builder can import it. The fetch and the cache
 * are `podcast.server.ts`.
 *
 * THE FEED IS SOMEONE ELSE'S SERVER'S OUTPUT, rendered into a page this site vouches for. So every
 * URL is checked against a host allowlist here, and an episode whose audio or page link fails is
 * dropped rather than rendered. The audio allowlist is the same array `workers/csp.mjs` writes into
 * `media-src`, so the parser cannot accept a host the policy would then refuse to play.
 */

/** The feed Dustin named (job_83c1543adcfe). */
export const PODCAST_FEED_URL = "https://germomics.com/feed/podcast/";

/** The show's own site, linked beside every episode. */
export const PODCAST_SITE_URL = "https://germomics.com/";

/**
 * Where episode audio may come from. `op3.dev` is the feed's analytics prefix, which answers
 * with a 302 to `media.germomics.com`, and CSP checks the redirect target too, so both are here.
 */
export const PODCAST_AUDIO_HOSTS = ["op3.dev", "media.germomics.com"];

/** Where an episode page may live. */
const EPISODE_PAGE_HOSTS = ["germomics.com", "www.germomics.com"];

/** The settings row that holds the home slot. */
export const PODCAST_SLOT_KEY = "home.podcast";

/**
 * @typedef {{
 *   guid: string,
 *   title: string,
 *   link: string,
 *   publishedAt: string,
 *   durationSeconds: number | null,
 *   description: string,
 *   audioUrl: string,
 *   audioType: string,
 *   season: number | null,
 *   episode: number | null,
 * }} PodcastEpisode
 *
 * @typedef {{ mode: "latest" } | { mode: "featured", guid: string }} PodcastSlot
 */

const NAMED_ENTITIES = /** @type {Record<string, string>} */ ({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
});

/** @param {string} text */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * An element's text: CDATA unwrapped, tags stripped, entities decoded, whitespace collapsed.
 * @param {string} xml @param {string} tag
 */
function textOf(xml, tag) {
  const escaped = tag.replace(":", "\\:");
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`));
  if (!match) return "";
  const raw = (match[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeEntities(raw.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** @param {string} xml @param {string} tag @param {string} attr */
function attrOf(xml, tag, attr) {
  const element = xml.match(new RegExp(`<${tag.replace(":", "\\:")}\\s[^>]*>`));
  if (!element) return "";
  const value = element[0].match(new RegExp(`\\s${attr}="([^"]*)"`));
  return value ? decodeEntities(value[1] ?? "") : "";
}

/**
 * An https URL on one of `hosts`, or null. Nothing else is rendered.
 * @param {string} value @param {readonly string[]} hosts
 */
export function allowedHttpsUrl(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return hosts.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * `hh:mm:ss`, `mm:ss` or plain seconds, as the itunes namespace allows.
 * @param {string} value
 */
export function parseDuration(value) {
  if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return null;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/** @param {string} value */
function positiveInt(value) {
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
}

/**
 * Every episode the feed carries that passes the URL checks, newest first.
 * @param {string} xml
 * @returns {PodcastEpisode[]}
 */
export function parsePodcastFeed(xml) {
  /** @type {PodcastEpisode[]} */
  const episodes = [];
  for (const [, item = ""] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = textOf(item, "title");
    const guid = textOf(item, "guid");
    const link = allowedHttpsUrl(textOf(item, "link"), EPISODE_PAGE_HOSTS);
    const audioUrl = allowedHttpsUrl(attrOf(item, "enclosure", "url"), PODCAST_AUDIO_HOSTS);
    const audioType = attrOf(item, "enclosure", "type");
    const published = new Date(textOf(item, "pubDate"));
    if (!title || !guid || !link || !audioUrl || !audioType.startsWith("audio/")) continue;
    if (Number.isNaN(published.getTime())) continue;
    episodes.push({
      guid,
      title,
      link,
      publishedAt: published.toISOString(),
      durationSeconds: parseDuration(textOf(item, "itunes:duration")),
      description: textOf(item, "description"),
      audioUrl,
      audioType,
      season: positiveInt(textOf(item, "itunes:season")),
      episode: positiveInt(textOf(item, "itunes:episode")),
    });
  }
  return episodes.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * The stored slot, or `latest` for anything absent or malformed: latest is the default Dustin set.
 * @param {string | null} value
 * @returns {PodcastSlot}
 */
export function parsePodcastSlot(value) {
  try {
    const parsed = value ? JSON.parse(value) : null;
    if (parsed?.mode === "featured" && typeof parsed.guid === "string" && parsed.guid) {
      return { mode: "featured", guid: parsed.guid };
    }
  } catch {
    // Malformed reads as the default.
  }
  return { mode: "latest" };
}

/**
 * The episode the home page plays. A featured episode that has left the feed falls back to the
 * latest, and `fellBack` says so, which is what the admin shows.
 * @param {PodcastEpisode[]} episodes @param {PodcastSlot} slot
 * @returns {{ episode: PodcastEpisode | null, fellBack: boolean }}
 */
export function chooseEpisode(episodes, slot) {
  const latest = episodes[0] ?? null;
  if (slot.mode !== "featured") return { episode: latest, fellBack: false };
  const featured = episodes.find((e) => e.guid === slot.guid);
  return featured ? { episode: featured, fellBack: false } : { episode: latest, fellBack: true };
}

/**
 * `21:17` or `1:04:09`, for the total beside the scrubber.
 * @param {number} seconds
 */
export function clockTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}
