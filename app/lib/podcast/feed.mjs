// Pure, so node:test and the CSP builder can import it. Every feed URL is checked against a host
// allowlist; the audio list is what workers/csp.mjs writes into `media-src`, so the two cannot disagree.

export const PODCAST_FEED_URL = "https://germomics.com/feed/podcast/";

export const PODCAST_SITE_URL = "https://germomics.com/";

// `op3.dev` is the feed's analytics prefix and 302s to `media.germomics.com`; CSP checks the redirect
// target too, so both are listed.
export const PODCAST_AUDIO_HOSTS = ["op3.dev", "media.germomics.com"];

const EPISODE_PAGE_HOSTS = ["germomics.com", "www.germomics.com"];

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
 * @param {string | null} value
 * @returns {PodcastSlot}
 */
export function parsePodcastSlot(value) {
  if (!value) return { mode: "latest" };
  try {
    const parsed = JSON.parse(value);
    if (parsed?.mode === "featured" && typeof parsed.guid === "string" && parsed.guid) {
      return { mode: "featured", guid: parsed.guid };
    }
    if (parsed?.mode === "latest") return { mode: "latest" };
  } catch {
    // Falls through to the logged default below.
  }
  // Malformed reads as the default so the home page renders, but it is logged: a featured episode the
  // owner chose has silently become "latest".
  console.error(JSON.stringify({ alert: "podcast-slot-unreadable", value }));
  return { mode: "latest" };
}

/**
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
 * @param {number} seconds
 */
export function clockTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}
