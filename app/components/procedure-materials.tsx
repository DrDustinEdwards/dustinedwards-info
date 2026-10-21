import { reagentSource, type ProcedureRecord } from "~/kb/procedures/render.mjs";
import { lineageText, type Lineage } from "~/kb/procedures/lineage.mjs";
import { HOWTO_TYPES } from "~/kb/procedures/validate.mjs";
import type { KeyResourceGroup } from "~/kb/procedures/key-resources.mjs";
import { BASES } from "~/kb/bases.mjs";
import { itemPath } from "~/kb/registry/catalog.mjs";
import { UNIT_SYSTEMS, ingredientSteps, showQuantity, type UnitSystem } from "~/kb/procedures/recipe-views.mjs";
import { formatNumber, parseNumber } from "~/kb/procedures/marks.mjs";

/* The procedure page's parts above the method (procedure.tsx): its facts, the scale form, and the materials, key resources, equipment and solutions tables. */

type Section = ProcedureRecord["sections"][number];
export type Block = Section["blocks"][number];
export type Step = Extract<Block, { type: "steps" }>["steps"][number];

export const html = (value: string | null | undefined) => ({ __html: value ?? "" });

/** The words for the materials section, by profile. */
export function materialsHeading(record: ProcedureRecord) {
  if (record.profile === "recipe") return "Ingredients";
  if (record.profile === "computational") return "Software and data";
  return "Reagents";
}

/** A heading with the same autolink markup the pipeline gives prose headings. */
export function Heading({ id, level = 2, children }: { id: string; level?: 2 | 3; children: string }) {
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

export function ProcedureFacts({ record, lineage = null }: { record: ProcedureRecord; lineage?: Lineage | null }) {
  const facts: Array<[string, React.ReactNode]> = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") facts.push([label, String(value)]);
  };
  // A how-to says first whether it is a lesson or a recipe for a task (S1). A row compiled before step 10 has no type.
  add("Type", record.howtoType ? HOWTO_TYPES[record.howtoType] : null);
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
  // A variant made with the editor's Duplicate names the procedure it was copied from, as protocols.io shows a fork's
  // parent (P3): by its title, linked to the frozen copy of the version copied. Where the page is drawn without the
  // parent's row (the sheet, the admin preview), the parent's address stands in for its title.
  if (record.forkedFrom) {
    const root = BASES.find((b) => b.profile === record.profile)?.entryRoot ?? "/research/protocols/";
    const shown = lineage ?? { title: record.forkedFrom.slug, href: `${root}${record.forkedFrom.slug}`, version: record.forkedFrom.version };
    facts.push(["Based on", shown.href ? <a key="forked" href={shown.href}>{lineageText(shown)}</a> : lineageText(shown)]);
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
export function ScaleForm({ record, count, action, units = null }: { record: ProcedureRecord; count: number; action: string; units?: UnitSystem | null }) {
  if (record.profile === "recipe" && record.servings) {
    return (
      <form className="procedure-scale" method="get" action={action}>
        <label>
          Servings <input name="servings" type="number" min={1} max={1000} step="any" defaultValue={count} />
        </label>
        {/* Metric or imperial (recipe-views.mjs): the same GET, so each state is an address and works with no script. */}
        <label>
          Units{" "}
          <select name="units" defaultValue={units ?? ""}>
            <option value="">As written</option>
            {Object.entries(UNIT_SYSTEMS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Show</button>
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
              <th scope="row">{e.item?.status === "published" ? <a href={itemPath("equipment", e.item.id)}>{e.name}</a> : e.name}</th>
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

export function MaterialsTable({ record, count, factor, units = null }: { record: ProcedureRecord; count: number; factor: number; units?: UnitSystem | null }) {
  // A recipe's ingredients say every step they are used in (R2), linked, computed from the steps' marks.
  const usedIn = record.profile === "recipe" ? ingredientSteps(record) : null;
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
            {usedIn ? <th scope="col">Used in steps</th> : null}
            {showTotal ? <th scope="col">For {unitWord}</th> : null}
            {hasSource ? <th scope="col">Source</th> : null}
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {record.materials.map((m) => (
            <tr key={m.name} id={`material-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <th scope="row">
                {/* A published reagent of the lab registry links its page, which lists every protocol that uses it. */}
                {m.reagent?.status === "published" ? <a href={itemPath("reagent", m.reagent.id)}>{m.display}</a> : m.display}
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
                    ? showQuantity(m.quantity, factor, units, m.gramsPerCup ?? null)
                    : ""}
              </td>
              {usedIn ? (
                <td>
                  {(usedIn.get(m.name.toLowerCase()) ?? []).map((u, i) => (
                    <span key={u.id}>
                      {i > 0 ? ", " : null}
                      <a href={`#${u.id}`}>{u.number}</a>
                    </span>
                  ))}
                </td>
              ) : null}
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

export function Solutions({ record }: { record: ProcedureRecord }) {
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
