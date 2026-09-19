import { Link } from "react-router";

import stack from "../../content/generated/stack.json";
import { ShellFooter } from "~/components/shell-footer";
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
 * Publicly cacheable. The hard rule 8 default STAYS and still covers everything
 * unlisted; this route opts in. The theme is a dimension of the cache key rather
 * than a Vary. Tagged `posts`, because the proof tiles and the featured list read
 * the corpus.
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
 * THE FRONT DOOR: who, what, and why believe it.
 *
 * This site's proof is that it measures itself continuously and publishes the
 * measurements, so THE THREE NUMBERS ARE READ AT RENDER from the instruments that
 * own them, never typed into this file. A digit here would be a second copy of a
 * number a gate already owns. Rule 17.
 *
 * THE CACHED PAGE MUST NOT LIE. This page is shared-cached, so a verdict rendered
 * into it can be minutes old by the time it is read. The tile therefore carries
 * the time it was read and the page stays cached: "All N checks passed at 14:32
 * UTC" is TRUE when read at 14:41, and "All N checks passed" is not.
 *
 * NOTHING HERE CAN START A HEALTH RUN. `/api/health` writes its verdict to KV and
 * this loader reads it: one KV read. The subrequest is refused because a Worker
 * fetching its own public URL is a hop out to the edge and back, naming an origin
 * that changes at cutover.
 *
 * THE TILE HAS A THIRD STATE. The snapshot can be absent or old, so the tile must
 * be able to say so instead of showing a verdict; every uncertain input resolves
 * to `missing`.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;

  /*
   * CONCURRENT: neither reads the other's result. `home_health` KEEPS ITS NAME
   * deliberately, because the same name against a different number is a legible
   * before and after where a renamed mark would look like the instrument was
   * removed.
   */
  const [start, tile] = await Promise.all([
    timed(timings, "home_posts", () => listHomeStartHere(env, { timings })),
    timed(timings, "home_health", () => readHealthTile(env)),
  ]);

  /*
   * `splitFeatured` IS GONE FROM THIS ROUTE, ruling 57: it searched inside the rows
   * already fetched, so the lead was only found when it happened to be among them.
   * `/blog` keeps it, because there the question really is "is the hero on the page
   * I just fetched".
   */
  return {
    gates: stack.gates.length,
    posts: start.total,
    featured: start.featured,
    recent: start.recent,
    /*
     * HANDED STRAIGHT THROUGH. The classification, the age and the refusal to present
     * an uncertain snapshot as a verdict all happened in `healthTile`. This route
     * computes no timestamp of its own.
     */
    health: tile,
  };
}

/**
 * A proof tile. The number is always passed in; this component owns none.
 *
 * `age` is emitted as `data-health-age` in SECONDS for `check:browser`. The gate
 * reads the attribute rather than the sentence beside it, because the sentence is
 * prose that will be edited and the attribute is a number that cannot be satisfied
 * by a rewording.
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
   * `missing` and `stale` both refuse to show a ratio: a number beside "health
   * checks passing" is read as the CURRENT answer no matter what sentence sits under
   * it, and a dash is not mistakable for a verdict.
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
      <main className="home" id="main" tabIndex={-1}>
        {/*
         * Ruling 50 as amended: microformats only, no `rel="me"`. Only `u-url` had
         * nowhere to go, so the anchor is hidden and it is the ONE hidden element here.
         *
         * NO `u-photo`: a card claiming a photo the site does not publish would be the
         * h-card version of a substituted value.
         */}
        <div className="home-intro h-card">
          <p className="eyebrow">{SITE.eyebrow}</p>
          <h1 className="hero-name p-name">{SITE.name}</h1>
          <a className="u-url" href="/" hidden>
            {SITE.name}
          </a>
          {/*
           * ONE SENTENCE OF WHO AND WHAT, and it is `SITE.tagline`, the string the Person
           * record and the meta description already derive from.
           */}
          <p className="hero-role">{SITE.tagline}</p>
          {/*
           * THE UNIVERSITY, IN TEXT A PERSON CAN READ. `SITE.affiliation`, the SAME
           * constant the Person record's `worksFor` comes from, so the page and the graph
           * cannot name different employers. The JOB TITLE is deliberately not repeated
           * here.
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
             * THE SAME FOUR PROPERTIES AS `PostCard`, on markup that is not `PostCard`. It
             * IS a second place the property set is written down, which is the cost, and
             * `check:microformats` reads both surfaces so the two cannot quietly diverge.
             *
             * NO h-feed: this is a hand-picked three, not the blog's feed.
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
         * FOR READERS WHO ARE NOT PEOPLE, stated plainly rather than left to be
         * discovered in a Link header: an agent that knows this can read the writing
         * without parsing markup at all.
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
      <ShellFooter />
    </>
  );
}
