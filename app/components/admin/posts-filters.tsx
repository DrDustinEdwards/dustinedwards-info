import { Form, Link } from "react-router";

import { FILTER_KEYS, postsHref } from "~/lib/admin/posts-filters";

import type { Route } from "../../routes/+types/admin.posts._index";

type Listing = Route.ComponentProps["loaderData"];

const STATUS_TABS = [
  { key: "all", value: "", label: "All" },
  { key: "published", value: "published", label: "Published" },
  { key: "draft", value: "draft", label: "Drafts" },
  { key: "scheduled", value: "scheduled", label: "Scheduled" },
] as const;

/** The search box, the status tabs and the tag facet, all one GET form. */
export function PostsFilters({
  filters,
  filtered,
  statusCounts,
  tagOptions,
}: {
  filters: Listing["filters"];
  filtered: boolean;
  statusCounts: Listing["statusCounts"];
  tagOptions: string[];
}) {
  return (
      /* The hidden submit keeps the tag facet usable with scripting off. */
      <Form method="get" action="/admin/posts" className="posts-filters" role="search">
        <label className="sr-only" htmlFor="posts-q">
          Search titles and slugs
        </label>
        <input
          id="posts-q"
          type="search"
          name={FILTER_KEYS.q}
          defaultValue={filters.q}
          placeholder="Search titles and slugs"
          className="posts-filter-input"
        />

        <nav className="posts-tabs" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => {
            const on = filters.status === tab.value;
            return (
              <Link
                key={tab.label}
                to={postsHref({ ...filters, status: tab.value })}
                aria-current={on ? "page" : undefined}
                className="posts-tab"
              >
                {tab.label}
                <span className="posts-tab-count" aria-hidden="true">
                  {statusCounts[tab.key]}
                </span>
                <span className="sr-only">
                  {`, ${statusCounts[tab.key]} post${statusCounts[tab.key] === 1 ? "" : "s"}`}
                </span>
              </Link>
            );
          })}
        </nav>

        <label className="sr-only" htmlFor="posts-tag">
          Tag
        </label>
        <select
          id="posts-tag"
          name={FILTER_KEYS.tag}
          defaultValue={filters.tag}
          className="posts-filter-select"
        >
          <option value="">Any tag</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        {/* Shown, never hidden: a focusable control nobody can see fails 2.4.7, and a select that
            submitted on change would move the page under a keyboard user (3.2.2). */}
        <button type="submit" className="btn-secondary posts-filter-submit">
          Apply
        </button>

        {/* A link, not a reset button: `reset` restores the form's defaults, which are the current filters. */}
        {filtered ? (
          <Link to="/admin/posts" className="btn-secondary posts-filter-clear">
            Clear
          </Link>
        ) : null}
      </Form>
  );
}
