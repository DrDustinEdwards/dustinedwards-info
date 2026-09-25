import test from "node:test";
import assert from "node:assert/strict";

import {
  PODCAST_AUDIO_HOSTS,
  chooseEpisode,
  clockTime,
  parseDuration,
  parsePodcastFeed,
  parsePodcastSlot,
} from "../app/lib/podcast/feed.mjs";
import { contentSecurityPolicy } from "../workers/csp.mjs";

/** @param {Record<string, string>} over */
function item(over = {}) {
  const f = {
    title: "Antitoxin Togo, Please",
    link: "https://germomics.com/antitoxin-togo-please",
    guid: "https://germomics.com/?p=563",
    pubDate: "Tue, 19 Nov 2019 09:00:30 GMT",
    description: "<![CDATA[What do blue jeans have to do with diphtheria &amp; the <b>1925</b> Serum Run?]]>",
    audio: "https://op3.dev/e/media.germomics.com/Podcast_010_Antitoxin_Togo_Please.mp3",
    type: "audio/mpeg",
    duration: "00:21:17",
    ...over,
  };
  return `<item>
    <title>${f.title}</title>
    <link>${f.link}</link>
    <guid isPermaLink="false">${f.guid}</guid>
    <pubDate>${f.pubDate}</pubDate>
    <description>${f.description}</description>
    <enclosure url="${f.audio}" length="20724967" type="${f.type}"/>
    <itunes:duration>${f.duration}</itunes:duration>
    <itunes:episode>10</itunes:episode>
    <itunes:season>1</itunes:season>
  </item>`;
}

const feed = (/** @type {string[]} */ ...items) => `<rss><channel><title>Germomics</title>${items.join("")}</channel></rss>`;

test("an episode in the live feed's shape parses whole", () => {
  const [ep] = parsePodcastFeed(feed(item()));
  assert.deepEqual(ep, {
    guid: "https://germomics.com/?p=563",
    title: "Antitoxin Togo, Please",
    link: "https://germomics.com/antitoxin-togo-please",
    publishedAt: "2019-11-19T09:00:30.000Z",
    durationSeconds: 1277,
    description: "What do blue jeans have to do with diphtheria & the 1925 Serum Run?",
    audioUrl: "https://op3.dev/e/media.germomics.com/Podcast_010_Antitoxin_Togo_Please.mp3",
    audioType: "audio/mpeg",
    season: 1,
    episode: 10,
  });
});

test("entities in a title decode, and the channel title is not an episode", () => {
  const eps = parsePodcastFeed(feed(item({ title: "There&#8217;s Something About Typhoid Mary" })));
  assert.equal(eps.length, 1);
  assert.equal(eps[0].title, "There’s Something About Typhoid Mary");
});

test("AN EPISODE OFF THE ALLOWLIST IS DROPPED, never rendered", () => {
  const refused = [
    { audio: "http://media.germomics.com/a.mp3" },
    { audio: "https://evil.example/a.mp3" },
    { audio: "javascript:alert(1)" },
    { audio: "https://media.germomics.com.evil.example/a.mp3" },
    { audio: "https://user@media.germomics.com/a.mp3" },
    { link: "javascript:alert(1)" },
    { link: "https://evil.example/germomics" },
    { type: "text/html" },
    { pubDate: "not a date" },
  ];
  for (const over of refused) {
    assert.equal(parsePodcastFeed(feed(item(over))).length, 0, JSON.stringify(over));
  }
});

test("episodes come back newest first whatever the feed's order", () => {
  const eps = parsePodcastFeed(
    feed(
      item({ guid: "old", pubDate: "Tue, 03 Sep 2019 09:00:50 GMT" }),
      item({ guid: "new", pubDate: "Tue, 19 Nov 2019 09:00:30 GMT" }),
    ),
  );
  assert.deepEqual(eps.map((e) => e.guid), ["new", "old"]);
});

test("durations in all three itunes forms, and garbage is null", () => {
  assert.equal(parseDuration("00:21:17"), 1277);
  assert.equal(parseDuration("21:17"), 1277);
  assert.equal(parseDuration("1277"), 1277);
  assert.equal(parseDuration("twenty minutes"), null);
  assert.equal(clockTime(1277), "21:17");
  assert.equal(clockTime(3849), "1:04:09");
});

test("an unreadable or incomplete slot setting defaults to latest", () => {
  for (const bad of [null, "", "{", '{"mode":"featured"}', '{"mode":"other"}']) {
    assert.deepEqual(parsePodcastSlot(bad), { mode: "latest" }, String(bad));
  }
});

test("the chosen episode is the latest or the featured one, and a featured episode that left the feed falls back", () => {
  const eps = parsePodcastFeed(
    feed(item({ guid: "b", pubDate: "Tue, 19 Nov 2019 09:00:30 GMT" }), item({ guid: "a", pubDate: "Tue, 03 Sep 2019 09:00:50 GMT" })),
  );
  assert.deepEqual(chooseEpisode(eps, { mode: "latest" }), { episode: eps[0], fellBack: false });
  assert.deepEqual(chooseEpisode(eps, parsePodcastSlot('{"mode":"featured","guid":"a"}')), {
    episode: eps[1],
    fellBack: false,
  });
  assert.deepEqual(chooseEpisode(eps, { mode: "featured", guid: "gone" }), { episode: eps[0], fellBack: true });
  assert.deepEqual(chooseEpisode([], { mode: "latest" }), { episode: null, fellBack: false });
});

test("the CSP's media-src allows exactly the hosts the parser accepts", () => {
  for (const styleNonce of [false, true]) {
    const media = contentSecurityPolicy("n", styleNonce)
      .split("; ")
      .find((d) => d.startsWith("media-src "));
    assert.ok(media, "no media-src directive");
    assert.deepEqual(
      media.split(" ").slice(1).sort(),
      ["'self'", ...PODCAST_AUDIO_HOSTS.map((h) => `https://${h}`)].sort(),
    );
  }
});
