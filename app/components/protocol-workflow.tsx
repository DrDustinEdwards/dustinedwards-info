import type { workflowContext } from "~/kb/procedures/library.mjs";

/**
 * Where a protocol sits in the phage workflow: the stage, the protocols before and after it, and the calculators used at
 * that stage. Drawn from the same context the markdown twin lists (app/kb/procedures/library.mjs), as plain links, so it
 * works with no script. Nothing renders for a protocol outside the workflow.
 */
export function ProtocolWorkflow({ context }: { context: ReturnType<typeof workflowContext> }) {
  if (!context) return null;
  return (
    <nav className="procedure-workflow" aria-label="In the phage workflow">
      <p className="procedure-workflow-stage">
        In the phage workflow: <strong>{context.stage}</strong>
      </p>
      <dl className="procedure-workflow-links">
        {context.before.length > 0 ? (
          <>
            <dt>Before this</dt>
            <dd>
              {context.before.map((p) => (
                <a key={p.href} href={p.href}>
                  {p.title}
                </a>
              ))}
            </dd>
          </>
        ) : null}
        {context.after.length > 0 ? (
          <>
            <dt>After this</dt>
            <dd>
              {context.after.map((p) => (
                <a key={p.href} href={p.href}>
                  {p.title}
                </a>
              ))}
            </dd>
          </>
        ) : null}
        {context.tools.length > 0 ? (
          <>
            <dt>Calculators</dt>
            <dd>
              {context.tools.map((t) => (
                <a key={t.id} href={t.href}>
                  {t.label}
                </a>
              ))}
            </dd>
          </>
        ) : null}
      </dl>
    </nav>
  );
}
