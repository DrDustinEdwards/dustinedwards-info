import { Form, Link } from "react-router";
import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";
import { Pill, Status } from "capsomer/react/status";

import { BulkTagControls } from "~/components/admin/bulk-tag-controls";
import { RowMenu } from "~/components/admin/row-menu";

import type { Route } from "../../routes/+types/admin.posts._index";

type Listing = Route.ComponentProps["loaderData"];

/** A browser pairs a button with its form by string equality alone, so a mismatch submits the wrong form silently. */
function rowFormId(intent: "duplicate" | "unpublish", slug: string) {
  return `row-${intent}-${slug}`;
}

/** The bulk bar, the posts table, each row's own forms and the search notes under it. */
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
  askOn: boolean;
  ask: Listing["ask"];
  askUnread: boolean;
  budget: Listing["budget"];
  budgetError: Listing["budgetError"];
}) {
  const meta =
    filtered || askOn ? (
      <p className="cap-muted">
        {filtered ? `Showing ${posts.length} of ${total} posts. ` : null}
        {ask ? `Search has read ${ask.present} of ${ask.expected} posts.` : null}
        {askUnread ? "The search index status could not be read." : null}
        {askOn ? " " : null}
        {budget
          ? `Budget ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
          : null}
        {budgetError ? `The Ask budget could not be read: ${budgetError}` : null}
      </p>
    ) : undefined;

  return (
    <>
      <Panel title="Posts" count={posts.length} flush footer={meta}>
        {/* One Form around the bar and the table: a form cannot nest inside another. */}
        <Form method="post">
          {/* Always in the document: client state would leave a scriptless operator ticking boxes with no
              control. Hidden only once script runs and nothing is selected. */}
          <div
            className="cap-bulk"
            role="group"
            aria-label="Actions for the selected posts"
            hidden={hydrated && chosen.length === 0}
          >
            {/* Script-only: "0 selected" above two ticked boxes is worse than no number. */}
            <p className="cap-bulk-count" aria-live="polite">
              {hydrated ? `${chosen.length} selected` : "With the selected posts"}
            </p>
            <div className="cap-bulk-actions">
              <BulkTagControls listId="posts-bulk-tags" options={tagOptions} />
              <Button type="submit" name="intent" value="bulk-delete" variant="danger">
                Delete
              </Button>
            </div>
          </div>

          {/* `tabindex` and the region role make the scroll box reachable by keyboard. */}
          <div className="cap-table-wrap" tabIndex={0} role="region" aria-label="Posts table">
            <table className="cap-table" aria-busy={pending || undefined}>
              <thead>
                <tr>
                  <th scope="col">
                    <label className="cap-check">
                      <input
                        type="checkbox"
                        checked={allShown}
                        onChange={() => setSelected(allShown ? [] : visible)}
                      />
                      <span className="cap-sr-only">
                        {filtered ? `Select all ${visible.length} shown` : `Select all ${visible.length}`}
                      </span>
                    </label>
                  </th>
                  <th scope="col">Title</th>
                  <th scope="col">Published</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.slug} aria-selected={chosen.includes(post.slug) || undefined}>
                    <td>
                      <label className="cap-check">
                        <input
                          type="checkbox"
                          name="slug"
                          value={post.slug}
                          checked={chosen.includes(post.slug)}
                          onChange={() => toggle(post.slug)}
                        />
                        <span className="cap-sr-only">Select {post.title}</span>
                      </label>
                    </td>
                    <th scope="row">
                      <Link to={`/admin/posts/${post.slug}/edit`} className="cap-table-open">
                        {post.title}
                      </Link>
                      {/* A word first; shape and colour separate the three again under forced-colors. */}
                      <Status tone={STATE_TONE[post.state]}>{post.state}</Status>
                      {post.featured ? <Pill variant="outline">Featured</Pill> : null}
                      <span className="cap-table-aside">/{post.slug}</span>
                    </th>
                    <td>
                      {post.publishAt ? new Date(post.publishAt).toISOString().slice(0, 10) : "not set"}
                      {post.scheduledInDays !== null ? (
                        <span className="cap-table-aside">
                          in {post.scheduledInDays} day{post.scheduledInDays === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {/* Associated by the `form` attribute: this cell is inside the bulk form and forms cannot nest. */}
                      <RowMenu label={`Actions for ${post.title}`}>
                        <Link
                          to={`/admin/posts/${post.slug}/edit`}
                          className="cap-option"
                          data-menu-item
                        >
                          Edit
                        </Link>
                        {post.state === "published" ? (
                          <a
                            href={`/writing/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="cap-option"
                            data-menu-item
                          >
                            View on the site
                            <span className="cap-sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                        {post.state === "published" || post.state === "scheduled" ? (
                          <button
                            type="submit"
                            form={rowFormId("unpublish", post.slug)}
                            name="intent"
                            value="unpublish"
                            className="cap-option"
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
                          className="cap-option"
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
      </Panel>

      {/* Outside the bulk form: forms cannot nest. The slug is a field, not the button's value, or the intents would grow per post. */}
      {posts.map((post) => (
        <Form key={`duplicate-${post.slug}`} id={rowFormId("duplicate", post.slug)} method="post">
          <input type="hidden" name="slug" value={post.slug} />
        </Form>
      ))}
      {posts
        .filter((post) => post.state === "published" || post.state === "scheduled")
        .map((post) => (
          <Form key={`unpublish-${post.slug}`} id={rowFormId("unpublish", post.slug)} method="post">
            <input type="hidden" name="slug" value={post.slug} />
          </Form>
        ))}
    </>
  );
}

const STATE_TONE = { published: "ok", draft: "nodata", scheduled: "info" } as const;
