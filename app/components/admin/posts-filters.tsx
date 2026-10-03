import { Form, Link } from "react-router";
import { Select } from "capsomer/react/select";
import { TabsNav } from "capsomer/react/tabs";

import { TabLink } from "~/components/admin/tab-link";

import { FILTER_KEYS, postsHref } from "~/lib/admin/posts-filters";

import type { Route } from "../../routes/+types/admin.posts._index";

type Listing = Route.ComponentProps["loaderData"];

const STATUS_TABS = [
  { key: "all", value: "", label: "All" },
  { key: "published", value: "published", label: "Published" },
  { key: "draft", value: "draft", label: "Drafts" },
  { key: "scheduled", value: "scheduled", label: "Scheduled" },
] as const;

/** The status tabs, then the search box and the tag facet as one GET form. */
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
    <>
      <TabsNav aria-label="Filter by status" variant="line">
        {STATUS_TABS.map((tab) => (
          <TabLink
            key={tab.label}
            to={postsHref({ ...filters, status: tab.value })}
            current={filters.status === tab.value}
            count={statusCounts[tab.key]}
            // The count in words: a bare numeral names no unit.
            aria-label={`${tab.label}, ${statusCounts[tab.key]} post${statusCounts[tab.key] === 1 ? "" : "s"}`}
          >
            {tab.label}
          </TabLink>
        ))}
      </TabsNav>

      {/* The submit button keeps the tag facet usable with scripting off. */}
      <Form method="get" action="/admin/posts" role="search" className="app-filters">
        <div className="cap-field">
          <label className="cap-field-label" htmlFor="posts-q">
            Search titles and slugs
          </label>
          <input
            id="posts-q"
            className="cap-input"
            type="search"
            name={FILTER_KEYS.q}
            defaultValue={filters.q}
            placeholder="Search titles and slugs"
          />
        </div>
        <div className="cap-field">
          <label className="cap-field-label" htmlFor="posts-tag">
            Tag
          </label>
          <Select
            id="posts-tag"
            name={FILTER_KEYS.tag}
            native
            defaultValue={filters.tag}
            options={[{ value: "", label: "Any tag" }, ...tagOptions.map((tag) => ({ value: tag, label: tag }))]}
          />
        </div>
        {/* Shown, never hidden: a focusable control nobody can see fails 2.4.7, and a select that
            submitted on change would move the page under a keyboard user (3.2.2). */}
        <button type="submit" className="cap-btn">
          Apply
        </button>
        {/* A link, not a reset button: `reset` restores the form's defaults, which are the current filters. */}
        {filtered ? (
          <Link to="/admin/posts" className="cap-btn" data-variant="quiet">
            Clear
          </Link>
        ) : null}
      </Form>
    </>
  );
}
