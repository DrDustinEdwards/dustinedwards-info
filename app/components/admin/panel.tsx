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
  children,
}: {
  title: string;
  description?: string;
  result?: SourceResult<unknown>;
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
      </header>
      {children}
    </section>
  );
}

/** Marks a panel as live, stubbed or failed, based on its SourceResult. */
export function SourceChip({ result }: { result: SourceResult<unknown> }) {
  if (result.status === "live") {
    return <span className="chip chip-live">live</span>;
  }
  if (result.status === "error") {
    return (
      <span className="chip chip-error" title={result.message}>
        error
      </span>
    );
  }
  return (
    <span className="chip" title={result.note}>
      stubbed
    </span>
  );
}

export function StatusDot({ status }: { status: HealthStatus }) {
  return <span className="status-dot" data-status={status} aria-hidden="true" />;
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
