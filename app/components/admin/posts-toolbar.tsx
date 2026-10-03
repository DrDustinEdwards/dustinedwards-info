import { Form, Link } from "react-router";

import { OverflowMenu } from "~/components/admin/overflow-menu";

/** New post, and the Maintenance menu: regenerate, sync Ask, reset the Ask budget. */
export function PostsToolbar() {
  return (
    <>
      <OverflowMenu label="Maintenance">
        <Form method="post">
          <button type="submit" name="intent" value="regenerate" className="cap-option" data-menu-item>
            <span className="cap-option-label">Regenerate all</span>
            <span className="cap-option-hint">Re-render every post from the repository</span>
          </button>
        </Form>
        {/* Kept here too: the drift alert renders only when the index is dirty, so this runs it pre-emptively. */}
        <Form method="post">
          <button type="submit" name="intent" value="sync-ask" className="cap-option" data-menu-item>
            <span className="cap-option-label">Sync Ask corpus</span>
            <span className="cap-option-hint">
              Upload every search record to the AI Search instance that powers Ask
            </span>
          </button>
        </Form>
        <Form method="post">
          <button type="submit" name="intent" value="reset-ask-budget" className="cap-option" data-menu-item>
            <span className="cap-option-label">Reset Ask budget</span>
            <span className="cap-option-hint">Clear today&rsquo;s Ask answer count</span>
          </button>
        </Form>
      </OverflowMenu>
      <Link to="/admin/posts/new" className="cap-btn" data-variant="primary">
        New post
      </Link>
    </>
  );
}
