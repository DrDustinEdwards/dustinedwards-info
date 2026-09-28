import type { ReactNode } from "react";
import { Link, data } from "react-router";

import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { listHomeStartHere, nextScheduledPublishAt } from "~/db";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { getEnv } from "~/lib/context";
import { longDateUTC } from "~/lib/long-date.mjs";
import { timed, timingsContext } from "~/lib/timing";
import {
  cacheTags,
  EDGE_CACHE_HEADER,
  HOME_EDGE_FRESH_SECONDS,
  publicHtmlHeaders,
  scheduledEdgeCacheControl,
  personJsonLd,
  SITE,
  SITE_ORIGIN,
  webSiteJsonLd,
  pageMeta,
} from "~/lib/seo";
import { PlateI, PlateKeyRow } from "~/components/plate-i";
import { Enhance } from "~/components/enhance";
import { HomePodcast } from "~/components/home-podcast";
import { homePodcastEpisode } from "~/lib/podcast/podcast.server";
import { PUBLICATIONS } from "~/data/publications";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { doiSlug } from "~/lib/publications/paths.mjs";
import { RESEARCH_AREAS, SOFTWARE_PRODUCTS } from "~/lib/nav";
import type { Route } from "./+types/home";

import "~/styles/home.css";

/** Publicly cacheable; the theme is a cache-key dimension, not a Vary. The short edge policy is for the Germomics episode. */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return publicHtmlHeaders(cacheTags(), loaderHeaders.get(EDGE_CACHE_HEADER) ?? undefined);
}

export function meta() {
  return pageMeta({ title: SITE.name, description: SITE.description, path: "/" });
}

/** How many papers the Publications section shows. */
const HOME_PAPERS = 3;

/**
 * The papers marked `selected` in app/data/publications.ts, newest first; with none marked, the newest.
 * Chosen in the loader and not the component, so the publication records (abstracts, author lists)
 * stay out of the page's script.
 */
function homePapers() {
  const newest = [...PUBLICATIONS].sort(
    (a, b) => b.year - a.year || (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""),
  );
  const selected = newest.filter((p) => p.selected);
  /* Titles and journals go through `decodeEntities`: the deposited records carry HTML entities React would print literally. */
  return (selected.length > 0 ? selected : newest).slice(0, HOME_PAPERS).map((p) => ({
    id: p.id,
    year: p.year,
    title: decodeEntities(p.title),
    journal: p.journal ? decodeEntities(p.journal) : null,
    href: `/research/publications/${doiSlug(p.doi)}/`,
  }));
}

