// A named region, not role="alert" or "status": drift is a standing state, not an event,
// so it sits in the landmark list and stays silent until a screen reader user looks for it.
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
