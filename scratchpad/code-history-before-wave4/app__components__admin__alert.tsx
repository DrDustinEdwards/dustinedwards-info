/**
 * A standing condition the operator has to act on, with the action that fixes
 * it attached to it.
 *
 * The role is the point. `role="alert"` and `role="status"` are LIVE regions:
 * they exist to interrupt with something that just happened, and assistive tech
 * announces them on insertion. Ask index drift is not an event, it is a state
 * the site is in, rendered into the first byte of HTML on every visit to this
 * page. Announcing it as news on each load would be wrong twice over, once
 * because it is not news and once because a reader who arrived to do something
 * else gets interrupted by it. The drift notice carried `role="status"` before
 * this and did exactly that.
 *
 * So it is a named region instead: `<section>` with an accessible name is a
 * `region` landmark, which puts it in the landmark list where a screen reader
 * user can find it on purpose, and leaves it silent until they do. The heading
 * names it and the glyph plus the words carry the meaning, so rule 1 holds
 * without the tint being asked to say anything on its own.
 */
export function AdminAlert({
  title,
  headingId,
  children,
  action,
}: {
  title: string;
  headingId: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="admin-alert" aria-labelledby={headingId}>
      <svg
        className="admin-alert-glyph"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <div className="admin-alert-body">
        <h3 className="admin-alert-title" id={headingId}>
          {title}
        </h3>
        {children}
      </div>
      {action ? <div className="admin-alert-action">{action}</div> : null}
    </section>
  );
}
