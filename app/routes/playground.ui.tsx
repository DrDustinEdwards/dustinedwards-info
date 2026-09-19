import type { ReactNode } from "react";

import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { SITE, pageMeta, publicHtmlHeaders } from "~/lib/seo";

/* The swatch inventory, generated from app.css by build:tokens and held against
   it by check:contrast. A Worker cannot read a stylesheet. */
import tokenData from "../../content/tokens.json";

/* The code block in prose is the real prose sheet's, not a lookalike. */
import "~/styles/prose.css";
import "~/styles/playground-ui.css";

/**
 * The UI inventory: every component of the foundation, the Paper kit and the
 * Admin kit, in both themes and every state, plus one swatch per palette token.
 *
 * ## IT IS A FIXTURE, AND ITS CONTENTS ARE ITS COVERAGE
 *
 * Three gates measure composited pixels rather than token pairs, and a gate
 * that has nothing to photograph passes by not looking. So the page also
 * carries the three composites nowhere else has together: a roster photograph
 * under a caption scrim, a social card, and a code block inside prose.
 *
 * ## STATES ARE ATTRIBUTES BESIDE THE PSEUDO-CLASS
 *
 * Nothing can force :hover or :focus-visible in a screenshot. Every state rule
 * in the stylesheet carries a `data-demo` selector alongside the real one and
 * shares its declaration block, so a specimen cannot show a state the component
 * does not have.
 *
 * ## THE FORMS GO NOWHERE
 *
 * Every form here is a GET back to this page. The Admin kit's real actions are
 * POSTs to real endpoints, and a public page must not carry one.
 *
 * The header is rendered once, by the shell, because it is a page singleton.
 * Its two breakpoints are the capture widths, not two copies.
 */
export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `UI inventory | ${SITE.name}`,
    description:
      "Every component of the foundation, the Paper kit and the Admin kit, in both themes and " +
      "every state, with one swatch per palette token.",
    path: "/playground/ui",
  });
}

/** Ids are per panel: the same specimen renders twice and labels need targets. */
type Ids = (name: string) => string;

function Pair({ id, children }: { id: string; children: (ids: Ids) => ReactNode }) {
  return (
    <div className="pgui-pair">
      <div className="pgui pgui-panel" data-theme="light">
        <span className="pgui-panel-tag">Light</span>
        {children((name) => `${id}-l-${name}`)}
      </div>
      <div className="pgui pgui-panel" data-theme="dark">
        <span className="pgui-panel-tag">Dark</span>
        {children((name) => `${id}-d-${name}`)}
      </div>
    </div>
  );
}

function Spec({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: (ids: Ids) => ReactNode;
}) {
  return (
    <section className="pgui-spec" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{title}</h3>
      {note ? <p>{note}</p> : null}
      <Pair id={id}>{children}</Pair>
    </section>
  );
}

/** A labelled specimen, so a shot says which state it is showing. */
function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pgui-state">
      <span>{label}</span>
      {children}
    </div>
  );
}

/**
 * Lucide geometry, inline. No icon font and no sprite: a font fails to tofu and
 * a sprite is a second request for two lines of path.
 */
