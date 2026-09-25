const GLYPHS = {
  warning: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </>
  ),
};

// A named region, not role="alert" or "status": drift is a standing state, not an event,
// so it sits in the landmark list and stays silent until a screen reader user looks for it.
export function AdminAlert({
  tone,
  title,
  headingId,
  children,
  action,
}: {
  tone: keyof typeof GLYPHS;
  title: React.ReactNode;
  headingId: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="admin-notice" data-tone={tone} aria-labelledby={headingId}>
      <svg
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
        {GLYPHS[tone]}
      </svg>
      <div className="admin-notice-body">
        <h2 id={headingId}>{title}</h2>
        {children}
      </div>
      {action ? <div className="admin-notice-action">{action}</div> : null}
    </section>
  );
}
