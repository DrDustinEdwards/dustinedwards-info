import { Link, useLocation } from "react-router";

import { SearchForm } from "~/components/search-form";
import { NAV } from "~/lib/nav";
import { notFoundQuery } from "~/lib/not-found-query.mjs";
// `?url` and in-body links, not module imports: the root error boundary renders this, and a module
// import there would put the search page's sheets on every page of the site.
import blogSearchCssUrl from "~/styles/blog-search.css?url";
import searchPageCssUrl from "~/styles/search-page.css?url";

/**
 * Somewhere to go from a 404, for a reader who came in on an old link: the site search, started
 * with the words of the missing address, and the header's own sections. The sections are NAV, so
 * this list follows the header and is never a second copy of it. No script: the form is a plain GET.
 */
export function NotFoundHelp() {
  const { pathname } = useLocation();
  return (
    <>
      {/* No `precedence`: React would lift the sheets above the color-scheme meta. */}
      <link rel="stylesheet" href={searchPageCssUrl} />
      <link rel="stylesheet" href={blogSearchCssUrl} />
      <SearchForm defaultValue={notFoundQuery(pathname)} />
      <nav aria-labelledby="not-found-sections">
        <h2 id="not-found-sections">Or start from a section</h2>
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
