import { Icon, Spec } from "~/components/playground-ui/specimen";

/** The Paper kit: the public components, built on the foundation. */
export function PaperKitSection() {
  return (
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
                  A title in the visited color
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
        note="Solid --paper, not glass, and it sits below the results: a reader who searched wants the results first and the offer to ask second."
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
  );
}
