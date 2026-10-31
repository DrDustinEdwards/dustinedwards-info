import { Picture } from "~/components/picture";
import { StepCalculators } from "~/components/phage-tool";
import { fillQuantities, type ProcedureRecord } from "~/kb/procedures/render.mjs";
import { PLATFORMS } from "~/kb/procedures/parse.mjs";
import { gramsPerCup, ingredientNames, showQuantity, showTemperatures, stepId, stepIngredients, type UnitSystem } from "~/kb/procedures/recipe-views.mjs";
import { type Step, html } from "~/components/procedure-materials";
import { contentPicture } from "~/lib/media/images.mjs";

/* The procedure page's method (procedure.tsx): its steps, their flags and the commands they run. */

function Flag({ kind, label, children }: { kind: string; label: string; children: React.ReactNode }) {
  return (
    <div className={`procedure-flag procedure-flag-${kind}`} role="note">
      <strong className="procedure-flag-label">{label}</strong> {children}
    </div>
  );
}

export function StepItem({
  step,
  factor,
  troubleshooting,
  scope = "",
  brief = false,
  units = null,
  densities = null,
  names,
}: {
  step: Step;
  factor: number;
  troubleshooting: ProcedureRecord["troubleshooting"];
  /** Keys this step's calculators apart from the same tool under another list's step 1. */
  scope?: string;
  brief?: boolean;
  /** A recipe's units as the reader asked for them (recipe-views.mjs). */
  units?: UnitSystem | null;
  /** A recipe's grams per cup by ingredient; null for a protocol or a how-to, which list no ingredients under a step. */
  densities?: Map<string, number> | null;
  /** A recipe's words for each ingredient, as its ingredient list gives them. */
  names?: Map<string, string>;
}) {
  const show = (q: Parameters<NonNullable<Parameters<typeof fillQuantities>[2]>>[0]) => showQuantity(q, factor, units, densities?.get(q.name?.toLowerCase() ?? "") ?? null);
  const text = showTemperatures(fillQuantities(step, factor, densities ? show : undefined), units);
  // A recipe step lists what goes into it (R2), with the amounts the reader asked for.
  const ingredients = densities && !brief ? stepIngredients(step, factor, units, densities, names) : [];
  return (
    <li
      value={step.number}
      id={scope ? stepId(scope, step.number) : undefined}
      className="procedure-step"
      data-step={step.number}
      data-timers={step.timers.length > 0 ? JSON.stringify(step.timers) : undefined}
    >
      <p className="procedure-step-text" data-run-swap="step" dangerouslySetInnerHTML={html(text)} />
      {ingredients.length > 0 ? (
        <p className="procedure-step-ingredients">
          <span className="procedure-step-ingredients-label">Ingredients: </span>
          {ingredients.map((i) => (i.amount ? `${i.amount} ${i.name}` : i.name)).join(", ")}
        </p>
      ) : null}
      {step.spin.map((s) => (
        <Flag key={s} kind="spin" label="Spin:">
          {s}
        </Flag>
      ))}
      {step.critical.map((c, i) => (
        <Flag key={`c${i}`} kind="critical" label="Critical step.">
          <span dangerouslySetInnerHTML={html(c)} />
        </Flag>
      ))}
      {step.pause.map((p, i) => (
        <Flag key={`p${i}`} kind="pause" label="Pause point.">
          <span dangerouslySetInnerHTML={html(p)} />
        </Flag>
      ))}
      {step.expect.map((e, i) => (
        <Flag key={`e${i}`} kind="expect" label="Expected:">
          <span dangerouslySetInnerHTML={html(e)} />
        </Flag>
      ))}
      {commandGroups(step.commands).map((group, g) =>
        group.length === 1 && !group[0]!.platform ? (
          <Command key={`cmd${g}`} cmd={group[0]!} />
        ) : (
          <Platforms key={`cmd${g}`} group={group} id={`${scope ? stepId(scope, step.number) : `step-${step.number}`}-${g}`} brief={brief} />
        ),
      )}
      {step.photos.map((p) => (
        <Picture key={p.src} picture={contentPicture(p.src, { ...p, className: "procedure-photo" })} />
      ))}
      {brief
        ? null
        : (step.challenges ?? []).map((c, i) => (
            <div key={`ch${i}`} className="procedure-challenge" role="note">
              <strong className="procedure-flag-label">Challenge.</strong>
              <div dangerouslySetInnerHTML={html(c.html)} />
              {c.solutionHtml ? (
                <details className="procedure-solution">
                  <summary>Solution</summary>
                  <div dangerouslySetInnerHTML={html(c.solutionHtml)} />
                </details>
              ) : null}
            </div>
          ))}
      {/* A row compiled before calculators existed has no `calculators` until the next sync rewrites it. */}
      {brief || !step.calculators?.length ? null : <StepCalculators calculators={step.calculators} scope={`${scope}s${step.number}`} />}
      {brief
        ? null
        : step.why.map((w, i) => <div key={`w${i}`} className="procedure-why" dangerouslySetInnerHTML={html(w)} />)}
      {step.troubleshooting.length > 0 ? (
        <p className="procedure-step-trouble">
          Troubleshooting:{" "}
          {step.troubleshooting.map((id, i) => {
            const row = troubleshooting.find((r) => r.id === id);
            return (
              <span key={id}>
                {i > 0 ? ", " : ""}
                <a href={`#trouble-${id}`}>{(row?.problem ?? id).replace(/<[^>]+>/g, "")}</a>
              </span>
            );
          })}
        </p>
      ) : null}
    </li>
  );
}

