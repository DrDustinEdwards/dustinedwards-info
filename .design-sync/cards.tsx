/**
 * THE COMPONENT PREVIEW CARDS, rendered from the site's own components and class names.
 *
 * `build-cards.mjs` server-renders each `body` below, once per theme, into a self-contained card
 * that loads the synced `styles.css` and nothing else. So a card shows what the CODE draws, not a
 * drawing of it: the header, footer, evidence row, plate and podcast player are the real
 * components, and the rows, headings, links and figure are the home and post routes' own markup
 * with their own classes. The approved reference these match is the design system project's
 * `templates/visual-system/`; where a card and that page differ, the site differs, and the fix
 * belongs in the site (ruling 143).
 *
 * WHAT IS SAMPLE AND WHAT IS NOT. Text inside a row, the evidence facts and the podcast episode are
 * sample content, the same sample the reference uses, because a card has no database. The markup
 * around them, and every style, is the site's.
 *
 * NO SCRIPT RUNS IN A CARD. The enhancement bundles are stripped, so a card shows the markup the
 * server sends. The one exception is the podcast player, drawn in its enhanced state because that
 * is the state the reference approves; `ENHANCED` below is the transform, and it mirrors
 * `app/enhance/podcast.ts` rather than inventing a state.
 */

import { Link } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { FigurePapersPerYear } from "~/components/home-figures";
import { HomePodcast } from "~/components/home-podcast";
import { PlateI, PlateKeyRow } from "~/components/plate-i";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";

export type ComponentCard = {
  slug: string;
  title: string;
  /** The @dsCard viewport, when the card needs a width the default would not give it. */
  viewport?: string;
  body: () => React.ReactNode;
  /** A string transform on the rendered markup, for the one card drawn in its enhanced state. */
  enhance?: (html: string) => string;
};

/** The home route's main element, which several classes below are scoped by in practice. */
function HomeTracks({ children }: { children: React.ReactNode }) {
  return <main className="tracks home-tracks">{children}</main>;
}

const SAMPLE_ROWS = [
  {
    date: "2026-09-14",
    title: "Ten years on Cloudflare",
    summary: "What moved to Workers, D1 and R2, and what the bills and latencies did.",
  },
  {
    date: "2026-08-30",
    title: "Building a site that ships no framework",
    summary: "Server HTML first, with hand-written modules on top.",
  },
];

const SAMPLE_EPISODE = {
  guid: "sample",
  title: "Episode title, from the feed",
  link: "https://germomics.com/",
  publishedAt: "2026-09-09T12:00:00.000Z",
  durationSeconds: 2537,
  description:
    "The episode description from the feed, clamped to three lines. The rest is on the episode page and in the markup.",
  audioUrl: "https://germomics.com/sample.mp3",
  audioType: "audio/mpeg",
  season: 2,
  episode: 8,
};

/**
 * The podcast player as `app/enhance/podcast.ts` leaves it: the native controls off and the
 * scripted ones shown. Each replacement must land exactly once, so a renamed attribute fails the
 * build rather than drawing the scriptless player under an enhanced label.
 */
