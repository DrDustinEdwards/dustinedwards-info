import { PageContents } from "~/components/page-contents";
import { PageShell } from "~/components/page-shell";
import {
  ALL_FEATURES,
  FEATURES_PATH,
  PROGRAMS,
  SECTIONS,
  programCounts,
  programName,
} from "~/lib/features.mjs";
import { pageMeta, publicHtmlHeaders, type Trail } from "~/lib/seo";

// Route-scoped: the chips and the cards are Capsomer's.
import "capsomer/tokens.css";
import "capsomer/chips.css";
import "capsomer/panel.css";
import "~/styles/features.css";

/**
 * What the whole network does (Dustin, 2026-11-07), laid out as Foxhound's features page is: a row of chips that filter by
 * program, a contents list beside the sections, and a card for each thing a program does. The cards are in the HTML, so the
 * page is complete with script off; app/enhance/features.ts makes a chip hide the cards of the other programs (and the
 * sections left empty), and without it every card shows. The markdown twin (/features.md) is drawn from the same list.
 */
export function headers() {
  return publicHtmlHeaders();
}

const TITLE = "Features";
const TRAIL: Trail = [[TITLE, FEATURES_PATH]];

export function meta() {
  return pageMeta({
    title: `${TITLE} of the Dustin Edwards network`,
    description:
      "What this site and the programs behind it do: writing, pages and feeds, charts, design, AI agents, hosting and checks.",
    path: FEATURES_PATH,
    markdown: `${FEATURES_PATH}.md`,
    trail: TRAIL,
  });
}

const COUNTS = programCounts();

export default function FeaturesRoute() {
  return (
    <PageShell
      rail={
        <PageContents
          label="Sections"
          sections={SECTIONS.map((section) => ({ id: section.id, text: section.label }))}
        />
      }
    >
      <h1 className="page-title cap-layout-grid">{TITLE}</h1>
      <p className="features-lead">
        What this site and the programs behind it do, by job. Each card names the program that does
        it. For how this one site is built, see the <a href="/colophon">colophon</a>; for how the
        programs connect, the <a href="/systems">map of systems</a>.
      </p>

      <div className="features" data-feature-filter="all">
        <div
          className="cap-chips features-chips"
          data-variant="solid"
          role="group"
          aria-label="Show features of one program"
        >
          <button type="button" className="cap-chip" data-value="all" aria-pressed="true">
            All
            <span className="cap-chip-count">{ALL_FEATURES.length}</span>
          </button>
          {PROGRAMS.map((program) => (
            <button
              key={program.id}
              type="button"
              className="cap-chip"
              data-value={program.id}
              aria-pressed="false"
              title={program.what}
            >
              {program.name}
              <span className="cap-chip-count">{COUNTS[program.id] ?? 0}</span>
            </button>
          ))}
          <span className="cap-sr-only features-status" role="status" />
        </div>

        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="features-section"
            aria-labelledby={`${section.id}-title`}
            data-section
          >
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            <p className="features-intro">{section.intro}</p>
            <ul className="features-grid">
              {section.features.map((feature) => (
                <li
                  key={feature.name}
                  className="cap-panel features-card"
                  data-program={feature.program}
                >
                  <div className="cap-panel-body">
                    <p className="features-card-head">
                      <span className="features-card-name">{feature.name}</span>
                      <span className="features-card-tag">{programName(feature.program)}</span>
                    </p>
                    <p className="features-card-text">{feature.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="features-source">
        <a href={`${FEATURES_PATH}.md`}>Markdown</a>
      </p>
      <template data-island="features" />
    </PageShell>
  );
}
