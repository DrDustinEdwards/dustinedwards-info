// Pure, so node:test and the CSP builder can import it. Every feed URL is checked against a host
// allowlist; the audio list is what workers/csp.mjs writes into `media-src`, so the two cannot disagree.

import { decodeEntities } from "../publications/entities.mjs";

export const PODCAST_FEED_URL = "https://germomics.com/feed/podcast/";

export const PODCAST_SITE_URL = "https://germomics.com/";

// `op3.dev` is the feed's analytics prefix and 302s to `media.germomics.com`; CSP checks the redirect
// target too, so both are listed.
export const PODCAST_AUDIO_HOSTS = ["op3.dev", "media.germomics.com"];

const EPISODE_PAGE_HOSTS = ["germomics.com", "www.germomics.com"];

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
 */

/**
 * The shared decoder, plus `&nbsp;`: podcast hosts write it in show notes, and every whitespace run
 * here collapses to one space anyway. Replaced before decoding, so `&amp;nbsp;` still reads literally.
 *
 * @param {string} text
 */
function decodeFeedEntities(text) {
  return decodeEntities(text.replace(/&nbsp;/g, " "));
}

/**
 * @param {string} xml @param {string} tag
 */
function textOf(xml, tag) {
  const escaped = tag.replace(":", "\\:");
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`));
  if (!match) return "";
  const raw = (match[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeFeedEntities(raw.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** @param {string} xml @param {string} tag @param {string} attr */
function attrOf(xml, tag, attr) {
  const element = xml.match(new RegExp(`<${tag.replace(":", "\\:")}\\s[^>]*>`));
  if (!element) return "";
  const value = element[0].match(new RegExp(`\\s${attr}="([^"]*)"`));
  return value ? decodeFeedEntities(value[1] ?? "") : "";
}

/**
 * @param {string} value @param {readonly string[]} hosts
 */
function allowedHttpsUrl(value, hosts) {
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