function enhancedPodcast(html: string): string {
  const once = (s: string, from: RegExp, to: string, what: string) => {
    const hits = s.match(new RegExp(from.source, "g"))?.length ?? 0;
    if (hits !== 1) throw new Error(`podcast card: expected one ${what}, found ${hits}`);
    return s.replace(from, to);
  };
  let out = once(html, /(<audio\b[^>]*?)\scontrols=""/, "$1", "audio with native controls");
  out = once(out, /(<div class="podcast-controls" data-podcast-controls="[^"]*")\shidden=""/, "$1", "hidden controls block");
  return out;
}

export const COMPONENT_CARDS: ComponentCard[] = [
  {
    slug: "header-desktop",
    title: "Header, desktop",
    viewport: "1200x320",
    body: () => <SiteHeader />,
  },
  {
    slug: "header-phone",
    title: "Header, phone",
    viewport: "375x320",
    body: () => <SiteHeader />,
  },
  {
    slug: "footer",
    title: "Footer",
    viewport: "1200x940",
    body: () => <ShellFooter />,
  },
  {
    slug: "section-heading",
    title: "Section heading and its rule",
    body: () => (
      <HomeTracks>
        <section className="home-research">
          <h2 className="home-section-heading">Research</h2>
          <p className="home-research-line">
            Retroviruses, bacteriophage genomics and science education.
          </p>
        </section>
      </HomeTracks>
    ),
  },
  {
    slug: "ruled-row",
    title: "Ruled row",
    body: () => (
      <HomeTracks>
        <section className="home-featured">
          <ol className="home-rows">
            {SAMPLE_ROWS.map((row) => (
              <li key={row.date} className="home-row h-entry">
                <span className="home-row-date">
                  <time className="dt-published" dateTime={row.date}>
                    {row.date}
                  </time>
                </span>
                <span className="home-row-body">
                  <span className="home-row-title p-name">
                    <Link className="u-url" to="/blog">
                      {row.title}
                    </Link>
                  </span>
                  <span className="home-row-summary p-summary">{row.summary}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="home-more">
            <Link to="/blog">All writing</Link>
          </p>
        </section>
      </HomeTracks>
    ),
  },
  {
    slug: "evidence-row",
    title: "Evidence row",
    body: () => (
      <HomeTracks>
        <EvidenceRow
          facts={[
            <Link to="/blog">48 posts</Link>,
            <Link to="/publications">31 publications</Link>,
            <span>cache hit 0.97 at 16:38 UTC</span>,
          ]}
          detail="The ratio was read at 16:38 UTC; this page is cached for 10 minutes."
        />
      </HomeTracks>
    ),
  },
  {
    slug: "links",
    title: "Links, both kinds",
    // Two mains, because each kind lives in a different page grid and one grid places the other's
    // parts out of source order.
    body: () => (
      <>
        <main className="tracks post-tracks">
          <article className="post post-body">
            <div className="prose">
              <p>
                In a paragraph: the site runs on <a href="/colophon">Workers, D1 and R2</a>, and
                the stack is on the <a href="/colophon">colophon</a>.
              </p>
            </div>
          </article>
        </main>
        <HomeTracks>
          <section className="home-featured">
            <ol className="home-rows">
              <li className="home-row">
                <span className="home-row-date">2026-09-14</span>
                <span className="home-row-body">
                  <span className="home-row-title">
                    <Link to="/blog">Ten years on Cloudflare</Link>
                  </span>
                </span>
              </li>
            </ol>
            <p className="home-more">
              <Link to="/blog">All writing</Link>
            </p>
          </section>
        </HomeTracks>
      </>
    ),
  },
  {
    slug: "figure-caption",
    title: "Figure with caption",
    body: () => (
      <HomeTracks>
        <figure className="home-figure">
          <FigurePapersPerYear />
          <figcaption className="home-figure-caption">
            <span className="home-figure-num">Figure 1</span> Papers per year. Rule height is the
            count; the dashed line is six.
          </figcaption>
        </figure>
      </HomeTracks>
    ),
  },
  {
    slug: "plate",
    title: "Plate drawing style",
    viewport: "1200x900",
    body: () => (
      <HomeTracks>
        <div className="home-hero u-wide">
          <figure className="home-plate">
            <PlateI />
            <figcaption className="home-plate-caption">
              <span className="home-plate-num">Plate I</span>
              <span className="home-plate-cap">Plaque morphology, drawn.</span>
            </figcaption>
          </figure>
        </div>
        <PlateKeyRow />
      </HomeTracks>
    ),
  },
  {
    slug: "podcast-player",
    title: "Podcast player",
    body: () => (
      <HomeTracks>
        <HomePodcast episode={SAMPLE_EPISODE} />
      </HomeTracks>
    ),
    enhance: enhancedPodcast,
  },
];
