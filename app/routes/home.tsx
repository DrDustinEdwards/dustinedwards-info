import { Link } from "react-router";

import stack from "../../content/generated/stack.json";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { listHomeStartHere } from "~/db";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { getEnv } from "~/lib/context";
import { formatAge } from "~/lib/health/snapshot.mjs";
import { readHealthTile } from "~/lib/health/snapshot.server";
import { longDateUTC } from "~/lib/long-date.mjs";
import { timed, timingsContext } from "~/lib/timing";
import {
  cacheTags,
  publicHtmlHeaders,
  personJsonLd,
  SITE,
  SITE_ORIGIN,
  webSiteJsonLd,
  pageMeta,
} from "~/lib/seo";
import type { Route } from "./+types/home";

import "~/styles/blog-index.css";

/**
 * Publicly cacheable for COOKIELESS readers only.
 *
 * This route had no `headers` export and reached `private, no-store` through the
 * hard rule 8 default. That default STAYS and still covers everything unlisted;
 * this route now opts in, and `workers/app.ts` downgrades it right back whenever
 * every reader since 2026-09-05: the theme is a dimension of the cache key
 * rather than a Vary. Tagged `posts`, because the proof tiles and the featured
 * list read the corpus. Grounds on cacheTags in seo.ts.
 */
export function headers() {
  return publicHtmlHeaders(cacheTags());
}

export function meta() {
  /* The URL people paste, and it carried no canonical and no OG text at all.
     See pageMeta for what a partial set costs at cutover. */
  return pageMeta({ title: SITE.name, description: SITE.description, path: "/" });
}

