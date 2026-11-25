// Turns a parsed, validated procedure into the record D1 stores and the page draws: markdown fragments rendered
// through the site's own pipeline (links pass the post URL allowlist), gaps left out, scalable quantities left as
// slots. `renderBody` is passed in: the pipeline is 4 MB, so the Worker loads it lazily (load-pipeline.server.ts).

import { plainText } from "../../lib/search/records.mjs";
import { proofFromFile } from "./proof.mjs";
import { formatQuantity, readConditions, segmentText } from "./marks.mjs";
import { statusLabel } from "./taxonomy.mjs";
import { allSteps, procedurePath, readCalcs } from "./parse.mjs";
import { HOWTO_TYPES } from "./validate-profiles.mjs";
import { SLOT } from "./render-quantities.mjs";
import { renderSections } from "./render-sections.mjs";

export const GAP = /^MISSING:/;

/**
 * The value, or null when it is a recorded gap or absent.
 *
 * @template T
 * @param {T} value
 * @returns {T | null}
 */
export function known(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && GAP.test(value)) return null;
  return value;
}

/** @param {unknown} v */
export const list = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

/**
 * @typedef {(input: { file: string, body: string, resolveImage: (src: string) => Promise<any> }) =>
 *   Promise<{ html: string, toc: Array<{ depth: number, id: string, text: string }>, blockedUrls: Array<{ url: string }> }>} RenderBody
 */

/**
 * @param {{
 *   slug: string,
 *   parsed: import("./parse.mjs").ParsedProcedure,
 *   gaps: Array<{ field: string, reason: string }>,
 *   renderBody: RenderBody,
 *   resolveImage?: (src: string) => Promise<{ width: number, height: number }>,
 *   primerRows?: import("./render-stored.mjs").StoredPrimer[],
 *   strainRows?: Array<import("./render-stored.mjs").StoredStrain & { path: string }>,
 *   organismNames?: Record<string, string>,
 *   reagentRows?: import("./render-stored.mjs").StoredReagent[],
 *   equipmentRows?: import("./render-stored.mjs").StoredEquipment[],
 * }} input
 */
