import { Enhance } from "~/components/enhance";
import { StepCalculators } from "~/components/phage-tool";
import { ProcedurePrimers } from "~/components/procedure-primers";
import { ProtocolProof } from "~/components/protocol-proof";
import { ProtocolWorkflow } from "~/components/protocol-workflow";
import type { resolveProof } from "~/kb/procedures/proof.mjs";
import type { workflowContext } from "~/kb/procedures/library.mjs";
import { bibtex, citationText, citeFacts, versionPath } from "~/kb/procedures/cite.mjs";
import { sheetQr } from "~/kb/procedures/qr.mjs";
import { fillQuantities, fixedSectionIds, reagentSource, type ProcedureRecord } from "~/kb/procedures/render.mjs";
import { keyResources, type KeyResourceGroup } from "~/kb/procedures/key-resources.mjs";
import { SITE, SITE_ORIGIN } from "~/lib/seo";
import { formatNumber, formatQuantity, parseNumber } from "~/kb/procedures/marks.mjs";

/**
 * Every procedure page is drawn by these components from its D1 record (docs/PROCEDURES.md): the page,
 * and its printable sheet. The HTML fragments in the record were rendered from the repository's file by
 * the site's own pipeline, with the URL allowlist applied, so they are set as HTML here as a post's are.
 */

type Section = ProcedureRecord["sections"][number];
type Block = Section["blocks"][number];
type Step = Extract<Block, { type: "steps" }>["steps"][number];

const html = (value: string | null | undefined) => ({ __html: value ?? "" });

/** The words for the materials section, by profile. */
function materialsHeading(record: ProcedureRecord) {
  if (record.profile === "recipe") return "Ingredients";
  if (record.profile === "computational") return "Software and data";
  return "Reagents";
}

/** A heading with the same autolink markup the pipeline gives prose headings. */
function Heading({ id, level = 2, children }: { id: string; level?: 2 | 3; children: string }) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id}>
      {children}
      <a className="heading-anchor" aria-label={`Link to section: ${children}`} href={`#${id}`}>
        #
      </a>
    </Tag>
  );
}

/**
 * "20 µl" scaled to the reader's count: a protocol amount written per unit of its scale (per tube) is
 * multiplied by the count; any other amount is shown as written.
 */
function total(amount: string | null, per: string | null, record: ProcedureRecord, count: number) {
  if (!amount || !record.scale || per !== record.scale.unit) return null;
  const m = /^(\d[\d,]*(?:\.\d+)?)(?: to (\d[\d,]*(?:\.\d+)?))? ?(.*)$/.exec(amount);
  if (!m) return null;
  const min = parseNumber(m[1] ?? "");
  const max = m[2] ? parseNumber(m[2]) : null;
  if (min === null) return null;
  const range = max !== null ? `${formatNumber(min * count)} to ${formatNumber(max * count)}` : formatNumber(min * count);
  return m[3] ? `${range} ${m[3]}` : range;
}

