import type { ReactNode } from "react";
import { Link, data } from "react-router";

import { ShellFooter } from "~/components/shell-footer";
import { HomeIntro } from "~/components/home-intro";
import { SiteHeader } from "~/components/site-header";
import { listHomeStartHere, nextScheduledPublishAt } from "~/db";
import { jsonLdText as serializeJsonLd } from "@drdustinedwards/site-helpers/xml";
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
  searchTitle,
} from "~/lib/seo";
import { PlateI, PlateKeyRow } from "~/components/plate-i";
import { Enhance } from "~/components/enhance";
import { HomePodcast } from "~/components/home-podcast";
import { homePodcastEpisode } from "~/lib/podcast/podcast.server";
import { listPublishedPublications } from "~/db/publications";
import { listRoster } from "~/db/roster";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { rosterFacts } from "~/lib/roster/compile.mjs";
import type { Publication } from "~/lib/publications/types";
import { RESEARCH_AREAS, SOFTWARE_PRODUCTS } from "~/lib/nav";
import type { Route } from "./+types/home";

import "~/styles/home.css";

/** Publicly cacheable; the theme is a cache-key dimension, not a Vary. The short edge policy is for the Germomics episode. */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return publicHtmlHeaders(cacheTags(), loaderHeaders.get(EDGE_CACHE_HEADER) ?? undefined);
}

export function meta() {
  return pageMeta({
    title: searchTitle(`${SITE.name}, ${SITE.role}`, ` at ${SITE.affiliation}`),
    socialTitle: `${SITE.name}, ${SITE.role} at ${SITE.affiliation}`,
    description: SITE.description,
    path: "/",
  });
}

/** How many papers the Publications section shows. */
const HOME_PAPERS = 3;

/**
 * The papers marked `selected` in their files (content/publications/), newest first; with none marked, the newest.
 * Chosen in the loader and not the component, so the publication records (abstracts, author lists)
 * stay out of the page's script.
 */
