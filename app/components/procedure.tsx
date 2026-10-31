import { Picture } from "~/components/picture";
import { ProcedurePrimers } from "~/components/procedure-primers";
import { ProtocolProof } from "~/components/protocol-proof";
import { ProtocolWorkflow } from "~/components/protocol-workflow";
import type { resolveProof } from "~/kb/procedures/proof.mjs";
import type { workflowContext } from "~/kb/procedures/library.mjs";
import { bibtex, citationText, citeFacts, versionPath } from "~/kb/procedures/cite.mjs";
import { sheetQr } from "~/kb/procedures/qr.mjs";
import { fixedSectionIds, type ProcedureRecord } from "~/kb/procedures/render.mjs";
import type { Lineage } from "~/kb/procedures/lineage.mjs";
import { keyResources } from "~/kb/procedures/key-resources.mjs";
import { miseEnPlace, type UnitSystem } from "~/kb/procedures/recipe-views.mjs";
import { contentPicture } from "~/lib/media/images.mjs";
import { SITE, SITE_ORIGIN } from "~/lib/seo";
import { type Block, EquipmentTable, Heading, KeyResourcesTable, MaterialsTable, ProcedureFacts, ScaleForm, Solutions, html, materialsHeading } from "~/components/procedure-materials";
import { Bullets, StepItem, Steps } from "~/components/procedure-steps";

/**
 * Every procedure page is drawn by these components from its D1 record (docs/PROCEDURES.md): the page,
 * and its printable sheet. The HTML fragments in the record were rendered from the repository's file by
 * the site's own pipeline, with the URL allowlist applied, so they are set as HTML here as a post's are.
 */

function TroubleshootingTable({ record }: { record: ProcedureRecord }) {
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

function commandsOf(record: ProcedureRecord) {
  return record.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "steps" ? b.steps.flatMap((st) => st.commands) : [])));
}

function hasCalculators(record: ProcedureRecord) {
  return record.sections.some((section) =>
    section.blocks.some((block) => block.type === "steps" && block.steps.some((step) => step.calculators?.length)),
  );
}

/**
 * A recipe's mise-en-place (R5): every ingredient once, at the reader's servings and units, as a checklist that works with no
 * script, and the same as a plain shopping list to copy. Computed from the ingredient list, so it never says another amount.
 */
function MiseEnPlace({ record, factor, units }: { record: ProcedureRecord; factor: number; units: UnitSystem | null }) {
  const { items, text } = miseEnPlace(record, factor, units);
  if (items.length === 0) return null;
  return (
    <div className="procedure-mise">
      <h3 id="mise-en-place">Mise en place</h3>
      <ul className="procedure-mise-list">
        {items.map((item) => (
          <li key={item.name}>
            <label>
              <input type="checkbox" /> {item.amount ? `${item.amount} ` : ""}
              {item.name}
            </label>
          </li>
        ))}
      </ul>
      <label className="procedure-mise-copy">
        <span>Shopping list, to copy</span>
        <textarea readOnly rows={Math.min(12, items.length)} value={text} />
      </label>
    </div>
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
  units = null,
  lineage = null,
}: {
  record: ProcedureRecord;
  count: number;
  factor: number;
  /** The procedure this one is a variant of, resolved from its row (lineage.server.ts). */
  lineage?: Lineage | null;
  workflow?: ReturnType<typeof workflowContext>;
  proof?: ReturnType<typeof resolveProof>;
  basePath?: string;
  sheetPath?: string | null;
  frozen?: string[];
  /** A recipe's units as the reader asked for them: null is the recipe's own (recipe-views.mjs). */
  units?: UnitSystem | null;
}) {
  const [materialsId, equipmentId, primersId, troubleId, expectedId, limitsId, referencesId] = fixedSectionIds(record.profile);
  const keyGroups = keyResources(record);
  return (
    <div className="prose procedure" data-profile={record.profile} data-run-path={basePath} data-run-version={record.version ?? ""} data-run-title={record.title}>
      <ProcedureFacts record={record} lineage={lineage} />
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
        <Picture picture={contentPicture(record.image.src, { ...record.image, className: "procedure-image" })} />
      ) : null}
      {(record.questions?.length ?? 0) + (record.objectives?.length ?? 0) > 0 ? (
        <section className="procedure-overview" aria-labelledby="overview">
          <Heading id="overview">Overview</Heading>
          <Bullets id="questions" title="Questions" items={record.questions ?? []} />
          <Bullets id="objectives" title="Objectives" items={record.objectives ?? []} />
        </section>
      ) : null}
      <div dangerouslySetInnerHTML={html(record.introHtml)} />

      <section aria-labelledby={materialsId}>
        <Heading id={materialsId!}>{materialsHeading(record)}</Heading>
        <ScaleForm record={record} count={count} action={basePath} units={units} />
        <MaterialsTable record={record} count={count} factor={factor} units={units} />
        {record.profile === "recipe" ? <MiseEnPlace record={record} factor={factor} units={units} /> : null}
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
              <Steps key={i} steps={block.steps} factor={factor} record={record} scope={`${section.id}-${i}-`} units={units} />
            ),
          )}
        </section>
      ))}

      {record.keyPoints?.length ? (
        <section className="procedure-overview" aria-labelledby="key-points">
          <Heading id="key-points">Key points</Heading>
          <ul>
            {record.keyPoints.map((x, i) => (
              <li key={i} dangerouslySetInnerHTML={html(x)} />
            ))}
          </ul>
        </section>
      ) : null}

      {record.explanation?.length ? (
        <section aria-labelledby="explanation">
          <Heading id="explanation">Explanation</Heading>
          <ul>
            {record.explanation.map((e) => (
              <li key={e.url}>
                <a href={e.url}>{e.title}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {commandsOf(record).some((c) => c.platform) ? <template data-island="platforms" /> : null}

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
      {hasCalculators(record) ? <template data-island="tools" /> : null}

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
        <h1 className="cap-layout-grid">{record.title}</h1>
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