function Icon({ name, className = "icon" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

type IconName = keyof typeof ICONS;

const ICONS = {
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  "check-circle": (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m22 4-10 10.01-3-3" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
} as const;

/** One select, written once: the chevron is the kit's, not the platform's. */
function Select({ id, disabled }: { id: string; disabled?: boolean }) {
  return (
    <div className="select-wrap">
      <select className="field-input field-select" id={id} name="sort" disabled={disabled}>
        <option>Newest first</option>
        <option>Oldest first</option>
      </select>
      <Icon name="chevron-down" className="icon select-chevron" />
    </div>
  );
}

const HEALTH = [
  { cls: "hc-ok", name: "D1 database", pill: "pill-live", state: "Healthy", now: true },
  { cls: "hc-degraded", name: "R2 media", pill: "pill-held", state: "Slow", now: true },
  { cls: "hc-down", name: "Ask index", pill: "pill-gone", state: "Failing", now: true },
  { cls: "hc-unknown", name: "Watchdog", pill: "pill-draft", state: "No data", now: true },
  { cls: "hc-checking", name: "KV cache", pill: "pill-draft", state: "Checking", now: false },
] as const;

export default function PlaygroundUi() {
  return (
    <>
      <SiteHeader />
      <main className="pgui-page" id="main" tabIndex={-1}>
        <header className="pgui-intro">
          <h1>UI inventory</h1>
          <p>
            Every component of the foundation, the Paper kit and the Admin kit, rendered in both
            themes and in every state each one has. It is a fixture before it is a page: what is
            on it is what the browser and contrast gates can see.
          </p>
          <p>
            Hover, focus and active cannot be held open for a screenshot, so each of those
            specimens carries a <code>data-demo</code> attribute that shares one declaration
            block with the real pseudo-class. Every form on this page is a GET back to this page.
          </p>
        </header>

        <section className="pgui-section" aria-labelledby="foundation-h">
          <h2 id="foundation-h">Foundation</h2>
          <p>
            Eight primitives, identical on both planes. They are plain on purpose: the character
            of a public page comes from type and spacing, and each control is finished by the kit
            that hosts it.
          </p>

          <Spec
            id="btn-text"
            title="Button, text variant"
            note="The default everywhere. Its border is --line-strong, the only thing identifying it as a control."
          >
            {() => (
              <div className="pgui-row">
                <State label="Default">
                  <button type="button" className="btn">
                    Copy BibTeX
                  </button>
                </State>
                <State label="Hover">
                  <button type="button" className="btn" data-demo="hover">
                    Copy BibTeX
                  </button>
                </State>
                <State label="Focus">
                  <button type="button" className="btn" data-demo="focus">
                    Copy BibTeX
                  </button>
                </State>
                <State label="Active">
                  <button type="button" className="btn" data-demo="active">
                    Copy BibTeX
                  </button>
                </State>
                <State label="With an icon">
                  <button type="button" className="btn">
                    <Icon name="download" />
                    PDF
                  </button>
                </State>
                <State label="Disabled">
                  <button type="button" className="btn" disabled>
                    Copy BibTeX
                  </button>
                </State>
              </div>
            )}
          </Spec>

          <p className="pgui-note">
            A disabled control is identified by the attribute, by its recess and by text beside
            it saying why. The cursor is not a cue: it is pointer only, and it arrives after the
            reader has already tried. Here the reason is that there is no citation to copy yet.
          </p>

          <Spec
            id="btn-filled"
            title="Button, filled variant"
            note="One per page at most, on the page's single primary action. Disabled loses the purple entirely."
          >
            {() => (
              <div className="pgui-row">
                <State label="Default">
                  <button type="submit" className="btn btn-primary">
                    Send
                  </button>
                </State>
                <State label="Hover">
                  <button type="submit" className="btn btn-primary" data-demo="hover">
                    Send
                  </button>
                </State>
                <State label="Focus">
                  <button type="submit" className="btn btn-primary" data-demo="focus">
                    Send
                  </button>
                </State>
                <State label="Active">
                  <button type="submit" className="btn btn-primary" data-demo="active">
                    Send
                  </button>
                </State>
                <State label="Disabled">
                  <button type="submit" className="btn btn-primary" disabled>
                    Send
                  </button>
                </State>
              </div>
            )}
          </Spec>

          <Spec
            id="field"
            title="Text field"
            note="The label is always a real label with a for. Error is aria-invalid, so the visual state and the announced state cannot drift apart."
          >
            {(ids) => (
              <div className="pgui-stack">
                <div className="field">
                  <label className="field-label" htmlFor={ids("a")}>
                    Email
                  </label>
                  <input
                    className="field-input"
                    id={ids("a")}
                    name="email"
                    type="email"
                    defaultValue="jane@example.org"
                    aria-describedby={ids("a-hint")}
                  />
                  <p className="field-hint" id={ids("a-hint")}>
                    Used only to reply. Never published.
                  </p>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor={ids("b")}>
                    Email, placeholder and hover
                  </label>
                  <input
                    className="field-input"
                    id={ids("b")}
                    name="email"
                    type="email"
                    placeholder="you@example.org"
                    data-demo="hover"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor={ids("c")}>
                    Email, focus
                  </label>
                  <input
                    className="field-input"
                    id={ids("c")}
                    name="email"
                    type="email"
                    defaultValue="jane@example.org"
                    data-demo="focus"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor={ids("d")}>
                    Email, error
                  </label>
                  <input
                    className="field-input"
                    id={ids("d")}
                    name="email"
                    type="email"
                    defaultValue="jane.example.org"
                    aria-invalid="true"
                    aria-describedby={ids("d-err")}
                  />
                  <p className="field-error" id={ids("d-err")}>
                    <Icon name="alert-circle" className="icon icon-inline" />
                    Enter an address with an @ in it.
                  </p>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor={ids("e")}>
                    Email, disabled
                  </label>
                  <input
                    className="field-input"
                    id={ids("e")}
                    name="email"
                    type="email"
                    defaultValue="jane@example.org"
                    disabled
                    aria-describedby={ids("e-hint")}
                  />
                  <p className="field-hint" id={ids("e-hint")}>
                    Locked while the address is being verified.
                  </p>
                </div>
              </div>
            )}
          </Spec>

          <Spec
            id="select"
            title="Select, with its chevron"
            note="pointer-events:none on the chevron, or the square over the control swallows the click meant to open it. It is a currentColor stroke, so it survives forced-colors."
          >
            {(ids) => (
              <div className="pgui-stack">
                <div className="field">
                  <label className="field-label" htmlFor={ids("a")}>
                    Sort
                  </label>
                  <Select id={ids("a")} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={ids("b")}>
                    Sort, disabled
                  </label>
                  <Select id={ids("b")} disabled />
                  <p className="field-hint">One result, so there is nothing to order.</p>
                </div>
              </div>
            )}
          </Spec>

          <Spec id="textarea" title="Textarea" note="Twice the control height, and it resizes vertically only.">
            {(ids) => (
              <div className="pgui-stack">
                <div className="field">
                  <label className="field-label" htmlFor={ids("a")}>
                    Note
                  </label>
                  <textarea
                    className="field-input field-textarea"
                    id={ids("a")}
                    name="note"
                    rows={3}
                    defaultValue="The cocktail worked in vitro and failed in the mouse."
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={ids("b")}>
                    Note, error
                  </label>
                  <textarea
                    className="field-input field-textarea"
                    id={ids("b")}
                    name="note"
                    rows={3}
                    aria-invalid="true"
                    aria-describedby={ids("b-err")}
                    defaultValue=""
                  />
                  <p className="field-error" id={ids("b-err")}>
                    <Icon name="alert-circle" className="icon icon-inline" />
                    A note cannot be empty.
                  </p>
                </div>
              </div>
            )}
          </Spec>

          <Spec
            id="check"
            title="Checkbox"
            note="The 24px box meets 2.5.8 unaided; the 44px row is the enhanced target and is deliberate extra. The tick is two borders and a rotation."
          >
            {(ids) => (
              <div className="pgui-stack">
                <div className="check">
                  <input className="check-box" id={ids("a")} type="checkbox" />
                  <label className="check-label" htmlFor={ids("a")}>
                    Email me when a reply is posted
                  </label>
                </div>
                <div className="check">
                  <input className="check-box" id={ids("b")} type="checkbox" defaultChecked />
                  <label className="check-label" htmlFor={ids("b")}>
                    Checked
                  </label>
                </div>
                <div className="check">
                  <input className="check-box" id={ids("c")} type="checkbox" data-demo="hover" />
                  <label className="check-label" htmlFor={ids("c")}>
                    Hover
                  </label>
                </div>
                <div className="check">
                  <input className="check-box" id={ids("d")} type="checkbox" data-demo="focus" />
                  <label className="check-label" htmlFor={ids("d")}>
                    Focus
                  </label>
                </div>
                <div className="check">
                  <input className="check-box" id={ids("e")} type="checkbox" disabled />
                  <label className="check-label" htmlFor={ids("e")}>
                    Disabled, and the setting is off
                  </label>
                </div>
                <div className="check">
                  <input
                    className="check-box"
                    id={ids("f")}
                    type="checkbox"
                    defaultChecked
                    disabled
                  />
                  <label className="check-label" htmlFor={ids("f")}>
                    Disabled and checked, so the value is still readable
                  </label>
                </div>
              </div>
            )}
          </Spec>

          <Spec
            id="ring"
            title="Focus ring"
            note="One ring, one rule, every focusable element. It sits outside the control, so a focused error field shows both its doubled border and its ring."
          >
            {(ids) => (
              <div className="pgui-row">
                <State label="Link">
                  <a href="/playground/ui" data-demo="focus">
                    A link
                  </a>
                </State>
                <State label="Button">
                  <button type="button" className="btn" data-demo="focus">
                    A button
                  </button>
                </State>
                <State label="Field, focused and in error">
                  <input
                    className="field-input"
                    id={ids("a")}
                    aria-label="Focused and invalid"
                    aria-invalid="true"
                    data-demo="focus"
                    defaultValue="not an address"
                  />
                </State>
              </div>
            )}
          </Spec>

          <Spec
            id="icon"
            title="Icon"
            note="Lucide, inline, 20px at 1.5 stroke, always aria-hidden and always beside a label. There are no icon-only controls in this system."
          >
            {() => (
              <div className="pgui-row">
                <State label="download">
                  <Icon name="download" />
                </State>
                <State label="search">
                  <Icon name="search" />
                </State>
                <State label="alert-circle">
                  <Icon name="alert-circle" />
                </State>
                <State label="alert-triangle">
                  <Icon name="alert-triangle" />
                </State>
                <State label="check-circle">
                  <Icon name="check-circle" />
                </State>
                <State label="chevron-down">
                  <Icon name="chevron-down" />
                </State>
                <State label="In a button, taking its colour">
                  <button type="button" className="btn">
                    <Icon name="download" />
                    PDF
                  </button>
                </State>
              </div>
            )}
          </Spec>

          <Spec
            id="table"
            title="Table"
            note="Horizontal rules only, two weights, no zebra and no vertical rules. The scroll container is focusable and named, with role=group rather than region."
          >
            {(ids) => (
              <div className="table-scroll" tabIndex={0} role="group" aria-labelledby={ids("cap")}>
                <table className="table">
                  <caption className="table-caption" id={ids("cap")}>
                    Isolates per host species
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Host</th>
                      <th scope="col" className="table-num">
                        Isolates
                      </th>
                      <th scope="col" className="table-num">
                        Plaques
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">E. coli</th>
                      <td className="table-num">412</td>
                      <td className="table-num">1,905</td>
                    </tr>
                    <tr>
                      <th scope="row">K. pneumoniae</th>
                      <td className="table-num">96</td>
                      <td className="table-num">340</td>
                    </tr>
                    <tr>
                      <th scope="row">P. aeruginosa</th>
                      <td className="table-num">54</td>
                      <td className="table-num">211</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Spec>
        </section>

        <section className="pgui-section" aria-labelledby="paper-h">
          <h2 id="paper-h">The Paper kit</h2>
          <p>
            The public components. They consume the foundation and share nothing with the admin:
            a public chip is a link into a filtered index, and an admin pill is a read-only label.
          </p>

          <Spec
            id="skip"
            title="Skip link"
            note="Off-screen until focus and on-screen after, by translate alone. Not display:none and not visibility:hidden, either of which makes it unfocusable. Shown here in its focused position."
          >
            {() => (
              <div className="skip-stage">
                <a className="skip" href="#main">
                  Skip to content
                </a>
              </div>
            )}
          </Spec>

          <Spec
            id="post-card"
            title="Post card"
            note="Not a card: a rule beneath and space above. Only the title is a link, and it carries visited, which on an index of forty posts is the most useful state on the page."
          >
            {() => (
              <div>
                <article className="post-card">
                  <h4 className="post-card-title">
                    <a href="/playground/ui">Designing phage cocktails that hold</a>
                  </h4>
                  <p className="post-card-meta">
                    <time dateTime="2026-04-11">11 April 2026</time> · 9 min
                  </p>
                  <p className="post-card-excerpt">
                    Resistance shows up faster than the literature suggests, and the order you mix
                    in matters more than the count.
                  </p>
                  <ul className="tag-list">
                    <li>
                      <a className="tag" href="/playground/ui">
                        phage
                      </a>
                    </li>
                    <li>
                      <a className="tag" href="/playground/ui">
                        methods
                      </a>
                    </li>
                  </ul>
                </article>
                <article className="post-card">
                  <h4 className="post-card-title">
                    <a href="/playground/ui" data-demo="visited">
                      A title in the visited colour
                    </a>
                  </h4>
                  <p className="post-card-meta">
                    <time dateTime="2026-02-02">2 February 2026</time> · 4 min
                  </p>
                </article>
                <article className="post-card">
                  <h4 className="post-card-title">
                    <a href="/playground/ui" data-demo="hover">
                      A title under the pointer
                    </a>
                  </h4>
                  <p className="post-card-meta">
                    <time dateTime="2026-01-09">9 January 2026</time> · 6 min
                  </p>
                </article>
              </div>
            )}
          </Spec>

          <Spec
            id="pagination"
            title="Pagination"
            note="Two steps and a position, not a run of numbers. At the ends the unavailable step is absent rather than disabled: there is nothing to explain about the end of a list."
          >
            {() => (
              <nav className="pagination" aria-label="Pagination">
                <a className="pagination-step" href="/playground/ui" rel="prev">
                  <Icon name="chevron-left" />
                  Newer
                </a>
                <p className="pagination-pos">Page 3 of 7</p>
                <a className="pagination-step" href="/playground/ui" rel="next">
                  Older
                  <Icon name="chevron-right" />
                </a>
              </nav>
            )}
          </Spec>

          <Spec
            id="chips"
            title="Tag chip and filter chip"
            note="No fill on either. The current filter is marked four ways: aria-current=page, a strong weight, a thickened underline, and a border promoted from dust to line-strong."
          >
            {() => (
              <div className="pgui-stack">
                <ul className="tag-list">
                  <li>
                    <a className="tag" href="/playground/ui">
                      phage
                    </a>
                  </li>
                  <li>
                    <a className="tag" href="/playground/ui" data-demo="hover">
                      methods, hover
                    </a>
                  </li>
                  <li>
                    <a className="tag" href="/playground/ui" data-demo="focus">
                      cloudflare, focus
                    </a>
                  </li>
                </ul>
                <ul className="filter-list">
                  <li>
                    <a className="filter" href="/playground/ui">
                      All
                    </a>
                  </li>
                  <li>
                    <a className="filter" href="/playground/ui" aria-current="page">
                      Preprints
                    </a>
                  </li>
                  <li>
                    <a className="filter" href="/playground/ui">
                      Reviews
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </Spec>

          <Spec
            id="quote-code"
            title="Blockquote and code block"
            note="The quote is set in the body face at body weight: a long quote in italic is harder to read than the text around it. The code block's scroll container is focusable and named."
          >
            {(ids) => (
              <div>
                <blockquote className="quote">
                  <p>
                    The cocktail worked in vitro and failed in the mouse, which is the usual
                    order.
                  </p>
                  <footer className="quote-source">Lab notebook, March 2024</footer>
                </blockquote>
                <div className="code" tabIndex={0} role="group" aria-labelledby={ids("code")}>
                  <pre>
                    <code id={ids("code")}>
                      wrangler d1 execute dustinedwards --file=./schema.sql
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </Spec>

          <Spec
            id="toc"
            title="Table of contents"
            note="24px targets, not 44: dense text links in a list. The current section is static, set by the server or not at all; there is no scroll-spy."
          >
            {(ids) => (
              <nav className="toc" aria-labelledby={ids("h")}>
                <h4 className="toc-h" id={ids("h")}>
                  On this page
                </h4>
                <ol className="toc-list">
                  <li>
                    <a href="#main">Method</a>
                  </li>
                  <li>
                    <a href="#main" aria-current="true">
                      Results
                    </a>
                  </li>
                  <li>
                    <a href="#main">What failed</a>
                  </li>
                </ol>
              </nav>
            )}
          </Spec>

          <Spec
            id="post-nav"
            title="Previous and next"
            note="A two-column grid that collapses by auto-fit, with no media query. Each item shows the direction and the actual title."
          >
            {() => (
              <nav className="post-nav" aria-label="More writing">
                <a className="post-nav-item" href="/playground/ui" rel="prev">
                  <span className="post-nav-dir">Newer</span>
                  <span className="post-nav-title">Counting plaques by hand</span>
                </a>
                <a className="post-nav-item" href="/playground/ui" rel="next" data-demo="hover">
                  <span className="post-nav-dir">Older</span>
                  <span className="post-nav-title">What a titre actually tells you</span>
                </a>
              </nav>
            )}
          </Spec>

          <Spec
            id="crumb"
            title="Breadcrumb"
            note="The separator is a ::before, so it is not in the accessibility tree and is never read aloud. The current page is a span, not a link to itself."
          >
            {() => (
              <nav className="crumb" aria-label="Breadcrumb">
                <ol className="crumb-list">
                  <li>
                    <a href="/playground/ui">Writing</a>
                  </li>
                  <li>
                    <a href="/playground/ui">phage</a>
                  </li>
                  <li>
                    <span aria-current="page">Designing phage cocktails</span>
                  </li>
                </ol>
              </nav>
            )}
          </Spec>

          <Spec
            id="empty"
            title="Empty state"
            note="Two lines: what is not here, and where to go instead. No illustration, no icon, no apology."
          >
            {() => (
              <div className="empty">
                <p className="empty-line">
                  No posts tagged <b>cryo</b> yet.
                </p>
                <p className="empty-next">
                  <a href="/blog">All writing</a>
                </p>
              </div>
            )}
          </Spec>

          <Spec
            id="alert"
            title="Alerts"
            note="Accent and icon, never a tinted panel. The error is role=alert, which interrupts; warning and success are role=status, which waits for a pause."
          >
            {() => (
              <div>
                <div className="alert alert-error" role="alert">
                  <Icon name="alert-circle" />
                  <div className="alert-body">
                    <p className="alert-title">That message did not send.</p>
                    <p className="alert-detail">
                      The form timed out. Your text is still in the field.
                    </p>
                  </div>
                </div>
                <div className="alert alert-warning" role="status">
                  <Icon name="alert-triangle" />
                  <div className="alert-body">
                    <p className="alert-title">This draft has unsaved changes.</p>
                    <p className="alert-detail">Saving publishes nothing on its own.</p>
                  </div>
                </div>
                <div className="alert alert-success" role="status">
                  <Icon name="check-circle" />
                  <div className="alert-body">
                    <p className="alert-title">Saved.</p>
                    <p className="alert-detail">The post is still a draft.</p>
                  </div>
                </div>
              </div>
            )}
          </Spec>

          <Spec
            id="search"
            title="Search form and results"
            note="mark is restyled to weight and a thickened underline, not a highlight. Under forced-colors the system highlight comes back, because there it is the only distinction mark has."
          >
            {(ids) => (
              <div>
                <form className="search-form" method="get" action="/playground/ui" role="search">
                  <div className="field">
                    <label className="field-label" htmlFor={ids("q")}>
                      Search
                    </label>
                    <div className="search-field">
                      <input
                        className="field-input"
                        id={ids("q")}
                        name="q"
                        type="search"
                        defaultValue="phage cocktail"
                        autoComplete="off"
                      />
                      <button className="btn btn-primary" type="submit">
                        Search
                      </button>
                    </div>
                  </div>
                </form>
                <p className="search-count" role="status">
                  7 results for <b>phage cocktail</b>
                </p>
                <ol className="search-results">
                  <li className="search-result">
                    <h4 className="search-result-title">
                      <a href="/playground/ui">Designing phage cocktails that hold</a>
                    </h4>
                    <p className="search-result-where">Writing · 11 April 2026</p>
                    <p className="search-result-snippet">
                      resistance to a <mark>cocktail</mark> shows up faster than the literature
                      suggests
                    </p>
                  </li>
                  <li className="search-result">
                    <h4 className="search-result-title">
                      <a href="/playground/ui">What a titre actually tells you</a>
                    </h4>
                    <p className="search-result-where">Writing · 2 February 2026</p>
                    <p className="search-result-snippet">
                      a <mark>cocktail</mark> of three phages against one isolate
                    </p>
                  </li>
                </ol>
              </div>
            )}
          </Spec>

          <Spec
            id="ask"
            title="The Ask frame"
            note="Solid --raised, not glass, and it sits below the results: a reader who searched wants the results first and the offer to ask second."
          >
            {(ids) => (
              <section className="ask" aria-labelledby={ids("h")}>
                <h4 className="ask-h" id={ids("h")}>
                  Ask about this work
                </h4>
                <p className="ask-note">
                  Answers come from the pages on this site, with links to what they came from.
                </p>
              </section>
            )}
          </Spec>
        </section>

        <section className="pgui-section" aria-labelledby="admin-h">
          <h2 id="admin-h">The Admin kit</h2>
          <p>
            The authenticated plane, on the same palette and a denser grid. A row is a control
            here rather than a piece of reading, and the admin assumes script.
          </p>

          <Spec
            id="shell"
            title="Topbar and rail"
            note="The admin topbar is --raised with a rule beneath, never the purple chrome. The current rail item is marked by an inset brand bar, a surface change and weight."
          >
            {() => (
              <div className="admin">
                <div className="admin-topbar">
                  <a className="admin-brand" href="/playground/ui">
                    Admin
                  </a>
                  <p className="admin-context">dustinedwards.info</p>
                  <form method="get" action="/playground/ui">
                    <button className="btn" type="submit">
                      Sign out
                    </button>
                  </form>
                </div>
                <div className="admin-body">
                  <nav className="admin-rail" aria-label="Admin sections">
                    <a className="admin-rail-item" href="/playground/ui" aria-current="page">
                      Moderation <span className="admin-rail-count">12</span>
                    </a>
                    <a className="admin-rail-item" href="/playground/ui">
                      Posts
                    </a>
                    <a className="admin-rail-item" href="/playground/ui" data-demo="hover">
                      Publications
                    </a>
                    <a className="admin-rail-item" href="/playground/ui">
                      Health
                    </a>
                  </nav>
                  <div className="admin-main">
                    <p>The pending count sits in the rail, and it is why moderation is first.</p>
                  </div>
                </div>
              </div>
            )}
          </Spec>

          <Spec
            id="dt"
            title="Data table, three selected"
            note="The whole table is one form and each selection is a checkbox with a name, so the browser collects them with no script. Every checkbox has a real label naming its row."
          >
            {(ids) => (
              <form className="dt-form" method="get" action="/playground/ui">
                <div className="dt-bulk" role="group" aria-label="Actions for selected posts">
                  <p className="dt-bulk-count">3 selected</p>
                  <p className="sr-only" id={ids("live")} aria-live="polite">
                    3 posts selected
                  </p>
                  <button className="btn" type="submit" name="op" value="unpublish">
                    Unpublish
                  </button>
                  <button className="btn" type="submit" name="op" value="delete">
                    Delete
                  </button>
                </div>
                <table className="dt">
                  <thead>
                    <tr>
                      <th scope="col" className="dt-pick">
                        <input
                          className="check-box"
                          type="checkbox"
                          id={ids("all")}
                          defaultChecked
                        />
                        <label className="sr-only" htmlFor={ids("all")}>
                          Select all posts on this page
                        </label>
                      </th>
                      <th scope="col">Title</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="dt-num">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "412", title: "Designing phage cocktails that hold", pick: true },
                      { id: "413", title: "What a titre actually tells you", pick: true },
                      { id: "414", title: "Counting plaques by hand", pick: true },
                      { id: "415", title: "Ten years on Cloudflare", pick: false },
                      { id: "416", title: "A row under the pointer", pick: false, hover: true },
                    ].map((row) => (
                      <tr
                        className="dt-row"
                        key={row.id}
                        {...(row.pick ? { "data-selected": "" } : {})}
                        {...("hover" in row ? { "data-demo": "hover" } : {})}
                      >
                        <td className="dt-pick">
                          <input
                            className="check-box"
                            type="checkbox"
                            name="id"
                            value={row.id}
                            id={ids(row.id)}
                            defaultChecked={row.pick}
                          />
                          <label className="sr-only" htmlFor={ids(row.id)}>
                            Select {row.title}
                          </label>
                        </td>
                        <th scope="row" className="dt-title">
                          <a
                            href="/playground/ui"
                            {...("hover" in row ? { "data-demo": "hover" } : {})}
                          >
                            {row.title}
                          </a>
                        </th>
                        <td>
                          <span className="pill pill-live">Published</span>
                        </td>
                        <td className="dt-num">
                          <time dateTime="2026-04-11">11 Apr</time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </form>
            )}
          </Spec>

          <Spec
            id="dt-zero"
            title="Bulk bar at zero selected"
            note="The bar is always present, never revealed on selection. The buttons are hidden and the count is the explanation for their absence, so it is never removed and never hidden."
          >
            {(ids) => (
              <div className="dt-bulk" role="group" aria-label="Actions for selected posts">
                <p className="dt-bulk-count">0 selected</p>
                <p className="sr-only" id={ids("live")} aria-live="polite" />
                <button className="btn" type="button" name="op" value="unpublish" hidden>
                  Unpublish
                </button>
                <button className="btn" type="button" name="op" value="delete" hidden>
                  Delete
                </button>
              </div>
            )}
          </Spec>

          <Spec
            id="pill"
            title="Status pills"
            note="A span, never a link, with a dot that is currentColor. The word is the status and the colour confirms it."
          >
            {() => (
              <div className="pgui-row">
                <span className="pill pill-live">Published</span>
                <span className="pill pill-draft">Draft</span>
                <span className="pill pill-held">Held</span>
                <span className="pill pill-gone">Deleted</span>
              </div>
            )}
          </Spec>

          <Spec
            id="mq"
            title="Moderation queue row"
            note="Three actions, three forms, three URLs, and none of them a link: an action a crawler can follow is an action that eventually fires itself. Delete is the only one that looks different."
          >
            {() => (
              <ul className="mq-list">
                <li className="mq-row">
                  <div className="mq-meta">
                    <p className="mq-who">jane@example.org</p>
                    <p className="mq-where">
                      on <a href="/playground/ui">Designing phage cocktails</a> ·{" "}
                      <time dateTime="2026-09-12T08:14">12 Sep, 08:14</time>
                    </p>
                  </div>
                  <blockquote className="mq-text">
                    <p>Did you try the T4 panel against the clinical isolates?</p>
                  </blockquote>
                  <div className="mq-acts">
                    <form method="get" action="/playground/ui">
                      <button className="btn" type="submit">
                        Approve
                      </button>
                    </form>
                    <form method="get" action="/playground/ui">
                      <button className="btn" type="submit">
                        Reject
                      </button>
                    </form>
                    <form method="get" action="/playground/ui">
                      <button className="btn mq-delete" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              </ul>
            )}
          </Spec>

          <Spec
            id="hc"
            title="Health cards, five states"
            note="Unknown and checking share an accent: neither is a judgement about the service. Checking keeps the previous reading and relabels every fact as history."
          >
            {() => (
              <div className="pgui-stack">
                {HEALTH.map((card) => (
                  <article className={`hc ${card.cls}`} key={card.cls}>
                    <h4 className="hc-name">{card.name}</h4>
                    <p className="hc-state">
                      <span className={`pill ${card.pill}`}>{card.state}</span>
                    </p>
                    <dl className="hc-facts">
                      <div>
                        <dt>{card.now ? "p95" : "Last p95"}</dt>
                        <dd>38 ms</dd>
                      </div>
                      <div>
                        <dt>{card.now ? "Checked" : "Last checked"}</dt>
                        <dd>
                          <time dateTime="2026-09-13T09:02">09:02</time>
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </Spec>

          <Spec
            id="af"
            title="Admin form and editor toolbar"
            note="Labels above fields, one column, at the measure. Save is the page's one filled button. The toolbar's buttons are type=button, so a formatting action can never submit the form."
          >
            {(ids) => (
              <form className="af" method="get" action="/playground/ui">
                <div className="af-group">
                  <h4 className="af-group-h">Post</h4>
                  <div className="field">
                    <label className="field-label" htmlFor={ids("title")}>
                      Title
                    </label>
                    <input
                      className="field-input"
                      id={ids("title")}
                      name="title"
                      type="text"
                      defaultValue="Designing phage cocktails that hold"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={ids("slug")}>
                      Slug
                    </label>
                    <input
                      className="field-input af-mono"
                      id={ids("slug")}
                      name="slug"
                      type="text"
                      defaultValue="phage-cocktails"
                      aria-describedby={ids("slug-hint")}
                    />
                    <p className="field-hint" id={ids("slug-hint")}>
                      Changing this breaks existing links.
                    </p>
                  </div>
                </div>

                <div className="af-group">
                  <h4 className="af-group-h">Body</h4>
                  <div className="ed">
                    <div className="ed-tools" role="toolbar" aria-label="Formatting">
                      <button
                        className="btn ed-tool"
                        type="button"
                        aria-pressed="true"
                        data-cmd="bold"
                      >
                        Bold
                      </button>
                      <button
                        className="btn ed-tool"
                        type="button"
                        aria-pressed="false"
                        data-cmd="italic"
                      >
                        Italic
                      </button>
                      <button
                        className="btn ed-tool"
                        type="button"
                        aria-pressed="false"
                        data-cmd="link"
                      >
                        Link
                      </button>
                      <button
                        className="btn ed-tool"
                        type="button"
                        aria-pressed="false"
                        data-cmd="code"
                      >
                        Code
                      </button>
                    </div>
                    <label className="sr-only" htmlFor={ids("body")}>
                      Body
                    </label>
                    <textarea
                      className="field-input ed-area af-mono"
                      id={ids("body")}
                      name="body"
                      rows={6}
                      defaultValue={"## Method\n\nThe panel was assembled from four isolates.\n"}
                    />
                  </div>
                </div>

                <div className="af-actions">
                  <button className="btn btn-primary" type="submit" name="op" value="save">
                    Save
                  </button>
                  <button className="btn" type="submit" name="op" value="save-publish">
                    Save and publish
                  </button>
                </div>
              </form>
            )}
          </Spec>

          <Spec
            id="dlg"
            title="Admin dialog"
            note="The system's only modal, and it lives only here. The specimen is rendered open and in flow, because a public page runs no script to call showModal."
          >
            {(ids) => (
              <dialog className="dlg" open aria-labelledby={ids("h")}>
                <div className="dlg-in">
                  <h4 className="dlg-h" id={ids("h")}>
                    Delete this comment?
                  </h4>
                  <p className="dlg-body">
                    It is removed permanently. There is no undo and no trash.
                  </p>
                  <div className="dlg-acts">
                    <button className="btn" type="button">
                      Cancel
                    </button>
                    <button className="btn dlg-go" type="button">
                      Delete
                    </button>
                  </div>
                </div>
              </dialog>
            )}
          </Spec>
        </section>

        <section className="pgui-section" aria-labelledby="composite-h">
          <h2 id="composite-h">Composited pixels</h2>
          <p>
            Three things whose contrast is a property of the pixels rather than of a token pair.
            A gate that measures tokens alone cannot see any of them.
          </p>

          <figure className="pgui-shot">
            <img
              src="/phage-hunters/2024.webp"
              alt="The 2024 Phage Hunters cohort in the teaching lab."
              width={1200}
              height={800}
            />
            <figcaption>
              Phage Hunters, 2024. The caption scrim is opaque on purpose: fading it to
              transparent would make the photograph the backdrop, and the ratio would vary by
              image.
            </figcaption>
          </figure>

          <div className="pgui-og">
            <img
              src="/og-image.png"
              alt="The site's default social card: the mark, the site name and a gold rule."
              width={1200}
              height={630}
            />
          </div>

          <div className="prose">
            <h3>A code block inside prose</h3>
            <p>
              The block below is the prose sheet&rsquo;s, not a lookalike. A post&rsquo;s
              highlighted code carries its colours inline from the build, so what is measurable
              here is the block itself: mono type on the code surface, inside a run of body text.
            </p>
            <pre>
              <code>
                {"export function headers() {\n  return new Headers(publicHtmlHeaders());\n}"}
              </code>
            </pre>
            <p>
              The paragraph after it exists so the block has text on both sides, which is the
              arrangement a reader actually meets.
            </p>
          </div>
        </section>

        <section className="pgui-section" aria-labelledby="tokens-h">
          <h2 id="tokens-h">Palette tokens</h2>
          <p>
            One swatch per palette token, in both themes. The chip paints the live token and the
            hex beside it is the value read out of app.css when the list was generated, so a
            chip and its hex disagreeing is a fact the page shows rather than hides. A token that
            resolves to nothing paints no chip at all.
          </p>

          <h3>Light</h3>
          <ul className="pgui-swatches" data-theme="light">
            {tokenData.tokens.map((token) => (
              <li className="pgui-swatch" key={`l-${token.name}`}>
                <span className="pgui-swatch-chip" style={{ background: `var(${token.name})` }} />
                <span className="pgui-swatch-text">
                  <span className="pgui-swatch-name">{token.name}</span>
                  <span className="pgui-swatch-hex">{token.light}</span>
                </span>
              </li>
            ))}
          </ul>

          <h3>Dark</h3>
          <ul className="pgui-swatches" data-theme="dark">
            {tokenData.tokens.map((token) => (
              <li className="pgui-swatch" key={`d-${token.name}`}>
                <span className="pgui-swatch-chip" style={{ background: `var(${token.name})` }} />
                <span className="pgui-swatch-text">
                  <span className="pgui-swatch-name">{token.name}</span>
                  <span className="pgui-swatch-hex">{token.dark}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pgui-section" aria-labelledby="gaps-h">
          <h2 id="gaps-h">What is not on this page</h2>
          <p>
            Four things the handoffs name and this page does not draw. They are listed here
            rather than only in a report, because the page is the fixture and a gap nobody can
            see is a gap that gets built twice.
          </p>
          <ul>
            <li>
              <b>The overlay menu.</b> The Paper kit specified one and then deleted it: the
              header was restored on 14 September and the nav wraps instead of collapsing. There
              is no panel, no toggle and no state to close.
            </li>
            <li>
              <b>A photograph behind a fixed bar.</b> The header is static and in flow, so
              nothing scrolls behind it. The composite that remains is the caption scrim above,
              and that is the one measured here.
            </li>
            <li>
              <b>The publication entry.</b> The kit calls it a reference rather than a redraw. It
              ships on <a href="/publications">the publications page</a> with its microdata and
              its export links, and redrawing it here would make a second copy to drift.
            </li>
            <li>
              <b>The lamp on the search field.</b> The glass fill is legal on /search over paper
              and nowhere else, and the utility that applies it does not exist yet.
            </li>
          </ul>
        </section>

        {/* Room below the fold, so a capture can scroll the page rather than fit it. */}
        <div className="pgui-scroll-room" aria-hidden="true" />
      </main>
      <ShellFooter />
    </>
  );
}
