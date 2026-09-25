import type { SourceResult } from "~/lib/admin/types";

export function Panel({
  title,
  description,
  result,
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

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}
