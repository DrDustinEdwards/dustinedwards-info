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
import { EvidenceRow } from "~/components/evidence-row";
import { PlateI, PlateKey } from "~/components/plate-i";
import { FigurePapersPerYear, FigureRoster } from "~/components/home-figures";
import { PUBLICATIONS } from "~/data/publications";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { doiSlug } from "~/lib/publications/paths.mjs";
import type { Route } from "./+types/home";

import "~/styles/evidence-row.css";
import "~/styles/home.css";

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
 * number a gate already owns. Rule 17. The writing tile is `total` from
 * `listHomeStartHere`, the same `publiclyVisible()` predicate the blog index
 * counts with, so a different count here is a visibility bug and not copy.
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

  /*
   * EVERY FIGURE IN SECTIONS 2 AND 3 IS COUNTED HERE, not typed into the prose. The handoff's own
   * sentences carry numbers (36 papers, 157 researchers, nine cohorts, six in one year), and a
   * typed number beside a computed chart is the exact shape rule 17 refuses: two owners for one
   * fact, drifting the first time a paper lands.
   */
  const years = PUBLICATIONS.map((p) => p.year).filter((y) => Number.isFinite(y));
  const earliestYear = Math.min(...years);
  const latestYear = Math.max(...years);
  const perYear = new Map<number, number>();
  for (const y of years) perYear.set(y, (perYear.get(y) ?? 0) + 1);
  const peak = [...perYear.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]).at(0) ?? [
    latestYear,
    0,
  ];
  const [peakYear, peakCount] = peak;
  /* Newest first, and the deposited date breaks a tie inside a year. */
  const recentPapers = [...PUBLICATIONS]
    .sort((a, b) => b.year - a.year || (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""))
    .slice(0, 3);

  const cohortSizes = PHAGE_YEARS.map((c) => c.researchers.length);
  const researcherCount = cohortSizes.reduce((n, c) => n + c, 0);
  const cohortYears = PHAGE_YEARS.map((c) => c.year);
  const firstCohort = Math.min(...cohortYears);
  const lastCohort = Math.max(...cohortYears);
  const smallestCohort = Math.min(...cohortSizes);
  const largestCohort = Math.max(...cohortSizes);

  return (
    <>
      <SiteHeader />
      <main className="tracks home-tracks" id="main" tabIndex={-1}>
        {/*
         * Ruling 50 as amended: microformats only, no `rel="me"`. Only `u-url` had
         * nowhere to go, so the anchor is hidden and it is the ONE hidden element here.
         *
         * NO `u-photo`: a card claiming a photo the site does not publish would be the
         * h-card version of a substituted value.
         */}
        {/*
         * THE EYEBROW IS GONE. An uppercase tracked line above the name is the one typographic
         * move this direction refuses outright, and the sentence under the name already said it.
         */}
        {/*
         * THE SPLIT HERO, and it is the first consumer .u-wide has ever had. The handoff puts the
         * plate in the intro's RIGHT COLUMN at 1280 with a 76px gutter, and below the evidence
         * line at 375. Name, sentence and evidence row hold the left; the plate holds the right;
         * below the breakpoint the grid collapses and the source order is already correct.
         *
         * The pair takes the wide track because the text track is the prose measure and a 500px
         * plate beside a column of type is not prose (ruling 118 item 4).
         */}
        <div className="home-hero u-wide">
        <section className="home-intro h-card" aria-labelledby="intro-h">
          <h1 className="intro-name p-name" id="intro-h">
            {SITE.name}
          </h1>
          <a className="u-url" href="/" hidden>
            {SITE.name}
          </a>
          {/*
           * ONE SENTENCE OF WHO AND WHAT, and it is `SITE.tagline`, the string the Person
           * record and the meta description already derive from.
           */}
          <p className="intro-line">{SITE.tagline}</p>
          {/*
           * THE THREE PROOF TILES, FLATTENED INTO THE EVIDENCE ROW, each figure linking where its
           * tile linked. No boxes, no big numerals, no labels under values.
           *
           * THE AFFILIATION IS THE ROW'S FIRST FACT and the one hand-written one in any instance
           * of it: `SITE.affiliation`, the SAME constant the Person record's `worksFor` comes
           * from, so the page and the graph cannot name different employers. `p-org` moves onto
           * that span and the row sits inside `.h-card`, so the microformat still parses.
           *
           * `data-health-age` rides the health fact, in SECONDS, because `check:browser` and
           * `verify-live` read the attribute rather than the sentence beside it: prose gets
           * edited, a number cannot be satisfied by a rewording.
           */}
          <EvidenceRow
            facts={[
              <span className="p-org">{SITE.affiliation}</span>,
              <Link to="/colophon#gates">
                {gates} {gates === 1 ? "check" : "checks"}
              </Link>,
              <span className="evidence-health" data-health-age={healthAge}>
                <Link to="/api/health">{healthValue} passing</Link>
              </span>,
              <Link to="/blog">
                {posts} {posts === 1 ? "post" : "posts"}
              </Link>,
            ]}
            detail={healthDetail}
          />
        </section>

        {/*
         * THE ABSTRACT IS NOT HERE, deliberately. The handoff carries one, and its text is a
         * session's words about Dustin rather than his own: vol 19 records that it is his to
         * write. Shipping a stranger's sentence about a person, on that person's home page, is
         * the one thing this section must not do, so the intro carries `SITE.tagline` alone until
         * he supplies it. The label went with it; an "Abstract" heading over nothing is worse
         * than no heading, and vol 19 says that label is sentence case or dropped.
         */}

        {/*
         * PLATE I. A drawing, not data: it does not change with the corpus. Second in source, so
         * a reader without the grid meets the name, the sentence and the checkable row before the
         * teaching object, and a screen reader hears them in that order at every width.
         */}
        {/*
         * FOCUSABLE BECAUSE IT SCROLLS. Below a 348px viewport the plate is wider than the reading
         * column and pans inside its own box (home.css), and a region a pointer can scroll has to
         * be reachable by keyboard too: Chrome does not make scroll containers focusable on its
         * own. Same shape as the admin tables and the playground code blocks. The figure is named
         * by its own caption, so it needs no aria-label on top of that.
         */}
        <figure className="home-plate" tabIndex={0}>
          <PlateI />
          <figcaption className="home-plate-caption">
            <span className="home-plate-num">Plate I</span> Plaque morphology, drawn as a key: one
            specimen of each type on a single lawn. Every plaque a phage hunter has to learn to
            call, at one magnification.
          </figcaption>
        </figure>
        </div>
        <PlateKey />

        {featured ? (
          <section className="home-featured" aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="home-section-heading">
              <span className="home-section-num">1</span> Writing
            </h2>
            {/*
             * THE SAME FOUR PROPERTIES AS `PostCard`, on markup that is not `PostCard`. It
             * IS a second place the property set is written down, which is the cost, and
             * `check:microformats` reads both surfaces so the two cannot quietly diverge.
             *
             * NO h-feed: this is a hand-picked three, not the blog's feed.
             */}
            {/*
             * ONE `ol`, HAND-PICKED FIRST. Reverse-chronological order is meaningful for the tail,
             * and the featured post leads it because it is the way in, which is what the heading
             * says. `key` guards against the featured post also appearing in `recent`.
             *
             * READING TIME IS NOT DRAWN. The date is the only metadata a reader needs to choose;
             * the field stays upstream for whatever else reads it.
             */}
            <ol className="home-rows">
              {[featured, ...recent.filter((post) => post.slug !== featured.slug)].map((post) => (
                <li key={post.slug} className="home-row h-entry">
                  <span className="home-row-date">
                    {post.publishAt ? (
                      <time
                        className="dt-published"
                        dateTime={new Date(post.publishAt).toISOString()}
                      >
                        {longDateUTC(post.publishAt)}
                      </time>
                    ) : null}
                  </span>
                  <span className="home-row-body">
                    <span className="home-row-title p-name">
                      <Link className="u-url" to={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </span>
                    {post.description ? (
                      <span className="home-row-summary p-summary">{post.description}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
            <p className="home-more">
              <Link to="/blog">All {posts} posts</Link>
            </p>
          </section>
        ) : null}

        {/*
         * 2 · PUBLICATIONS. Three rows and a figure, both read from `app/data/publications.ts`,
         * so the count in the sentence and the rules in the chart cannot disagree with the list
         * at /publications. Titles and journals go through `decodeEntities` because the deposited
         * records carry HTML entities and React would otherwise print `&amp;` as four characters.
         */}
        <section className="home-section" aria-labelledby="publications-heading">
          <h2 id="publications-heading" className="home-section-heading">
            <span className="home-section-num">2</span> Publications
          </h2>
          <p className="home-section-lede">
            Peer-reviewed work on retroviruses, bacteriophage genomics and science education,{" "}
            {earliestYear} to {latestYear}. The corpus is uneven on purpose: {peakCount} papers
            landed in {peakYear}, which is what a sequencing year looks like beside a teaching one.
          </p>
          <ol className="home-rows">
            {recentPapers.map((paper) => (
              <li key={paper.id} className="home-row">
                <span className="home-row-date">{paper.year}</span>
                <span className="home-row-body">
                  <span className="home-row-title">
                    <Link to={`/publications/${doiSlug(paper.doi)}/`}>
                      {decodeEntities(paper.title)}
                    </Link>
                  </span>
                  {paper.journal ? (
                    <span className="home-row-summary">{decodeEntities(paper.journal)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          <p className="home-more">
            <Link to="/publications">All {PUBLICATIONS.length} papers</Link>
          </p>
          <figure className="home-figure">
            <FigurePapersPerYear />
            <figcaption className="home-figure-caption">
              <span className="home-figure-num">Figure 1</span> Papers per year, {earliestYear} to{" "}
              {latestYear}. Rule height is the count; the dashed line is six. Years with nothing
              keep their place on the axis.
            </figcaption>
          </figure>
        </section>

        {/*
         * 3 · PHAGE DISCOVERY. The roster page carries the names; this is the shape of the
         * programme. Both numbers in the sentence are counted from `PHAGE_YEARS` rather than
         * typed, so a new cohort moves the sentence and the figure together.
         */}
        <section className="home-section" aria-labelledby="discovery-heading">
          <h2 id="discovery-heading" className="home-section-heading">
            <span className="home-section-num">3</span> Phage discovery
          </h2>
          <p className="home-section-lede">
            {researcherCount} undergraduate researchers have isolated and annotated bacteriophage
            at Tarleton State since {firstCohort}, in {PHAGE_YEARS.length} cohorts of{" "}
            {smallestCohort} to {largestCohort}. The roster carries their names and nothing else
            beside them.
          </p>
          <figure className="home-figure">
            <FigureRoster />
            <figcaption className="home-figure-caption">
              <span className="home-figure-num">Figure 2</span> One cell per researcher, one row
              per cohort, newest first. Hexagonal packing is the arrangement, not an ornament: it
              is how cells sit on a plate.
            </figcaption>
          </figure>
          <p className="home-more">
            <Link to="/phage-discovery">The roster, {firstCohort} to {lastCohort}</Link>
          </p>
        </section>

        {/*
         * FOR READERS WHO ARE NOT PEOPLE, stated plainly rather than left to be
         * discovered in a Link header: an agent that knows this can read the writing
         * without parsing markup at all.
         */}
        <section className="home-machines" aria-labelledby="machines-heading">
          <h2 id="machines-heading" className="home-section-heading">
            <span className="home-section-num">4</span> Reading this as a machine
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