function homePapers(papers: Publication[]) {
  const newest = [...papers].sort(
    (a, b) => b.year - a.year || (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""),
  );
  const selected = newest.filter((p) => p.selected);
  /* Titles and journals go through `decodeEntities`: the deposited records carry HTML entities React would print literally. */
  return (selected.length > 0 ? selected : newest).slice(0, HOME_PAPERS).map((p) => ({
    id: p.id,
    year: p.year,
    title: decodeEntities(p.title),
    journal: p.journal ? decodeEntities(p.journal) : null,
    href: `/research/publications/${p.slug}/`,
  }));
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;

  const [start, podcast, nextPublishAt, papers, cohorts] = await Promise.all([
    timed(timings, "home_posts", () => listHomeStartHere(env, { timings })),
    timed(timings, "home_podcast", () => homePodcastEpisode(context)),
    timed(timings, "home_next_scheduled", () => nextScheduledPublishAt(env)),
    timed(timings, "home_papers", () => listPublishedPublications(env)),
    timed(timings, "home_roster", () => listRoster(env)),
  ]);

  return data(
    {
      posts: start.total,
      featured: start.featured,
      recent: start.recent,
      papers: homePapers(papers),
      paperCount: papers.length,
      // Counted from the roster table, never typed: a typed number drifts when a cohort lands. The names stay out of the payload.
      discovery: rosterFacts(cohorts),
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

/**
 * One numbered part of the home page, as the manual sets its parts (capsomer/manual.css .cap-part): number and
 * title on the left over a rule, a line beside it, a short list, and the link to the rest.
 */
function Section({
  id,
  no,
  title,
  lead,
  more,
  children,
}: {
  id: string;
  no: string;
  title: string;
  lead?: ReactNode;
  more: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cap-part home-section" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="cap-part-title">
        <span className="cap-part-no">{no}</span>
        {title}
      </h2>
      {lead ? <p className="cap-part-lead">{lead}</p> : null}
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
  const structuredData = [personJsonLd(SITE_ORIGIN), webSiteJsonLd(SITE_ORIGIN)];
  const { posts, featured, recent, papers, paperCount, discovery, podcast } = loaderData;

  return (
    <>
      <SiteHeader />
      <main className="tracks home-tracks" id="main" tabIndex={-1}>
        {/* `rel="me"` links live in the footer; only `u-url` needed a home here. No `u-photo`: the site publishes none. */}
        <div className="home-hero u-wide">
          <HomeIntro />

          {/* A boxed plate, as NASA numbered its photographic plates; the caption under the box. */}
          <figure className="cap-plate home-plate">
            <div className="cap-plate-box">
              <span className="cap-plate-no" aria-hidden="true">
                Plate I
              </span>
              <PlateI />
            </div>
            <figcaption className="cap-plate-caption">
              <span>
                <b>Plate I.</b> Plaque morphology, drawn.
              </span>
            </figcaption>
          </figure>
        </div>

        <PlateKeyRow />
        <Enhance module="plate" />

        {/* The work in figures, as the manual sets type on stepped grays (capsomer/manual.css form boxes, tones). */}
        <dl className="cap-form-boxes home-readings" data-variant="tones">
          <div className="cap-form-boxes-box">
            <dt>Papers</dt>
            <dd>{paperCount}</dd>
          </div>
          <div className="cap-form-boxes-box">
            <dt>Student researchers</dt>
            <dd>{discovery.researchers}</dd>
          </div>
          <div className="cap-form-boxes-box">
            <dt>Cohorts</dt>
            <dd>{discovery.cohorts}</dd>
          </div>
          <div className="cap-form-boxes-box">
            <dt>Posts</dt>
            <dd>{posts}</dd>
          </div>
        </dl>

        <Section
          id="research"
          no="1"
          title="Research"
          lead="I study viral genomics."
          more={<Link to="/research">All research</Link>}
        >
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
          no="2"
          title="Publications"
          lead={`${paperCount} papers on retroviruses, bacteriophages and science education.`}
          more={<Link to="/research/publications">All {paperCount} papers</Link>}
        >
          {/* A report's numbered references: number, year, title, the journal in the mono. */}
          <ol className="home-refs">
            {papers.map((paper) => (
              <li key={paper.id}>
                <span className="home-refs-year">{paper.year}</span>
                <span className="home-refs-body">
                  <Link to={paper.href}>{paper.title}</Link>
                  {paper.journal ? <span className="home-refs-journal">{paper.journal}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          id="lab"
          no="3"
          title="Lab resources"
          lead="The lab's protocols and calculators."
          more={<Link to="/research/protocols">All protocols</Link>}
        >
          {/* The procedures as an Apollo checklist card (capsomer/manual.css .cap-checklist). */}
          <div className="cap-checklist">
            <p className="cap-checklist-strip" aria-hidden="true">
              <span>Lab · Procedures</span>
              <span>{LAB_RESOURCES.length} cards</span>
            </p>
            <ol className="cap-checklist-items">
              {LAB_RESOURCES.map((item) => (
                <li key={item.to} className="cap-checklist-item">
                  <div className="cap-checklist-line">
                    <Link to={item.to}>{item.label}</Link>
                    <span className="cap-checklist-dots" aria-hidden="true" />
                    <span className="cap-checklist-kind">{item.rail}</span>
                  </div>
                  <p className="cap-checklist-note">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        <Section
          id="teaching"
          no="4"
          title="Teaching"
          lead={`${discovery.researchers} student researchers in ${discovery.cohorts} cohorts since ${discovery.since}.`}
          more={<Link to="/teaching">All teaching</Link>}
        >
          <ul className="home-rows">
            <Row
              rail="SEA-PHAGES"
              to="/teaching/phage-discovery"
              title="Phage Discovery Program"
              summary="The two-semester undergraduate research program in HHMI SEA-PHAGES."
            />
          </ul>
        </Section>

        {featured ? (
          <Section id="writing" no="5" title="Writing" more={<Link to="/writing">All {posts} posts</Link>}>
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

        <Section
          id="software"
          no="6"
          title="Software"
          lead="Products and the tools behind them."
          more={<Link to="/software">All software</Link>}
        >
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

        {structuredData.map((data, i) => (
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