/**
 * THE FRONT DOOR: who, what, and why believe it. Ruled 2026-08-25.
 *
 * What stood here was a centred name and a one-line role in a full-viewport
 * hero, and nothing else: a reader who arrived knowing nothing left knowing a
 * name. The research the ruling rests on is consistent and dull, which is why
 * it was followed rather than argued with: the first screen answers who and
 * what within seconds, two or three pieces of featured work beat a wall of
 * links, and PROOF beats claims.
 *
 * This site's proof is unusual and is the reason the tiles exist at all: it
 * measures itself continuously and publishes the measurements. So the three
 * numbers are READ AT RENDER from the instruments that own them, never typed
 * into this file.
 *
 *   gates      `stack.gates.length`, from content/generated/stack.json, which
 *              `build:stack` derives from package.json and `check:stack`
 *              reconciles in both directions. A digit here would be a second
 *              copy of a number a gate already owns. Rule 17.
 *   health     the SNAPSHOT `/api/health` last wrote to KV, read here and never
 *              recomputed. One KV read. See the correction below.
 *   writing    `total` from `listHomeStartHere`, the same `publiclyVisible()`
 *              predicate the blog index counts with, in the same batch.
 *
 * ## THE HEALTH TILE AND THE SHARED CACHE, and this is the decision the ruling
 * ## asked to see stated
 *
 * This page is `public, s-maxage=600`, so a verdict rendered into it can be up
 * to ten minutes old by the time it is read, and stale-while-revalidate widens
 * that further. A tile reading "healthy" with no qualifier would therefore be a
 * claim the page cannot support, which is the specific failure the ruling named:
 * the cached page must not lie.
 *
 * **The tile carries the time it was read, and the page stays cached.** The
 * alternative on offer was to keep health out of the cached body, and it is
 * refused: it costs either the tile (the most interesting of the three) or the
 * shared cache for every reader on the site's most-visited page, and it buys
 * accuracy this page does not need. "All N checks passed at 14:32 UTC" is TRUE
 * when read at 14:41. "All N checks passed" is not.
 *
 * `/api/health` is linked beside it, uncached and answering in real time, for
 * anyone who wants the current answer rather than the rendered one.
 *
 * ## THIS LOADER NO LONGER RUNS THE HEALTH SUITE. Corrected 2026-08-26.
 *
 * What stood here argued for calling `runHealthChecks` directly, against the
 * alternative of a subrequest to `/api/health`. The argument against the
 * subrequest was right and is kept below. The argument FOR computing was
 * wrong, and it was wrong about the cost rather than about the frequency:
 *
 *   "the health run is the slow half of this loader at roughly 0.7 to 2.7
 *    seconds... It is paid on a cache MISS only... Readers on a HIT pay
 *    nothing for it."
 *
 * Both sentences are true and the conclusion does not follow. MEASURED
 * 2026-08-26 against a control, unthrottled, six samples each: this page
 * rendered at origin in 1.07 to 3.48 s while `/blog` rendered in 0.32 to
 * 0.90 s, and `/api/health` measured alone took 0.98 to 2.01 s. The gap IS
 * the suite. On the throttled mobile profile two audits used, that arrived as
 * an LCP of 3.8 to 5.2 s on this page against 1.4 s on every other one.
 *
 * "A cache miss only" is not rare. The entry is `s-maxage=600` and it is per
 * LOCATION, so every colo pays it every ten minutes and the first reader in
 * each window pays all of it. A reader who has ever set a theme cookie paid it
 * on EVERY view, because a cookie-bearing request was downgraded past the
 * shared cache entirely. The slowest page on the site was the front door.
 *
 * ## WHAT IT DOES INSTEAD: ONE KV READ
 *
 * `/api/health` writes its verdict to KV on the way out, and the fifteen
 * minute scheduled poll goes through that same endpoint, so the snapshot stays
 * fresh with no second timer in existence. This loader reads it and renders
 * it. Nothing here can start a health run.
 *
 * The subrequest is still refused, for the reasons that were always good: a
 * Worker fetching its own public URL is a hop out to the edge and back, it
 * would have to name an origin that changes at DNS cutover, and it would put a
 * cacheable-looking request in front of an endpoint whose contract is
 * `no-store`. KV is neither a hop nor an origin.
 *
 * ## THE TILE GAINS A THIRD STATE, AND THAT IS THE PRICE
 *
 * The snapshot can be absent or old, so the tile must be able to say so
 * instead of showing a verdict. `healthTile` in `snapshot.mjs` owns the
 * classification and every uncertain input resolves to `missing`. The age is
 * measured from the SNAPSHOT'S timestamp, not from this render, so it counts
 * both hops of staleness: how long ago the suite ran, plus however long this
 * cached body has been sitting in front of a reader.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;

  /*
   * CONCURRENT. The listing is D1 and the tile is one KV read, and neither
   * reads the other's result, so serialising them would add their latencies
   * for nothing. Both are now cheap; the shape is kept because it costs
   * nothing and the reason it was right has not changed.
   *
   * `home_health` KEEPS ITS NAME, deliberately. It is now the KV read rather
   * than the suite, which is the whole point of the change, and the mark is
   * what will show that in production: the same name against a different
   * number is a legible before and after, where a renamed mark would look
   * like the instrument was removed.
   */
  const [start, tile] = await Promise.all([
    timed(timings, "home_posts", () => listHomeStartHere(env, { timings })),
    timed(timings, "home_health", () => readHealthTile(env)),
  ]);

  /*
   * `splitFeatured` IS GONE FROM THIS ROUTE, and that is ruling 57.
   *
   * It searched for the featured post inside the four rows this loader had
   * already fetched, so the lead was only ever found when it happened to be
   * among the four newest. The flagship sorts fifth, so the section was dark in
   * production: no heading, no cards, no "All N posts" link, on the page people
   * paste. `listHomeStartHere` asks for the featured post by name.
   *
   * `/blog` KEEPS `splitFeatured`, and the two are not disagreeing. There the
   * question really is "is the hero on the page I just fetched", because the
   * hero is drawn above a list it must then be removed from and only the
   * unfiltered first page may show one. Here the question is "what leads", and
   * that is a different query rather than a different answer.
   */
  return {
    gates: stack.gates.length,
    posts: start.total,
    featured: start.featured,
    recent: start.recent,
    /*
     * HANDED STRAIGHT THROUGH. The classification, the age and the refusal to
     * present an uncertain snapshot as a verdict all happened in `healthTile`,
     * which is where `node:test` can reach them. This route decides nothing
     * about health and computes no timestamp of its own: the age belongs to
     * the snapshot, not to this render.
     */
    health: tile,
  };
}

/**
 * A proof tile. The number is always passed in; this component owns none.
 *
 * `age` is optional and is emitted as `data-health-age` in SECONDS. It exists
 * for `check:browser`, which asserts that a freshly deployed home page carries
 * a verdict inside one poll interval. The gate reads the attribute rather than
 * the sentence beside it, because the sentence is prose that will be edited and
 * the attribute is a number that cannot be satisfied by a rewording.
 */
