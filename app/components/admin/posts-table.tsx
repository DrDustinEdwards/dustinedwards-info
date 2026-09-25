import { Form, Link } from "react-router";

import { BulkTagControls } from "~/components/admin/bulk-tag-controls";
import { RowMenu } from "~/components/admin/row-menu";
import {
  CACHE_SENTENCE,
  READERSHIP_ABSENT,
  postReadershipPath,
} from "~/lib/admin/origin-requests.mjs";

import type { Route } from "../../routes/+types/admin.posts._index";

type Listing = Route.ComponentProps["loaderData"];

/** A browser pairs a button with its form by string equality alone, so a mismatch submits the wrong form silently. */
function rowFormId(intent: "duplicate" | "unpublish", slug: string) {
  return `row-${intent}-${slug}`;
}

/** The bulk bar, the posts table, each row's own forms and the read-count and search notes under it. */
export function PostsTable({
  posts,
  visible,
  chosen,
  allShown,
  setSelected,
  toggle,
  hydrated,
  pending,
  filtered,
  total,
  tagOptions,
  readership,
  askOn,
  ask,
  askUnread,
  budget,
  budgetError,
}: {
  posts: Listing["posts"];
  visible: string[];
  chosen: string[];
  allShown: boolean;
  setSelected: (slugs: string[]) => void;
  toggle: (slug: string) => void;
  hydrated: boolean;
  pending: boolean;
  filtered: boolean;
  total: number;
  tagOptions: string[];
  readership: Listing["readership"];
  askOn: boolean;
  ask: Listing["ask"];
  askUnread: boolean;
  budget: Listing["budget"];
  budgetError: Listing["budgetError"];
}) {
  /**
   * Three outcomes: a number, a measured zero, or an absence with a sentence. Never a dash, which
   * reads as zero.
   */
  const readershipFor = (slug: string): { count: number } | { absent: string } => {
    if (readership.status === "error") {
      return { absent: READERSHIP_ABSENT.source + readership.message };
    }
    const count = readership.data.byPath[postReadershipPath(slug)];
    if (typeof count === "number") return { count };
    // Absent from the result: under `complete` that is a measured zero; truncated means the query
    // never asked about this path.
    return readership.data.complete
      ? { count: 0 }
      : { absent: READERSHIP_ABSENT.truncated };
  };

  return (
        <div className="posts-card">
          {/* One Form around the bar and the table: a form cannot nest inside another. */}
          <Form method="post">
            {/* Always in the document, revealed by CSS `:has()`: client state would leave a scriptless operator ticking boxes with no control. */}
              <div className="posts-bulk" role="group" aria-label="Actions for the selected posts">
                {/* Script-only: "0 selected" above two ticked boxes is worse than no number. */}
                <p className="posts-bulk-count" aria-live="polite">
                  {hydrated ? `${chosen.length} selected` : "With the selected posts"}
                </p>

                <BulkTagControls listId="posts-bulk-tags" options={tagOptions} />
                <button
                  type="submit"
                  name="intent"
                  value="bulk-delete"
                  className="btn-secondary"
                >
                  Delete
                </button>
              </div>

            {/* `tabindex` and the region role make the scroll box reachable by keyboard. */}
            <div className="posts-table-scroll" tabIndex={0} role="region" aria-label="Posts table">
            <table className="posts-table" data-pending={pending || undefined} aria-busy={pending || undefined}>
              {/* `CACHE_SENTENCE` verbatim, as one string: React SSR splices comment nodes between adjacent text. */}
              <thead>
                <tr>
                  <th scope="col" className="posts-check">
                    <label className="posts-check-label">
                      <input
                        type="checkbox"
                        checked={allShown}
                        onChange={() => setSelected(allShown ? [] : visible)}
                      />
                      <span className="sr-only">
                        {filtered
                          ? `Select all ${visible.length} shown`
                          : `Select all ${visible.length}`}
                      </span>
                    </label>
                  </th>
                  <th scope="col" className="posts-title-cell">Title</th>
                  <th scope="col">Published</th>
                  {/* "Reads counted", never "views" or "traffic": a cached read never reaches the Worker. */}
                  <th scope="col" className="posts-readership">Reads counted</th>
                  <th scope="col" className="posts-row-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.slug} data-selected={chosen.includes(post.slug) || undefined}>
                    <td className="posts-check">
                      <label className="posts-check-label">
                        <input
                          type="checkbox"
                          name="slug"
                          value={post.slug}
                          checked={chosen.includes(post.slug)}
                          onChange={() => toggle(post.slug)}
                        />
                        <span className="sr-only">Select {post.title}</span>
                      </label>
                    </td>
                    <td className="posts-title-cell">
                    <span className="posts-title-row">
                      <Link to={`/admin/posts/${post.slug}/edit`} className="posts-title">
                        {post.title}
                      </Link>
                      {/* A word first; color and border-style separate the three again under forced-colors. */}
                      <span className="status-pill" data-state={post.state}>
                        {post.state}
                      </span>
                      {post.featured ? <span className="posts-featured">Featured</span> : null}
                    </span>
                    <span className="posts-slug">/{post.slug}</span>
                  </td>
                  <td className="posts-date">
                    {post.publishAt
                      ? new Date(post.publishAt).toISOString().slice(0, 10)
                      : "not set"}
                    {post.scheduledInDays !== null ? (
                      <span className="posts-date-relative">
                        in {post.scheduledInDays} day{post.scheduledInDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
                  <td className="posts-readership">
                    {(() => {
                      const value = readershipFor(post.slug);
                      return "count" in value ? (
                        <span className="posts-readership-count">
                          {value.count.toLocaleString()}
                        </span>
                      ) : (
                        // The reason is content, not a tooltip: a `title` is invisible to touch and to some screen readers.
                        <span className="posts-readership-absent">{value.absent}</span>
                      );
                    })()}
                  </td>
                  <td className="posts-row-actions">
                    {/* Associated by the `form` attribute: this cell is inside the bulk form and forms cannot nest. */}
                    <RowMenu label={`Actions for ${post.title}`}>
                      <Link
                        to={`/admin/posts/${post.slug}/edit`}
                        className="row-menu-item"
                        data-menu-item
                      >
                        Edit
                      </Link>
                      {post.state === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="row-menu-item"
                          data-menu-item
                        >
                          View on the site
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                      {post.state === "published" || post.state === "scheduled" ? (
                        <button
                          type="submit"
                          form={rowFormId("unpublish", post.slug)}
                          name="intent"
                          value="unpublish"
                          className="row-menu-item"
                          data-menu-item
                        >
                          Unpublish
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        form={rowFormId("duplicate", post.slug)}
                        name="intent"
                        value="duplicate"
                        className="row-menu-item"
                        data-menu-item
                      >
                        Duplicate
                      </button>
                    </RowMenu>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            </div>
          </Form>

          {/* Outside the bulk form: forms cannot nest. The slug is a field, not the button's value, or the intents would grow per post. */}
          {posts.map((post) => (
            <Form
              key={`duplicate-${post.slug}`}
              id={rowFormId("duplicate", post.slug)}
              method="post"
              className="posts-row-form"
            >
              <input type="hidden" name="slug" value={post.slug} />
            </Form>
          ))}
          {posts
            .filter((post) => post.state === "published" || post.state === "scheduled")
            .map((post) => (
              <Form
                key={`unpublish-${post.slug}`}
                id={rowFormId("unpublish", post.slug)}
                method="post"
                className="posts-row-form"
              >
                <input type="hidden" name="slug" value={post.slug} />
              </Form>
            ))}

          {/* A disclosure, not a `<caption>`, which screen readers announce before every row. */}
          <details className="posts-explain">
            <summary>What the read count includes, and what it misses</summary>
            <p>
              {readership.status === "live"
                ? `Only reads that reached the server, over the last ${readership.data.windowDays} days, sampling weighted. ` +
                  CACHE_SENTENCE
                : `Read counts could not be loaded: ${readership.message} ` + CACHE_SENTENCE}
            </p>
          </details>

          {filtered || askOn ? (
            <p className="posts-meta">
              {filtered ? `Showing ${posts.length} of ${total} posts. ` : null}
              {ask ? `Search has read ${ask.present} of ${ask.expected} posts.` : null}
              {askUnread ? "The search index status could not be read." : null}
              {askOn ? " " : null}
              {budget
                ? `Budget ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
                : null}
              {budgetError ? `The Ask budget could not be read: ${budgetError}` : null}
            </p>
          ) : null}
        </div>
  );
}