export function ProcedureFacts({ record }: { record: ProcedureRecord }) {
  const facts: Array<[string, React.ReactNode]> = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") facts.push([label, String(value)]);
  };
  add("Version", record.version);
  add("Updated", record.updated);
  add("First used", record.firstUsed);
  add("Last run", record.lastRun);
  add("Status", record.status);
  add("Biosafety level", record.biosafetyLevel);
  add("Servings", record.servings);
  add("Prep time", record.prepTime);
  add("Cook time", record.cookTime);
  add("Total time", record.time.total);
  add("Hands-on time", record.time.handsOn);
  add("Cuisine", record.cuisine);
  add("Category", record.category);
  if (record.diet.length) add("Diet", record.diet.join(", "));
  // The strains are the lab registry's, so each name links to its record.
  if (record.hostStrains.length > 0) {
    facts.push([
      "Host strain",
      record.hostStrains.map((s, i) => (
        <span key={s.id}>
          {i > 0 ? "; " : null}
          <a href={s.path}>{s.name}</a>
        </span>
      )),
    ]);
  }
  if (record.biosafety) {
    add(
      "Agent",
      [record.biosafety.organism, record.biosafety.strain, record.biosafety.atcc ? `ATCC ${record.biosafety.atcc}` : null]
        .filter(Boolean)
        .join(", "),
    );
  }
  if (facts.length === 0) return null;
  return (
    <dl className="procedure-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The scaling form: a plain GET, so it works with script off and the state lives in the URL, where an
 * agent reading the page sees the same numbers as a person.
 */
function ScaleForm({ record, count, action }: { record: ProcedureRecord; count: number; action: string }) {
  if (record.profile === "recipe" && record.servings) {
    return (
      <form className="procedure-scale" method="get" action={action}>
        <label>
          Servings <input name="servings" type="number" min={1} max={1000} step="any" defaultValue={count} />
        </label>
        <button type="submit">Scale</button>
      </form>
    );
  }
  if (record.profile === "protocol" && record.scale) {
    return (
      <form className="procedure-scale" method="get" action={action}>
        <label>
          {record.scale.unit === "tube" ? "Tubes" : `Count (${record.scale.unit})`}{" "}
          <input name="n" type="number" min={1} max={1000} step={1} defaultValue={count} />
        </label>
        <button type="submit">Scale</button>
      </form>
    );
  }
  return null;
}

/** Where a registry reagent comes from: its supplier and catalog number linked to the product, or the lab's recipe for it. */
function ReagentSource({ reagent }: { reagent: NonNullable<ProcedureRecord["materials"][number]["reagent"]> }) {
  const source = reagentSource(reagent);
  return source.href ? <a href={source.href}>{source.text}</a> : <>{source.text}</>;
}

/** The protocol's Equipment as a table: its own words for each item, and who makes it where the registry says. */
/**
 * The Key Resources Table (key-resources.mjs): every strain, reagent, primer and item of equipment the protocol names, with
 * where it comes from and its identifier, grouped as STAR Methods groups them. Drawn from the record, so it never disagrees
 * with the tables above it.
 */
export function KeyResourcesTable({ groups }: { groups: KeyResourceGroup[] }) {
  return (
    <div className="table-scroll">
      <table className="procedure-materials procedure-key-resources">
        <thead>
          <tr>
            <th scope="col">Reagent or resource</th>
            <th scope="col">Source</th>
            <th scope="col">Identifier</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.id}>
            <tr>
              <th scope="colgroup" colSpan={3}>
                {group.heading}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={`${group.id}:${row.resource}`}>
                <th scope="row">
                  {row.href ? <a href={row.href}>{row.resource}</a> : row.resource}
                  {row.sequence ? (
                    <>
                      {" "}
                      <code className="procedure-key-sequence">{row.sequence}</code>
                    </>
                  ) : null}
                </th>
                <td>{row.source}</td>
                <td>{row.identifier}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export function EquipmentTable({ record }: { record: ProcedureRecord }) {
  const hasMaker = record.equipment.some((e) => e.item);
  const hasRotor = record.equipment.some((e) => e.item && (e.item.rotor || e.item.rotorGap));
  const hasNote = record.equipment.some((e) => e.noteHtml);
  return (
    <div className="table-scroll">
      <table className="procedure-materials procedure-equipment">
        <thead>
          <tr>
            <th scope="col">Equipment</th>
            {hasMaker ? <th scope="col">Manufacturer</th> : null}
            {hasRotor ? <th scope="col">Rotor</th> : null}
            {hasNote ? <th scope="col">Notes</th> : null}
          </tr>
        </thead>
        <tbody>
          {record.equipment.map((e) => (
            <tr key={e.name}>
              <th scope="row">{e.name}</th>
              {hasMaker ? <td>{e.item ? (e.item.manufacturer ?? "Not recorded") : ""}</td> : null}
              {hasRotor ? <td>{e.item?.rotor ?? (e.item?.rotorGap ? "Not recorded" : "")}</td> : null}
              {hasNote ? <td>{e.noteHtml ? <span dangerouslySetInnerHTML={html(e.noteHtml)} /> : null}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MaterialsTable({ record, count, factor }: { record: ProcedureRecord; count: number; factor: number }) {
  const showTotal = record.profile === "protocol" && record.scale !== null && record.materials.some((m) => m.per === record.scale?.unit);
  const hasStock = record.materials.some((m) => m.stock.length > 0);
  const hasFinal = record.materials.some((m) => m.final);
  const hasVersion = record.materials.some((m) => m.version);
  // Where each reagent of the lab registry comes from, in one column, drawn from the registry's record.
  const hasSource = record.materials.some((m) => m.reagent);
  const hasKind = record.profile === "computational";
  const unitWord = record.scale ? `${count} ${record.scale.unit}${count === 1 ? "" : "s"}` : "";
  return (
    <div className="table-scroll" data-run-swap="materials">
      <table className="procedure-materials">
        <thead>
          <tr>
            <th scope="col">{record.profile === "recipe" ? "Ingredient" : record.profile === "computational" ? "Item" : "Reagent"}</th>
            {hasKind ? <th scope="col">Kind</th> : null}
            {hasVersion ? <th scope="col">Version</th> : null}
            {hasStock ? <th scope="col">Stock</th> : null}
            {hasFinal ? <th scope="col">Final</th> : null}
            <th scope="col">Amount</th>
            {showTotal ? <th scope="col">For {unitWord}</th> : null}
            {hasSource ? <th scope="col">Source</th> : null}
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {record.materials.map((m) => (
            <tr key={m.name} id={`material-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <th scope="row">
                {m.display}
                {m.group ? <span className="procedure-group"> ({m.group})</span> : null}
              </th>
              {hasKind ? <td>{m.kind}</td> : null}
              {hasVersion ? <td>{m.version}</td> : null}
              {hasStock ? <td>{m.stock.join(" or ")}</td> : null}
              {hasFinal ? <td>{m.final}</td> : null}
              <td>
                {m.amount
                  ? `${m.amount}${m.per ? ` per ${m.per}` : ""}`
                  : m.quantity
                    ? formatQuantity({ ...m.quantity, raw: "" }, factor)
                    : ""}
              </td>
              {showTotal ? <td>{total(m.amount, m.per, record, count) ?? ""}</td> : null}
              {hasSource ? <td>{m.reagent ? <ReagentSource reagent={m.reagent} /> : null}</td> : null}
              <td>
                {m.noteHtml ? <span dangerouslySetInnerHTML={html(m.noteHtml)} /> : null}
                {m.solution ? (
                  <>
                    {m.noteHtml ? " " : null}
                    <a href={`#solution-${m.solution}`}>Recipe below.</a>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Solutions({ record }: { record: ProcedureRecord }) {
  if (record.solutions.length === 0) return null;
  return (
    <>
      {record.solutions.map((s) => (
        <div key={s.id} className="procedure-solution" id={`solution-${s.id}`}>
          <h3>{s.name}</h3>
          <ul>
            {s.components.map((c) => (
              <li key={c.name}>
                {c.name}
                {c.final ? `, ${c.final} final` : ""}
                {c.amount ? `, ${c.amount}` : ""}
              </li>
            ))}
          </ul>
          {s.storage || s.shelfLife ? (
            <p className="procedure-solution-keep">
              {s.storage ? `Storage: ${s.storage}.` : null} {s.shelfLife ? `Shelf life: ${s.shelfLife}.` : null}
            </p>
          ) : null}
        </div>
      ))}
    </>
  );
}

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
}: {
  step: Step;
  factor: number;
  troubleshooting: ProcedureRecord["troubleshooting"];
  /** Keys this step's calculators apart from the same tool under another list's step 1. */
  scope?: string;
  brief?: boolean;
}) {
  return (
    <li value={step.number} className="procedure-step" data-step={step.number} data-timers={step.timers.length > 0 ? JSON.stringify(step.timers) : undefined}>
      <p className="procedure-step-text" data-run-swap="step" dangerouslySetInnerHTML={html(fillQuantities(step, factor))} />
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
      {step.commands.map((cmd, i) => (
        <div key={`cmd${i}`} className="procedure-command">
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
      ))}
      {step.photos.map((p) => (
        <img
          key={p.src}
          className="procedure-photo"
          src={p.src}
          alt={p.alt}
          loading="lazy"
          decoding="async"
          {...(p.width && p.height ? { width: p.width, height: p.height } : {})}
        />
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

function Steps({ steps, factor, record, scope }: { steps: Step[]; factor: number; record: ProcedureRecord; scope: string }) {
  return (
    <ol className="procedure-steps" start={steps[0]?.number ?? 1}>
      {steps.map((step) => (
        <StepItem key={step.number} step={step} factor={factor} troubleshooting={record.troubleshooting} scope={scope} />
      ))}
    </ol>
  );
}

export function TroubleshootingTable({ record }: { record: ProcedureRecord }) {
  return (
    <div className="table-scroll">
      <table className="procedure-trouble">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Problem</th>
            <th scope="col">Possible reason</th>
            <th scope="col">Solution</th>
          </tr>
        </thead>
        <tbody>
          {record.troubleshooting.map((row) => (
            <tr key={row.id} id={`trouble-${row.id}`}>
              <td>{row.step}</td>
              <td dangerouslySetInnerHTML={html(row.problem)} />
              <td dangerouslySetInnerHTML={html(row.reason)} />
              <td dangerouslySetInnerHTML={html(row.solution)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What a frozen version's page says when it is not the one the site is at: which version is, and where. `current` is
 * the procedure's live page, with its version (null when none is assigned); null when the procedure is no longer
 * published.
 */
export function VersionNotice({ record, current }: { record: ProcedureRecord; current: { path: string; version: string | null } | null }) {
  if (current && current.version === record.version) return null;
  const date = citeFacts(record)?.date;
  return (
    <p className="procedure-version-notice" role="note">
      This is version {record.version}
      {date ? <>, dated <time dateTime={date}>{date}</time></> : null}, kept as it was published.{" "}
      {current ? (
        <>
          {current.version ? <>The current version is version {current.version}: </> : <>The procedure has since moved on: </>}
          <a href={current.path}>read the current page</a>.
        </>
      ) : (
        <>The procedure is no longer on the site, so there is no current version.</>
      )}
    </p>
  );
}

/** What changed in each version, newest first. Nothing is drawn until the file writes a history. */
function VersionHistory({ record, basePath, frozen }: { record: ProcedureRecord; basePath: string; frozen: string[] }) {
  // A row compiled before histories existed has no `history` until the next sync rewrites it.
  if (!record.history?.length) return null;
  return (
    <section aria-labelledby="version-history">
      <Heading id="version-history">Version history</Heading>
      <ol className="procedure-history" reversed>
        {record.history.map((h) => (
          <li key={h.version}>
            <strong>{frozen.includes(h.version) ? <a href={versionPath(basePath, h.version)}>Version {h.version}</a> : <>Version {h.version}</>}</strong>,{" "}
            <time dateTime={h.date}>{h.date}</time>: <span dangerouslySetInnerHTML={html(h.summaryHtml)} />
            {h.doi ? (
              <>
                {" "}
                <a href={`https://doi.org/${h.doi}`}>doi:{h.doi}</a>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * How to cite this version, and the BibTeX for it. Drawn only for a version that has been assigned: a procedure with no
 * version cannot be cited, and a DOI is minted only for a version that is. The citation points at the version's frozen
 * copy, or its DOI once it has one. The Zenodo deposit metadata is not on the page; `npm run zenodo:metadata -- <slug>`
 * prints it from the same file.
 */
function CiteBlock({ record }: { record: ProcedureRecord }) {
  const facts = citeFacts(record);
  if (!facts) return null;
  const where = { origin: SITE_ORIGIN, creator: { name: SITE.name, affiliation: SITE.affiliation } };
  return (
    <section aria-labelledby="cite-this-procedure">
      <Heading id="cite-this-procedure">Cite this procedure</Heading>
      <p className="procedure-cite">{citationText(record, facts, where)}</p>
      <details className="procedure-bibtex">
        <summary>BibTeX</summary>
        <pre>
          <code>{bibtex(record, facts, where)}</code>
        </pre>
      </details>
    </section>
  );
}

function hasCalculators(record: ProcedureRecord) {
  return record.sections.some((section) =>
    section.blocks.some((block) => block.type === "steps" && block.steps.some((step) => step.calculators?.length)),
  );
}

/**
 * The whole procedure, as its page shows it. `count` is the reader's scale, `factor` the recipe multiplier.
 * `basePath` is the address the page is at: the procedure's own for the live page, its version's for a frozen copy,
 * so the scale form, run mode and the twin link stay on the version being read. `sheetPath` is the printable sheet's
 * address, null when the page has none. `frozen` lists the versions that have a frozen copy, which the history links.
 */
export function ProcedureView({
  record,
  count,
  factor,
  workflow = null,
  proof = null,
  basePath = record.path,
  sheetPath = `${record.path}/sheet`,
  frozen = [],
}: {
  record: ProcedureRecord;
  count: number;
  factor: number;
  workflow?: ReturnType<typeof workflowContext>;
  proof?: ReturnType<typeof resolveProof>;
  basePath?: string;
  sheetPath?: string | null;
  frozen?: string[];
}) {
  const [materialsId, equipmentId, primersId, troubleId, expectedId, limitsId, referencesId] = fixedSectionIds(record.profile);
  const keyGroups = keyResources(record);
  return (
    <div className="prose procedure" data-profile={record.profile} data-run-path={basePath} data-run-version={record.version ?? ""} data-run-title={record.title}>
      <ProcedureFacts record={record} />
      <p className="procedure-links">
        {sheetPath ? (
          <a href={`${sheetPath}${count && record.scale && count !== record.scale.count ? `?n=${count}` : ""}`}>
            Printable sheet
          </a>
        ) : null}
        <a href={`${basePath}.md`} type="text/markdown">
          Markdown
        </a>
      </p>
      <ProtocolWorkflow context={workflow} />
      {record.image ? (
        <img
          className="procedure-image"
          src={record.image.src}
          alt={record.image.alt}
          {...(record.image.width && record.image.height ? { width: record.image.width, height: record.image.height } : {})}
        />
      ) : null}
      <div dangerouslySetInnerHTML={html(record.introHtml)} />

      <section aria-labelledby={materialsId}>
        <Heading id={materialsId!}>{materialsHeading(record)}</Heading>
        <ScaleForm record={record} count={count} action={basePath} />
        <MaterialsTable record={record} count={count} factor={factor} />
        <Solutions record={record} />
        {record.substitutions.length ? (
          <>
            <h3>Substitutions</h3>
            <ul>
              {record.substitutions.map((s) => (
                <li key={s.for}>
                  For {s.for}, use {s.use}
                  {s.noteHtml ? (
                    <>
                      : <span dangerouslySetInnerHTML={html(s.noteHtml)} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {record.primers.length ? (
        <section aria-labelledby={primersId}>
          <Heading id={primersId!}>Primers</Heading>
          <ProcedurePrimers record={record} />
        </section>
      ) : null}

      {record.equipment.length ? (
        <section aria-labelledby={equipmentId}>
          <Heading id={equipmentId!}>Equipment</Heading>
          <EquipmentTable record={record} />
        </section>
      ) : null}

      {keyGroups.length ? (
        <section aria-labelledby="key-resources">
          <Heading id="key-resources">Key resources</Heading>
          <KeyResourcesTable groups={keyGroups} />
        </section>
      ) : null}

      {record.environmentHtml || record.prerequisites.length ? (
        <section aria-labelledby="environment">
          <Heading id="environment">Environment</Heading>
          <div dangerouslySetInnerHTML={html(record.environmentHtml)} />
          {record.prerequisites.length ? (
            <ul>
              {record.prerequisites.map((p) => (
                <li key={p} dangerouslySetInnerHTML={html(p)} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {record.sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id}>
          <Heading id={section.id}>{section.title}</Heading>
          {section.blocks.map((block, i) =>
            block.type === "prose" ? (
              <div key={i} dangerouslySetInnerHTML={html(block.html)} />
            ) : (
              <Steps key={i} steps={block.steps} factor={factor} record={record} scope={`${section.id}-${i}-`} />
            ),
          )}
        </section>
      ))}

      {record.troubleshooting.length ? (
        <section aria-labelledby={troubleId}>
          <Heading id={troubleId!}>Troubleshooting</Heading>
          <TroubleshootingTable record={record} />
        </section>
      ) : null}

      {record.expectedResultsHtml ? (
        <section aria-labelledby={expectedId}>
          <Heading id={expectedId!}>Expected results</Heading>
          <div dangerouslySetInnerHTML={html(record.expectedResultsHtml)} />
        </section>
      ) : null}

      {record.limitationsHtml ? (
        <section aria-labelledby={limitsId}>
          <Heading id={limitsId!}>Limitations</Heading>
          <div dangerouslySetInnerHTML={html(record.limitationsHtml)} />
        </section>
      ) : null}

      <ProtocolProof proof={proof} />

      <VersionHistory record={record} basePath={record.path} frozen={frozen} />
      <CiteBlock record={record} />
      {hasCalculators(record) ? <Enhance module="tools" /> : null}

      <section aria-labelledby={referencesId}>
        <Heading id={referencesId!}>References</Heading>
        {record.basedOn.length ? (
          <>
            <h3 id="based-on">Based on</h3>
            <ul className="procedure-credits">
              {record.basedOn.map((s) => (
                <li key={s.citation}>
                  {s.doi ? <a href={`https://doi.org/${s.doi}`}>{s.citation}</a> : s.url ? <a href={s.url}>{s.citation}</a> : s.citation}
                  : {s.for}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {record.references.length ? (
          <>
            <h3 id="cited">Cited</h3>
            <ul className="procedure-references">
              {record.references.map((r, i) => (
                <li key={i} dangerouslySetInnerHTML={html(r)} />
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}

/** The bench sheet: the method without the reasoning, compact enough to print and work from. */
export function ProcedureSheet({
  record,
  count,
  factor,
  address,
}: {
  record: ProcedureRecord;
  count: number;
  factor: number;
  /** What the sheet prints and its QR code opens: the address of the version on it (`sheetAddress`). */
  address: string;
}) {
  // The sheet carries the version id and its date, so a printed copy says which version it is.
  const facts = citeFacts(record);
  const stamp = facts
    ? `Version ${facts.version}, ${facts.date}`
    : [record.version ? `Version ${record.version}` : "Version not yet assigned", record.updated ? `updated ${record.updated}` : null]
        .filter(Boolean)
        .join(", ");
  return (
    <article className="procedure-sheet prose">
      <header className="procedure-sheet-head">
        <h1>{record.title}</h1>
        <p>
          {stamp}. {address}
        </p>
        <figure className="procedure-sheet-qr">
          <div role="img" aria-label={`QR code for ${address}`} dangerouslySetInnerHTML={html(sheetQr(address))} />
          <figcaption>Scan to open this version online.</figcaption>
        </figure>
      </header>
      <ProcedureFacts record={record} />
      <h2>{materialsHeading(record)}</h2>
      <MaterialsTable record={record} count={count} factor={factor} />
      <Solutions record={record} />
      {record.equipment.length ? (
        <>
          <h2>Equipment</h2>
          <p>{record.equipment.map((e) => e.name).join("; ")}</p>
        </>
      ) : null}
      {record.primers.length ? (
        <>
          <h2>Primers</h2>
          <ProcedurePrimers record={record} brief />
        </>
      ) : null}
      {record.sections.map((section) => {
        const lists = section.blocks.filter((b): b is Extract<Block, { type: "steps" }> => b.type === "steps");
        if (lists.length === 0) return null;
        return (
          <section key={section.id}>
            <h2>{section.title}</h2>
            {lists.map((block, i) => (
              <ol key={i} className="procedure-steps" start={block.steps[0]?.number ?? 1}>
                {block.steps.map((step) => (
                  <StepItem key={step.number} step={step} factor={factor} troubleshooting={record.troubleshooting} brief />
                ))}
              </ol>
            ))}
          </section>
        );
      })}
      {record.troubleshooting.length ? (
        <>
          <h2>Troubleshooting</h2>
          <TroubleshootingTable record={record} />
        </>
      ) : null}
    </article>
  );
}
