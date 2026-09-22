import type { HealthStatus, SourceResult } from "~/lib/admin/types";

/**
 * Panel is the frame every cockpit section renders inside: a title row with an
 * optional source chip, then whatever body the section needs. Sections stay
 * uniform without knowing about each other.
 */
export function Panel({
  title,
  description,
  result,
  /**
   * Controls that belong BESIDE the title rather than above the content. A page
   * whose primary action is a full-width row of its own spends a whole band of
   * vertical space saying "upload". An action is a thing you do TO the section, so it
   * belongs on the section heading.
   */
  actions,
  children,
}: {
  title: string;
  description?: string;
  result?: SourceResult<unknown>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {result ? <SourceChip result={result} /> : null}
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * THE THIRD BRANCH IS GONE with the `stub` arm it rendered, and its removal is
 * the point: a panel can no longer say "this data is not real", because no source
 * produces data that is not real. A `never` in the union is the typecheck refusing
 * to let one back in without a decision.
 */
function SourceChip({ result }: { result: SourceResult<unknown> }) {
  if (result.status === "live") {
    return <span className="chip chip-live">live</span>;
  }
  return (
    <span className="chip chip-error" title={result.message}>
      error
    </span>
  );
}

/**
 * Rule 1: color is never the only channel. The dot carries a shape per status
 * and the word rides alongside it, visually hidden. Before this the state reached
 * sighted readers as a hue and reached assistive tech not at all.
 */
export function StatusDot({ status }: { status: HealthStatus }) {
  return (
    <>
      <span className="status-dot" data-status={status} aria-hidden="true" />
      <span className="sr-only">{status}</span>
    </>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="card-grid">{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  status,
}: {
  label: string;
  value: string;
  hint?: string;
  status: HealthStatus;
}) {
  return (
    <article className="stat-card">
      <header>
        <span className="stat-card-label">{label}</span>
        <StatusDot status={status} />
      </header>
      <p className="stat-card-value">{value}</p>
      {hint ? <p className="stat-card-hint muted">{hint}</p> : null}
    </article>
  );
}

/** The uniform "no data yet" state a panel body shows before its source is wired. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}
