import { Link } from "react-router";

import stack from "../../content/generated/stack.json";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { listBlogPosts } from "~/db";
import { splitFeatured } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { runHealthChecks } from "~/lib/health/checks.server";
import { longDateUTC } from "~/lib/long-date.mjs";
import { timed, timingsContext } from "~/lib/timing";
import {
  publicHtmlHeaders,
  personJsonLd,
  SITE,
  SITE_ORIGIN,
  webSiteJsonLd,
  pageMeta,
} from "~/lib/seo";
import type { Route } from "./+types/home";

/**
 * Publicly cacheable for COOKIELESS readers only.
 *
 * This route had no `headers` export and reached `private, no-store` through the
 * hard rule 8 default. That default STAYS and still covers everything unlisted;
 * this route now opts in, and `workers/app.ts` downgrades it right back whenever
 * the request carries a cookie. Grounds on HTML_VARY in seo.ts.
 */
export function headers() {
  return publicHtmlHeaders();
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
 *   health     the verdict of `runHealthChecks`, the same function /api/health
 *              serves and the scheduled workflow polls.
 *   writing    `total` from `listBlogPosts`, the same query and the same
 *              `publiclyVisible()` predicate the blog index counts with.
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
 * ## WHY THE MODULE AND NOT A SUBREQUEST TO /api/health
 *
 * The ruling said "fetched server-side". Calling `runHealthChecks` directly IS
 * that, and it is the better shape here: a Worker fetching its own public URL
 * is a second network hop out to the edge and back, it would have to name an
 * origin that changes at DNS cutover, and it would put a cacheable-looking
 * request in front of an endpoint whose whole contract is `no-store`. One
 * module, two callers, no HTTP between them.
 *
 * MEASURED, and the reason this is affordable: the health run is the slow half
 * of this loader at roughly 0.7 to 2.7 seconds, dominated by the AI Search
 * listing. It is paid on a cache MISS only, once per ten minutes per location,
 * and `stale-while-revalidate=86400` serves the previous body while the next
 * one is built. Readers on a HIT pay nothing for it.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;

  /*
   * CONCURRENT. The listing is D1 and the health run is AI Search, R2 and D1,
   * and neither reads the other's result, so serialising them would add their
   * latencies for nothing.
   */
  const [listing, health] = await Promise.all([
    timed(timings, "home_posts", () => listBlogPosts(env, { perPage: 4, timings })),
    timed(timings, "home_health", () => runHealthChecks(env)),
  ]);

  /*
   * THE SAME SPLIT THE BLOG INDEX USES, imported rather than repeated, so
   * "which post leads" is one decision made in one place: the `featured` flag
   * in the post's own frontmatter. This page and /blog cannot disagree about
   * it, and moving the lead is a content edit rather than a code change.
   */
  const { featured, posts } = splitFeatured(listing.posts, true);

  return {
    gates: stack.gates.length,
    posts: listing.total,
    featured,
    recent: posts.slice(0, 3),
    health: {
      ok: health.failed.length === 0,
      total: health.checks.length,
      failed: health.failed.length,
      /*
       * THE TIME THE VERDICT WAS TAKEN, rendered beside it. This is what keeps
       * a ten-minute-old cached body honest; see the note above.
       */
      readAt: new Date().toISOString(),
    },
  };
}

/** A proof tile. The number is always passed in; this component owns none. */
function Proof({
  value,
  label,
  detail,
  href,
}: {
  value: string;
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <li className="proof">
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
   * UTC, and named as such. The page is cached and served worldwide, so a local
   * time would be the reader's or the origin's depending on where it rendered,
   * and neither is what the timestamp is for: it says how old this claim is.
   */
  const readAt = `${health.readAt.slice(11, 16)} UTC on ${health.readAt.slice(0, 10)}`;

  return (
    <>
      <SiteHeader />
      <main className="home" id="main">
        <div className="home-intro">
          <p className="eyebrow">{SITE.eyebrow}</p>
          <h1 className="hero-name">{SITE.name}</h1>
          {/*
            ONE SENTENCE OF WHO AND WHAT, and it is `SITE.tagline`, the string
            the Person record and the meta description already derive from.
            A second sentence written here would be a second answer to the
            question the whole page exists to answer once.
          */}
          <p className="hero-role">{SITE.tagline}</p>
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
              value={health.ok ? `${health.total}/${health.total}` : `${health.total - health.failed}/${health.total}`}
              label="health checks passing"
              detail={`read at ${readAt}. This page is cached, so the answer above is that old; /api/health answers now.`}
              href="/api/health"
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
            <ul className="post-list">
              <li className="post-card">
                <h3 className="post-card-title">
                  <Link to={`/blog/${featured.slug}`}>{featured.title}</Link>
                </h3>
                <p className="post-card-meta">
                  {featured.publishAt ? longDateUTC(featured.publishAt) : null}
                  {featured.readingTimeMinutes
                    ? ` · ${featured.readingTimeMinutes} min read`
                    : null}
                </p>
                {featured.description ? <p>{featured.description}</p> : null}
              </li>
              {recent.map((post) => (
                <li key={post.slug} className="post-card">
                  <h3 className="post-card-title">
                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="post-card-meta">
                    {post.publishAt ? longDateUTC(post.publishAt) : null}
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
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
