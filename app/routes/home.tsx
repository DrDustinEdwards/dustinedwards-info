import { Link } from "react-router";

import stack from "../../content/generated/stack.json";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { listHomeStartHere } from "~/db";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { getEnv } from "~/lib/context";
import { readHealthTile } from "~/lib/health/snapshot.server";
import { longDateUTC } from "~/lib/long-date.mjs";
import { timed, timingsContext } from "~/lib/timing";
import {
  cacheTags,
  HOME_EDGE_CACHE_CONTROL,
  publicHtmlHeaders,
  personJsonLd,
  SITE,
  SITE_ORIGIN,
  webSiteJsonLd,
  pageMeta,
} from "~/lib/seo";
import { EvidenceRow } from "~/components/evidence-row";
import { PlateI, PlateKeyRow } from "~/components/plate-i";
import { Enhance } from "~/components/enhance";
import { FigurePapersPerYear, FigureRoster } from "~/components/home-figures";
import { HomePodcast } from "~/components/home-podcast";
import { homePodcastEpisode } from "~/lib/podcast/podcast.server";
import { PUBLICATIONS } from "~/data/publications";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { doiSlug } from "~/lib/publications/paths.mjs";
import type { Route } from "./+types/home";

import "~/styles/evidence-row.css";
import "~/styles/home.css";

/** Publicly cacheable; the theme is a cache-key dimension, not a Vary. The short edge policy is for the health tile. */
export function headers() {
  return publicHtmlHeaders(cacheTags(), HOME_EDGE_CACHE_CONTROL);
}

export function meta() {
  return pageMeta({ title: SITE.name, description: SITE.description, path: "/" });
}

/**
 * The cached page must not lie: only a `fresh` verdict shows a ratio, with its age in
 * `data-health-age`. Nothing here starts a health run: a Worker fetching its own public URL is an
 * edge round trip naming an origin that changes at cutover.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;

  const [start, tile, podcast] = await Promise.all([
    timed(timings, "home_posts", () => listHomeStartHere(env, { timings })),
    timed(timings, "home_health", () => readHealthTile(env)),
    timed(timings, "home_podcast", () => homePodcastEpisode(context)),
  ]);

  return {
    gates: stack.gates.length,
    posts: start.total,
    featured: start.featured,
    recent: start.recent,
    health: tile,
    podcast,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const jsonLd = [personJsonLd(SITE_ORIGIN), webSiteJsonLd(SITE_ORIGIN)];
  const { gates, posts, featured, recent, health, podcast } = loaderData;

  /*
   * `missing` and `stale` show no ratio: a number beside "health checks passing" is read as the
   * current answer whatever sentence sits under it.
   */
  const healthValue =
    health.state === "fresh" ? `${health.total - health.failed}/${health.total}` : "--";
  const healthAge = "ageSeconds" in health ? String(health.ageSeconds) : undefined;

  /* Every figure in sections 2 and 3 is counted here, never typed: a typed number drifts when a paper lands. */
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
        {/* `rel="me"` links live in the footer; only `u-url` needed a home here. No `u-photo`: the site publishes none. */}
        <div className="home-hero u-wide">
        <section className="home-intro h-card" aria-labelledby="intro-h">
          <h1 className="intro-name p-name" id="intro-h">
            {SITE.name}
          </h1>
          <p className="intro-affil">
            <span>Professor and virologist</span>
            <span>{SITE.affiliation}</span>
            <span className="intro-affil-system">Texas A&amp;M University System</span>
          </p>
          <a className="u-url" href="/" hidden>
            {SITE.name}
          </a>
        </section>

        {/*
         * No abstract: that text is Dustin's to write, and a session's words about him must not ship on
         * his home page.
         */}

        <figure className="home-plate">
          <PlateI />
          <figcaption className="home-plate-caption">
            <span className="home-plate-num">Plate I</span>
            <span className="home-plate-cap">Plaque morphology, drawn.</span>
          </figcaption>
        </figure>
        </div>

        <PlateKeyRow />
        <Enhance module="plate" />

        <section className="home-research" aria-labelledby="research-heading">
          <h2 id="research-heading" className="home-section-heading">
            Research
          </h2>
          <p className="home-research-line">I study viral genomics.</p>
        </section>

        {featured ? (
          <section className="home-featured" aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="home-section-heading">
              Writing
            </h2>
            {/* The same four properties as `PostCard`; `check:machine-readable` reads both. No h-feed: a hand-picked three is not the feed. */}
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

        {/* Titles and journals go through `decodeEntities`: the deposited records carry HTML entities React would print literally. */}
        <section className="home-section" aria-labelledby="publications-heading">
          <h2 id="publications-heading" className="home-section-heading">
            Publications
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

        <section className="home-section" aria-labelledby="discovery-heading">
          <h2 id="discovery-heading" className="home-section-heading">
            Phage discovery
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

        <HomePodcast episode={podcast} />

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

        {/* `data-health-age` is in seconds: `check:browser` and `verify-live` read the attribute, not the sentence. */}
        <EvidenceRow
          facts={[
            <span>{SITE.affiliation}</span>,
            <Link to="/colophon#gates">
              {gates} {gates === 1 ? "check" : "checks"}
            </Link>,
            <span className="evidence-health" data-health-age={healthAge}>
              <Link to="/api/health">
                {/* A failed read says so; "--" is kept for a snapshot that was never written or is too old. */}
                {health.state === "unreadable" ? "health status unreadable" : `${healthValue} passing`}
              </Link>
            </span>,
            <Link to="/blog">
              {posts} {posts === 1 ? "post" : "posts"}
            </Link>,
          ]}
        />

        {jsonLd.map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
          />
        ))}
      </main>
      <ShellFooter />
    </>
  );
}
