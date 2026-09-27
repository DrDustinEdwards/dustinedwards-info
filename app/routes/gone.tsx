import { Link, data } from "react-router";

import { PageShell } from "~/components/page-shell";
import { SITE } from "~/lib/seo";

/**
 * What a removed WordPress address answers on the apex host: 410 Gone, which tells a search engine to
 * drop the URL rather than retry it as it would a 404, with somewhere for a person to go next. The
 * gateway renders this route for every removed path (app/lib/wordpress-redirects.mjs), so the address
 * bar keeps the old URL. No `headers` export: it stays uncached, and noindex keeps it out of results.
 */
export function loader() {
  return data(null, { status: 410 });
}

export function meta() {
  return [
    { title: `Page removed | ${SITE.name}` },
    { name: "robots", content: "noindex" },
  ];
}

export default function Gone() {
  return (
    <PageShell>
      <header className="page-head">
        <h1>This page was removed</h1>
        <p className="muted">
          It belonged to the old version of this site and is not coming back. The research, the
          protocols and the phages all have new homes.
        </p>
      </header>
      <ul>
        <li>
          <Link to="/research">Research</Link>: every area, protocol and publication, with a sentence
          on each.
        </li>
        <li>
          <Link to="/search">Search the site</Link> for what you were looking for.
        </li>
      </ul>
    </PageShell>
  );
}