function Proof({
  value,
  label,
  detail,
  href,
  age,
}: {
  value: string;
  label: string;
  detail: string;
  href: string;
  age?: string;
}) {
  return (
    <li className="proof" data-health-age={age}>
      <Link className="proof-link" to={href}>
        <span className="proof-value">{value}</span>
        <span className="proof-label">{label}</span>
      </Link>
      <span className="proof-detail muted">{detail}</span>
    </li>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const jsonLd = [personJsonLd(SITE_ORIGIN), webSiteJsonLd(SITE_ORIGIN)];
  const { gates, posts, featured, recent, health } = loaderData;

  /*
   * THE TILE'S THREE STATES, resolved to a value and a sentence here and
   * nowhere else.
   *
   * `missing` and `stale` both refuse to show a ratio, and they refuse for the
   * same reason: a number beside the words "health checks passing" is read as
   * the CURRENT answer no matter what sentence sits under it. A dash is not
   * mistakable for a verdict. This is the same stance the old timestamp took,
   * carried one step further now that there is a state where the page has no
   * verdict at all rather than an old one.
   *
   * UTC is named in the detail, and the page is cached and served worldwide,
   * so a local time would be the reader's or the origin's depending on where
   * it rendered. `data-health-age` carries the age in seconds for
   * `check:browser`, which asserts a fresh deploy's tile is inside one poll
   * interval; a gate reading the prose would be reading a sentence rather than
   * a number.
   */
  const healthValue =
    health.state === "fresh" ? `${health.total - health.failed}/${health.total}` : "--";
  const healthDetail =
    health.state === "fresh"
      ? `Read ${formatAge(health.ageSeconds)}, at ${health.readAt.slice(11, 16)} UTC on ${health.readAt.slice(0, 10)}. This page is cached, so the answer above is at least that old; /api/health answers now.`
      : health.state === "stale"
        ? `The last verdict was read ${formatAge(health.ageSeconds)} and is too old to show. That means the scheduled check has stopped, not that the site has failed; /api/health answers now.`
        : "No recent verdict has been recorded. /api/health runs the checks and answers now.";
  const healthAge = health.state === "missing" ? undefined : String(health.ageSeconds);

  return (
    <>
      <SiteHeader />
      <main className="home" id="main">
        {/*
          THE SITE AUTHOR'S h-card, on the hero that already says who this is.
          Item I, ruling 50 as amended: microformats only. No `rel="me"`, no
          social links; social presence lives with germomics.

          MOSTLY VISIBLE, unlike the post page's author card. The name is the
          `<h1>` a reader already sees, so `p-name` needed no new markup and no
          hiding. Only `u-url` had nowhere to go: nothing in this hero links to
          the site's own root, and the one element that does, the header
          wordmark, is on every page rather than this one. So the anchor is
          hidden, and it is the ONE hidden element here.

          NO `u-photo`. There is no photograph of Dustin on this page or in the
          Person JSON-LD beside it, and a card claiming a photo the site does
          not publish would be the h-card version of a substituted value.
        */}
        <div className="home-intro h-card">
          <p className="eyebrow">{SITE.eyebrow}</p>
          <h1 className="hero-name p-name">{SITE.name}</h1>
          <a className="u-url" href="/" hidden>
            {SITE.name}
          </a>
          {/*
            ONE SENTENCE OF WHO AND WHAT, and it is `SITE.tagline`, the string
            the Person record and the meta description already derive from.
            A second sentence written here would be a second answer to the
            question the whole page exists to answer once.
          */}
          <p className="hero-role">{SITE.tagline}</p>
          {/*
            **THE UNIVERSITY, IN TEXT A PERSON CAN READ.**

            It was in `personJsonLd` and nowhere else. The pre-cutover audit's
            fourth part put it plainly: a stranger could read this whole site
            and never learn where the author works, because the only place it
            was written was a script element addressed to machines.

            `SITE.affiliation`, the SAME constant the Person record takes its
            `worksFor` from, so the page and the graph cannot come to name
            different employers. And it is `p-org` on the h-card this block
            already is, which is the property that was missing from it: a card
            with a name and no organisation is the half a reader wanted.

            The JOB TITLE is deliberately not repeated here. `SITE.tagline`
            one line up already says "Professor by training", and `/about`
            carries the current title in prose; three statements of one job
            across two pages is the mirror this file's own comments keep
            arguing against.
          */}
          <p className="hero-affiliation">
            <span className="p-org">{SITE.affiliation}</span>
          </p>
        </div>

        <section className="home-proof" aria-labelledby="proof-heading">
          <h2 id="proof-heading" className="home-section-heading">
            The evidence, read when this page rendered
          </h2>
          <ul className="proof-list">
            <Proof
              value={String(gates)}
              label={gates === 1 ? "automated check" : "automated checks"}
              detail="every one of them runs before a deploy is allowed out"
              href="/colophon#gates"
            />
            <Proof
              value={healthValue}
              label="health checks passing"
              detail={healthDetail}
              href="/api/health"
              age={healthAge}
            />
            <Proof
              value={String(posts)}
              label={posts === 1 ? "published post" : "published posts"}
              detail="written about building this, with the measurements in them"
              href="/blog"
            />
          </ul>
        </section>

        {featured ? (
          <section className="home-featured" aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="home-section-heading">
              Start here
            </h2>
            {/*
              THE SAME FOUR PROPERTIES AS `PostCard`, on markup that is not
              `PostCard`.

              This list has never used that component and this arc is not the
              place to make it: the cards here are `h3` under a section heading
              rather than `h2`, and the recent ones deliberately show no
              description. Marking them by hand is three lines; unifying the
              two card shapes is a design change nobody asked for. It IS a
              second place the property set is written down, which is the cost,
              and `check:microformats` reads both surfaces so the two cannot
              quietly diverge.

              `dt-published` NEEDED AN ELEMENT. The date here was bare text,
              formatted and then thrown away, so unlike the blog index there was
              no `<time>` to take the class. The rendered string is unchanged;
              what is new is the element around it and its machine-readable
              `datetime`, which this list should have had anyway.

              NO h-feed. This is a hand-picked three, not the blog's feed, and
              `/blog` is the page that says it is one.
            */}
            <ul className="post-list">
              <li className="post-card h-entry">
                <h3 className="post-card-title p-name">
                  <Link className="u-url" to={`/blog/${featured.slug}`}>
                    {featured.title}
                  </Link>
                </h3>
                <p className="post-card-meta">
                  {featured.publishAt ? (
                    <time
                      className="dt-published"
                      dateTime={new Date(featured.publishAt).toISOString()}
                    >
                      {longDateUTC(featured.publishAt)}
                    </time>
                  ) : null}
                  {featured.readingTimeMinutes
                    ? ` · ${featured.readingTimeMinutes} min read`
                    : null}
                </p>
                {featured.description ? (
                  <p className="p-summary">{featured.description}</p>
                ) : null}
              </li>
              {recent.map((post) => (
                <li key={post.slug} className="post-card h-entry">
                  <h3 className="post-card-title p-name">
                    <Link className="u-url" to={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h3>
                  <p className="post-card-meta">
                    {post.publishAt ? (
                      <time
                        className="dt-published"
                        dateTime={new Date(post.publishAt).toISOString()}
                      >
                        {longDateUTC(post.publishAt)}
                      </time>
                    ) : null}
                    {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : null}
                  </p>
                </li>
              ))}
            </ul>
            <p className="home-more">
              <Link to="/blog">All {posts} posts</Link>
            </p>
          </section>
        ) : null}

        {/*
          FOR READERS WHO ARE NOT PEOPLE, stated plainly rather than left to be
          discovered in a Link header. Every post serves its own markdown source
          at `.md`, and llms.txt lists the corpus; an agent that knows this can
          read the writing without parsing markup at all.
        */}
        <section className="home-machines" aria-labelledby="machines-heading">
          <h2 id="machines-heading" className="home-section-heading">
            Reading this as a machine
          </h2>
          <p>
            Every post is also served as its markdown source: add <code>.md</code> to any
            post URL, or send <code>Accept: text/markdown</code>. The whole corpus is at{" "}
            <a href="/llms-full.txt">llms-full.txt</a>, and{" "}
            <a href="/llms.txt">llms.txt</a> describes what is here. How the site is
            built, and what it costs, is on the <Link to="/colophon">colophon</Link>.
          </p>
        </section>

        {jsonLd.map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            // schema.org data for search and language models
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
          />
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