type Cmd = Step["commands"][number];

/** A step's commands in runs: each run of blocks that name a platform is one set of tabs; any other block stands alone. */
function commandGroups(commands: Cmd[]) {
  const groups: Cmd[][] = [];
  for (const cmd of commands) {
    const last = groups[groups.length - 1];
    if (cmd.platform && last?.[0]?.platform) last.push(cmd);
    else groups.push([cmd]);
  }
  return groups;
}

function Command({ cmd }: { cmd: Cmd }) {
  return (
    <div className="procedure-command">
      <pre data-lang={cmd.lang || "text"}>
        <code>{cmd.code}</code>
      </pre>
      {cmd.output !== null ? (
        <>
          <p className="procedure-output-label">Expected output</p>
          <pre className="procedure-output">
            <code>{cmd.output}</code>
          </pre>
        </>
      ) : null}
    </div>
  );
}

const platformName = (p: string | null) => PLATFORMS[p as keyof typeof PLATFORMS] ?? p ?? "";

/**
 * One command for each platform (S4). With no script every block shows, under its name, and the tabs are links to them;
 * app/enhance/platforms.ts turns the links into tabs and remembers the reader's platform. The sheet lists them all.
 */
function Platforms({ group, id, brief }: { group: Cmd[]; id: string; brief: boolean }) {
  return (
    <div className="procedure-platforms" data-platforms="">
      {brief ? null : (
        <p className="procedure-platform-tabs">
          {group.map((cmd) => (
            <a key={cmd.platform} href={`#${id}-${cmd.platform}`} data-platform={cmd.platform ?? ""}>
              {platformName(cmd.platform)}
            </a>
          ))}
        </p>
      )}
      {group.map((cmd) => (
        <div key={cmd.platform} id={`${id}-${cmd.platform}`} className="procedure-platform" data-platform={cmd.platform ?? ""}>
          <p className="procedure-platform-label">{platformName(cmd.platform)}</p>
          <Command cmd={cmd} />
        </div>
      ))}
    </div>
  );
}

/** A list of short markdown lines under a heading: a tutorial's questions, objectives or key points (S2). */
export function Bullets({ id, title, items }: { id: string; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 id={id}>{title}</h3>
      <ul>
        {items.map((x, i) => (
          <li key={i} dangerouslySetInnerHTML={html(x)} />
        ))}
      </ul>
    </>
  );
}

export function Steps({ steps, factor, record, scope, units = null }: { steps: Step[]; factor: number; record: ProcedureRecord; scope: string; units?: UnitSystem | null }) {
  const densities = record.profile === "recipe" ? gramsPerCup(record) : null;
  const names = record.profile === "recipe" ? ingredientNames(record) : undefined;
  return (
    <ol className="procedure-steps" start={steps[0]?.number ?? 1}>
      {steps.map((step) => (
        <StepItem key={step.number} step={step} factor={factor} troubleshooting={record.troubleshooting} scope={scope} units={units} densities={densities} names={names} />
      ))}
    </ol>
  );
}