/** Counted, never typed: a typed number drifts when a cohort lands. The names stay out of the payload. */
function discoveryFacts() {
  return {
    researchers: PHAGE_YEARS.reduce((n, c) => n + c.researchers.length, 0),
    cohorts: PHAGE_YEARS.length,
    since: Math.min(...PHAGE_YEARS.map((c) => c.year)),
  };
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;

  const [start, podcast, nextPublishAt] = await Promise.all([
    timed(timings, "home_posts", () => listHomeStartHere(env, { timings })),
    timed(timings, "home_podcast", () => homePodcastEpisode(context)),
    timed(timings, "home_next_scheduled", () => nextScheduledPublishAt(env)),
  ]);

  return data(
    {
      posts: start.total,
      featured: start.featured,
      recent: start.recent,
      papers: homePapers(),
      paperCount: PUBLICATIONS.length,
      discovery: discoveryFacts(),
      podcast,
    },
    {
      headers: {
        [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(
          new Date(),
          nextPublishAt,
          HOME_EDGE_FRESH_SECONDS,
        ),
      },
    },
  );
}

/** The current retrovirus work, named beside the three areas. Title as the page titles itself. */
const AVIAN = {
  to: "/research/retroviruses/avian",
  label: "REV and LPDV in wild turkeys in Texas",
  description: "Two bird retroviruses, and why they matter for wild turkeys and prairie chickens",
};

/** The lab's own pages. Each line is cut from that page's description. */
const LAB_RESOURCES = [
  {
    rail: "Protocol",
    to: "/research/protocols/phage-isolation",
    label: "Phage isolation and purification",
    description:
      "Where the Tarleton SEA-PHAGES lab runs a step differently from the Phage Discovery Guide",
  },
  {
    rail: "Calculations",
    to: "/teaching/virus-isolation/faq",
    label: "Lab calculations and common questions",
    description: "Titers in pfu/ml, spot titer dilutions, webbed plate volumes and lysate yields",
  },
  {
    rail: "Calculators",
    to: "/research/tools",
    label: "Phage lab calculators",
    description:
      "Titer from plaque counts and spot titers, serial dilution plans and webbed plate volumes, with the arithmetic shown",
  },
  {
    rail: "Protocol",
    to: "/research/protocols/coi-primers",
    label: "COI primers: LCO1490 and HCO2198",
    description: "Primer sequences and PCR conditions for COI barcoding of invertebrates",
  },
];

/** One section of the home page: a heading, a short list, and the link to the rest. */
function Section({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="home-section" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="home-section-heading">
        {title}
      </h2>
      {children}
      <p className="home-more">{more}</p>
    </section>
  );
}

/** A short mono label in the rail, a title that links, and one line under it. */
function Row({
  rail,
  to,
  title,
  summary,
}: {
  rail: ReactNode;
  to: string;
  title: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <li className="home-row">
      <span className="home-row-date">{rail}</span>
      <span className="home-row-body">
        <span className="home-row-title">
          <Link to={to}>{title}</Link>
        </span>
        {summary ? <span className="home-row-summary">{summary}</span> : null}
      </span>
    </li>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const jsonLd = [personJsonLd(SITE_ORIGIN), webSiteJsonLd(SITE_ORIGIN)];
  const { posts, featured, recent, papers, paperCount, discovery, podcast } = loaderData;

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
              <span className="p-job-title">{SITE.role}</span>
              <span>{SITE.department}</span>
              <span className="p-org">{SITE.affiliation}</span>
            </p>
            <a className="u-url" href="/" hidden>
              {SITE.name}
            </a>
          </section>

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

        <Section id="research" title="Research" more={<Link to="/research">All research</Link>}>
          <p className="home-research-line">I study viral genomics.</p>
          <ul className="home-rows">
            {RESEARCH_AREAS.map((area) => (
              <Row
                key={area.to}
                rail="Area"
                to={area.to}
                title={area.label}
                summary={area.description}
              />
            ))}
            <Row rail="Current" to={AVIAN.to} title={AVIAN.label} summary={AVIAN.description} />
          </ul>
        </Section>

        <Section
          id="publications"
          title="Publications"
          more={<Link to="/research/publications">All {paperCount} papers</Link>}
        >
          <ol className="home-rows">
            {papers.map((paper) => (
              <Row
                key={paper.id}
                rail={paper.year}
                to={paper.href}
                title={paper.title}
                summary={paper.journal}
              />
            ))}
          </ol>
        </Section>

        <Section
          id="lab"
          title="Lab resources"
          more={<Link to="/research/protocols">All protocols</Link>}
        >
          <ul className="home-rows">
            {LAB_RESOURCES.map((item) => (
              <Row
                key={item.to}
                rail={item.rail}
                to={item.to}
                title={item.label}
                summary={item.description}
              />
            ))}
          </ul>
        </Section>

        <Section id="teaching" title="Teaching" more={<Link to="/teaching">All teaching</Link>}>
          <ul className="home-rows">
            <Row
              rail="SEA-PHAGES"
              to="/teaching/phage-discovery"
              title="Phage Discovery Program"
              summary={
                `The two-semester undergraduate research program in HHMI SEA-PHAGES: ` +
                `${discovery.researchers} student researchers in ${discovery.cohorts} cohorts ` +
                `since ${discovery.since}.`
              }
            />
          </ul>
        </Section>

        {featured ? (
          <Section id="writing" title="Writing" more={<Link to="/writing">All {posts} posts</Link>}>
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
                      <Link className="u-url" to={`/writing/${post.slug}`}>
                        {post.title}
                      </Link>
                    </span>
                    {post.description ? (
                      <span className="home-row-summary home-row-clamp p-summary">
                        {post.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        <Section id="software" title="Software" more={<Link to="/software">All software</Link>}>
          <ul className="home-rows">
            {SOFTWARE_PRODUCTS.map((product) => (
              <Row
                key={product.to}
                rail="Product"
                to={product.to}
                title={product.label}
                summary={product.description}
              />
            ))}
          </ul>
        </Section>

        <HomePodcast episode={podcast} />

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