export async function renderProcedure({
  slug,
  parsed,
  gaps,
  renderBody,
  resolveImage,
  primerRows,
  strainRows,
  organismNames,
  reagentRows,
  equipmentRows,
}) {
  const file = procedurePath(slug);
  const d = parsed.data;
  const refuseImage = async (/** @type {string} */ src) => {
    throw new Error(
      `${file}: an image in prose ("${src}") is not supported; recipes carry photos on a step's own line`,
    );
  };

  /**
   * @param {unknown} markdown
   * @param {{ inline?: boolean }} [opts]
   */
  const md = async (markdown, opts = {}) => {
    if (typeof markdown !== "string" || !markdown.trim() || GAP.test(markdown)) return null;
    const out = await renderBody({ file, body: markdown, resolveImage: refuseImage });
    if (out.blockedUrls.length > 0) {
      throw new Error(
        `${file}: the URL allowlist refused ${out.blockedUrls.map((b) => b.url).join(", ")}`,
      );
    }
    const html = out.html.trim();
    if (!opts.inline) return html;
    const single = /^<p>([\s\S]*)<\/p>$/.exec(html);
    return single && !single[1]?.includes("<p>") ? (single[1] ?? "") : html;
  };

  /** @param {{ src: string, alt: string }} photo */
  const photo = async (photo) => {
    if (!resolveImage) return { src: photo.src, alt: photo.alt, width: null, height: null };
    const size = await resolveImage(photo.src);
    return { src: photo.src, alt: photo.alt, width: size.width, height: size.height };
  };

  /** @param {unknown} value */
  const inlineList = async (value) =>
    /** @type {string[]} */ (
      (
        await Promise.all(
          list(known(value)).map((/** @type {string} */ x) => md(x, { inline: true })),
        )
      ).filter(Boolean)
    );

  const materialsByName = new Map(
    list(d.materials).map((/** @type {any} */ m) => [String(m.name).toLowerCase(), m]),
  );

  /** @param {import("./parse.mjs").Step} step */
  const renderStep = async (step) => {
    /** @type {Array<{ name: string, amount: string, unit: string, fixed: boolean, min: number | null, max: number | null }>} */
    const quantities = [];
    /** @type {Array<{ name: string, display: string, amount: string | null }>} */
    const materials = [];
    /** @type {string[]} */
    const equipment = [];
    /** @type {Array<{ label: string, text: string, min: number | null, max: number | null, unit: string }>} */
    const timers = [];
    let words = "";
    for (const seg of step.segments) {
      if (seg.type === "material") {
        materials.push({
          name: seg.name,
          display: seg.display,
          amount: seg.quantity ? formatQuantity(seg.quantity) : null,
        });
        if (seg.quantity) {
          quantities.push({
            // Which ingredient the amount is of, so a recipe can show it in other units (recipe-views.mjs).
            name: seg.name,
            amount: seg.quantity.amount,
            unit: seg.quantity.unit,
            fixed: seg.quantity.fixed,
            min: seg.quantity.min,
            max: seg.quantity.max,
          });
          words += `${SLOT(quantities.length - 1)} of ${seg.display}`;
          continue;
        }
      } else if (seg.type === "equipment") {
        equipment.push(seg.name);
      } else if (seg.type === "timer" && seg.quantity) {
        timers.push({
          label: seg.label,
          text: formatQuantity(seg.quantity),
          min: seg.quantity.min,
          max: seg.quantity.max,
          unit: seg.quantity.unit,
        });
      }
      words += segmentText(seg);
    }
    const text = step.segments.map((s) => segmentText(s)).join("");
    const { temperatures, spins } = readConditions(text);
    const flagHtml = async (/** @type {string[]} */ items) =>
      /** @type {string[]} */ ((await Promise.all(items.map((t) => md(t)))).filter(Boolean));
    return {
      number: step.number,
      html: await md(words, { inline: true }),
      text: plainText(text),
      quantities,
      materials,
      equipment,
      timers,
      temperatures,
      spins,
      spin: step.flags.spin.filter((s) => !GAP.test(s)),
      critical: await flagHtml(step.flags.critical),
      pause: await flagHtml(step.flags.pause),
      why: await flagHtml(step.flags.why),
      expect: await flagHtml(step.flags.expect),
      troubleshooting: step.flags.troubleshooting,
      calculators: readCalcs(step.flags.calc),
      // A tutorial's challenges, each with the solution the parse paired with it (S5).
      challenges: await Promise.all(
        step.flags.challenge.map(async (c, i) => ({
          html: await md(c),
          solutionHtml: await md(step.flags.solution[i] ?? ""),
        })),
      ),
      commands: step.commands,
      photos: await Promise.all(step.photos.map(photo)),
    };
  };

  const { sections, toc } = await renderSections({
    parsed,
    file,
    renderBody,
    refuseImage,
    renderStep,
  });

  const reagentsById = new Map((reagentRows ?? []).map((r) => [r.id, r]));
  const materials = await Promise.all(
    list(d.materials).map(async (/** @type {any} */ m) => ({
      name: m.name,
      // A reagent of the registry is shown by the registry's name, linked, so the protocol types no product name for it.
      display: m.display ?? reagentsById.get(m.reagent)?.name ?? m.name,
      // What the registry says of it, as it was when the protocol was compiled: the table shows where it comes from.
      reagent: reagentsById.get(m.reagent) ?? null,
      group: m.group ?? null,
      kind: m.kind ?? null,
      version: known(m.version),
      stock: list(m.stock)
        .filter((s) => known(s) !== null)
        .map(String),
      final: known(m.final),
      amount: known(m.amount),
      per: known(m.per),
      solution: m.solution ?? null,
      noteHtml: await md(m.note, { inline: true }),
      // A recipe's grams in one cup of it, where the recipe states it: the only way its volume is shown as weight (DECIDE 7).
      gramsPerCup:
        typeof m.grams_per_cup === "number" && m.grams_per_cup > 0 ? m.grams_per_cup : null,
      /** @type {{ amount: string, unit: string, fixed: boolean, min: number | null, max: number | null } | null} */
      quantity: null,
    })),
  );

  // A material with no amount of its own takes the sum of what its marks use, when they share a unit and
  // none is fixed, so a recipe's shopping list scales with its servings.
  /** @param {string} name */
  const markedTotal = (name) => {
    const qs = allSteps(parsed).flatMap((s) =>
      s.segments.flatMap((seg) =>
        seg.type === "material" && seg.name.toLowerCase() === name.toLowerCase() && seg.quantity
          ? [seg.quantity]
          : [],
      ),
    );
    const unit = qs[0]?.unit;
    if (qs.length === 0 || qs.some((q) => q.min === null || q.max !== q.min || q.unit !== unit))
      return null;
    const sum = qs.reduce((n, q) => n + (q.min ?? 0), 0);
    return {
      amount: String(sum),
      unit: unit ?? "",
      fixed: qs.every((q) => q.fixed),
      min: sum,
      max: sum,
    };
  };
  for (const m of materials) {
    if (m.amount === null) m.quantity = markedTotal(m.name);
  }

  // A recipe may leave its ingredients undeclared: the marks are the list, in order of first use.
  if (d.profile === "recipe") {
    for (const step of allSteps(parsed)) {
      for (const seg of step.segments) {
        if (seg.type !== "material" || materialsByName.has(seg.name.toLowerCase())) continue;
        materialsByName.set(seg.name.toLowerCase(), { name: seg.name });
        materials.push({
          name: seg.name,
          display: seg.name,
          reagent: null,
          group: null,
          kind: null,
          version: null,
          stock: [],
          final: null,
          amount: null,
          per: null,
          solution: null,
          noteHtml: null,
          gramsPerCup: null,
          quantity: markedTotal(seg.name),
        });
      }
    }
  }

  const troubleshooting = await Promise.all(
    list(d.troubleshooting).map(async (/** @type {any} */ row) => ({
      id: row.id,
      step: String(row.step),
      problem: await md(row.problem, { inline: true }),
      reason: await md(row.reason, { inline: true }),
      solution: await md(row.solution, { inline: true }),
    })),
  );

  const image = known(d.image);
  const record = {
    slug,
    profile: /** @type {"protocol" | "recipe" | "computational"} */ (d.profile),
    path: String(d.path),
    title: String(d.title),
    seoTitle: String(d.seo_title),
    description: String(d.description),
    draft: d.draft === true,
    version: known(d.version) === null ? null : String(d.version),
    // Newest first; the first entry is the version the page is at (validate.mjs). Empty until one is written.
    history: await Promise.all(
      list(known(d.history)).map(async (/** @type {any} */ h) => ({
        version: String(h.version),
        date: String(h.date),
        summaryHtml: await md(h.summary, { inline: true }),
        doi: h.doi ? String(h.doi) : null,
      })),
    ),
    updated: known(d.updated),
    // What the protocol library filters and lists by (taxonomy.mjs); ids, so the page draws the words.
    methods: /** @type {string[]} */ (list(known(d.method))),
    organisms: /** @type {string[]} */ (list(known(d.organism))),
    // The words for each organism id, read from the lab registry when the protocol was compiled (docs/REGISTRY.md).
    organismNames: organismNames ?? {},
    targets: /** @type {string[]} */ (list(known(d.target))),
    courses: /** @type {string[]} */ (list(known(d.course))),
    // The library's "Start here" position, or null: stored, never inferred.
    startHere: known(d.start_here) === null ? null : Number(d.start_here),
    // Proof of use: slugs of the papers that used the method and the phages it produced, or null. Stored, never inferred.
    proofOfUse: proofFromFile(known(d.proof_of_use)),
    firstUsed: known(d.first_used),
    lastRun: known(d.last_run),
    status: known(d.status) === null ? null : statusLabel(String(d.status)),
    // The procedure this one was copied from with the editor's Duplicate (validate.mjs checks the shape), or null.
    forkedFrom:
      d.forked_from && typeof d.forked_from === "object"
        ? {
            slug: String(d.forked_from.slug),
            version: d.forked_from.version ? String(d.forked_from.version) : null,
          }
        : null,
    time: {
      total: known(d.time?.total),
      handsOn: known(d.time?.hands_on),
    },
    introHtml: await md(parsed.intro),
    basedOn: list(known(d.based_on)).map((/** @type {any} */ s) => ({
      citation: String(s.citation),
      for: String(s.for),
      doi: s.doi ? String(s.doi) : null,
      url: s.url ? String(s.url) : null,
    })),
    references: /** @type {string[]} */ (
      (
        await Promise.all(
          list(known(d.references)).map((/** @type {string} */ r) => md(r, { inline: true })),
        )
      ).filter(Boolean)
    ),
    materials,
    equipment: await Promise.all(
      list(d.equipment).map(async (/** @type {any} */ e) => {
        const item =
          typeof e === "object" && e !== null
            ? ((equipmentRows ?? []).find((r) => r.id === e.equipment) ?? null)
            : null;
        return typeof e === "string"
          ? { name: e, noteHtml: null, item }
          : { name: String(e.name), noteHtml: await md(e.note, { inline: true }), item };
      }),
    ),
    troubleshooting,
    expectedResultsHtml: await md(d.expected_results),
    limitationsHtml: await md(d.limitations),
    sections,
    toc,
    // Protocol.
    scale: known(d.scale) ? { count: Number(d.scale.count), unit: String(d.scale.unit) } : null,
    biosafety: known(d.biosafety) && d.biosafety !== "not applicable" ? d.biosafety : null,
    // Dustin's to set per protocol. A gap reads as null, so no page, twin or structured data ever carries "MISSING".
    biosafetyLevel: /** @type {string | null} */ (known(d.biosafety_level)),
    // The strains are the registry's: the names are computed from them, never typed in the protocol.
    hostStrains: (strainRows ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      organism: s.organism,
      strain: s.strain,
      collection: s.collection,
      collectionNumber: s.collectionNumber,
    })),
    hostStrain:
      (strainRows ?? []).length > 0 ? (strainRows ?? []).map((s) => s.name).join("; ") : null,
    solutions: list(d.solutions).map((/** @type {any} */ s) => ({
      id: s.id,
      name: s.name,
      components: list(s.components).map((/** @type {any} */ c) => ({
        name: String(c.name),
        final: known(c.final),
        amount: known(c.amount),
      })),
      storage: known(s.storage),
      shelfLife: known(s.shelf_life),
    })),
    // The registry's rows for the primers the file names, in the file's order (compile.mjs resolves them).
    primers: (primerRows ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      set: p.set,
      direction: p.direction,
      sequence: p.sequence,
      reference: p.reference,
      publishedIn: p.publishedIn ?? null,
    })),
    cycling: Array.isArray(d.cycling) ? d.cycling : [],
    // Recipe.
    servings: known(d.servings) === null ? null : Number(d.servings),
    cuisine: known(d.cuisine),
    category: known(d.category),
    diet: list(known(d.diet)).map(String),
    prepTime: known(d.prep_time),
    cookTime: known(d.cook_time),
    image: image ? await photo(image) : null,
    substitutions: await Promise.all(
      list(d.substitutions).map(async (/** @type {any} */ s) => ({
        for: String(s.for),
        use: String(s.use),
        noteHtml: await md(s.note, { inline: true }),
      })),
    ),
    // Computational.
    // Tutorial or how-to (S1), and a tutorial's questions, objectives and key points (S2), as the file states them.
    howtoType: /** @type {keyof typeof HOWTO_TYPES | null} */ (
      d.profile === "computational" && Object.hasOwn(HOWTO_TYPES, d.type) ? d.type : null
    ),
    questions: await inlineList(d.questions),
    objectives: await inlineList(d.objectives),
    keyPoints: await inlineList(d.key_points),
    explanation: list(known(d.explanation)).map((/** @type {any} */ e) => ({
      title: String(e.title),
      url: String(e.url),
    })),
    environmentHtml: await md(d.environment),
    prerequisites: /** @type {string[]} */ (
      (
        await Promise.all(
          list(known(d.prerequisites)).map((/** @type {string} */ p) => md(p, { inline: true })),
        )
      ).filter(Boolean)
    ),
    gaps,
  };
  return record;
}

/** @typedef {Awaited<ReturnType<typeof renderProcedure>>} ProcedureRecord */
