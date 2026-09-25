import { Link } from "react-router";

import type { Route } from "../routes/+types/blog.$slug";

/** The published posts that link here, re-checked against live rows by the loader. */
export function PostBacklinks({
  backlinks,
}: {
  backlinks: Route.ComponentProps["loaderData"]["post"]["backlinks"];
}) {
  return (
    <nav className="post-backlinks" aria-labelledby="backlinks-heading">
      <p id="backlinks-heading">Linked from</p>
      <ul>
        {backlinks.map((item) => (
          <li key={item.slug}>
            <Link to={`/blog/${item.slug}`}>{item.title}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
