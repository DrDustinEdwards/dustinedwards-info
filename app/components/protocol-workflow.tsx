import { Signs } from "~/components/signs";
import type { workflowContext } from "~/kb/procedures/library.mjs";

/**
 * Where a protocol sits in the phage workflow: the stage, the protocols before and after it, and the calculators used at
 * that stage. Drawn from the same context the markdown twin lists (app/kb/procedures/library.mjs), with no script: the
 * protocols either side are the way back and the way on, as signs. Nothing renders for a protocol outside the workflow.
 */
export function ProtocolWorkflow({ context }: { context: ReturnType<typeof workflowContext> }) {
  if (!context) return null;
  return (
    <section className="procedure-workflow" aria-label="In the phage workflow">
      <p className="procedure-workflow-stage">
        In the phage workflow: <strong>{context.stage}</strong>
      </p>
      <Signs
        label="Protocols either side"
        prev={context.before.map((p) => ({ ...p, label: "Before this" }))}
        next={context.after.map((p) => ({ ...p, label: "After this" }))}
      />
      {context.tools.length > 0 ? (
        <dl className="procedure-workflow-links">
          <dt>Calculators</dt>
          <dd>
            {context.tools.map((t) => (
              <a key={t.id} href={t.href}>
                {t.label}
              </a>
            ))}
          </dd>
        </dl>
      ) : null}
    </section>
  );
}
