// Turns a parsed, validated procedure into the record D1 stores and the page draws: every markdown
// fragment rendered to HTML through the site's own pipeline (so links pass the same URL allowlist as a
// post), every gap left out, and the quantities a reader can scale left as numbered slots in the HTML.
// The markdown twin and the search inputs are derived here too, from the same parse, so a machine and a
// person read the same facts.
//
// `renderBody` is passed in, not imported: the pipeline is 4 MB, so the Worker loads it lazily
// (load-pipeline.server.ts) and a Node script imports it directly.

import GithubSlugger from "github-slugger";

import { plainText } from "../search/records.mjs";
import { formatQuantity, readConditions, segmentText } from "./marks.mjs";
import { allSteps, procedurePath } from "./parse.mjs";

/** The slot a scalable quantity leaves in a step's HTML, filled at request time (fillQuantities). */
export const SLOT = (/** @type {number} */ i) => `QZQ${i}QZQ`;
const SLOT_PATTERN = /QZQ(\d+)QZQ/g;

const GAP = /^MISSING:/;

/** A heading as the pipeline writes it: rehype-slug's id, then the autolink inside. */
const HEADING = /<h([1-6]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;

/**
 * The ids of the sections the components draw from the front matter (ProcedureView), so a prose
 * heading with the same words takes the -1 suffix rather than the fixed section's id.
 *
 * @param {unknown} profile
 */
export function fixedSectionIds(profile) {
  const materials = profile === "recipe" ? "ingredients" : profile === "computational" ? "software-and-data" : "reagents";
  return [materials, "equipment", "troubleshooting", "expected-results", "limitations", "references"];
}

/**
 * The value, or null when it is a recorded gap or absent.
 *
 * @template T
 * @param {T} value
 * @returns {T | null}
 */
function known(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string" && GAP.test(value)) return null;
  return value;
}

/** @param {unknown} v */
const list = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

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
 * }} input
 */
export async function renderProcedure({ slug, parsed, gaps, renderBody, resolveImage }) {
  const file = procedurePath(slug);
  const d = parsed.data;
  const refuseImage = async (/** @type {string} */ src) => {
    throw new Error(`${file}: an image in prose ("${src}") is not supported; recipes carry photos on a step's own line`);
  };

  /**
   * @param {unknown} markdown
   * @param {{ inline?: boolean }} [opts]
   */
  const md = async (markdown, opts = {}) => {
    if (typeof markdown !== "string" || !markdown.trim() || GAP.test(markdown)) return null;
    const out = await renderBody({ file, body: markdown, resolveImage: refuseImage });
    if (out.blockedUrls.length > 0) {
      throw new Error(`${file}: the URL allowlist refused ${out.blockedUrls.map((b) => b.url).join(", ")}`);
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

  const materialsByName = new Map(list(d.materials).map((/** @type {any} */ m) => [String(m.name).toLowerCase(), m]));

  /** @param {import("./parse.mjs").Step} step */
  const renderStep = async (step) => {
    /** @type {Array<{ amount: string, unit: string, fixed: boolean, min: number | null, max: number | null }>} */
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
      commands: step.commands,
      photos: await Promise.all(step.photos.map(photo)),
    };
  };

  // One slugger for the whole page, as rehype-slug has for a whole post: each prose block is rendered
  // on its own, so a heading repeated across blocks would otherwise keep one id twice. The sections the
  // components draw themselves take their ids first.
  const slugger = new GithubSlugger();
  for (const id of fixedSectionIds(d.profile)) slugger.slug(id);
  /** @type {Array<{ depth: number, id: string, text: string }>} */
  const toc = [];
  /** @type {Array<{ id: string, title: string, blocks: Array<{ type: "prose", html: string } | { type: "steps", steps: Array<Awaited<ReturnType<typeof renderStep>>> }> }>} */
  const sections = [];
  for (const section of parsed.sections) {
    const sectionId = section.custom ? section.id : slugger.slug(section.title);
    toc.push({ depth: 2, id: sectionId, text: section.title });
    /** @type {(typeof sections)[number]["blocks"]} */
    const blocks = [];
    for (const block of section.blocks) {
      if (block.type === "prose") {
        const out = await renderBody({ file, body: block.markdown, resolveImage: refuseImage });
        if (out.blockedUrls.length > 0) {
          throw new Error(`${file}: the URL allowlist refused ${out.blockedUrls.map((b) => b.url).join(", ")}`);
        }
        const html = out.html.replace(HEADING, (_all, level, id, inner) => {
          const text = String(inner).replace(/<[^>]+>/g, "").replace(/#$/, "").trim();
          const unique = slugger.slug(text);
          if (Number(level) === 3) toc.push({ depth: 3, id: unique, text });
          return `<h${level} id="${unique}">${String(inner).replace(`href="#${id}"`, `href="#${unique}"`)}</h${level}>`;
        });
        blocks.push({ type: "prose", html });
      } else {
        blocks.push({ type: "steps", steps: await Promise.all(block.steps.map(renderStep)) });
      }
    }
    sections.push({ id: sectionId, title: section.title, blocks });
  }

  const materials = await Promise.all(
    list(d.materials).map(async (/** @type {any} */ m) => ({
      name: m.name,
      display: m.display ?? m.name,
      group: m.group ?? null,
      kind: m.kind ?? null,
      version: known(m.version),
      stock: list(m.stock).filter((s) => known(s) !== null).map(String),
      final: known(m.final),
      amount: known(m.amount),
      per: known(m.per),
      solution: m.solution ?? null,
      noteHtml: await md(m.note, { inline: true }),
      /** @type {{ amount: string, unit: string, fixed: boolean, min: number | null, max: number | null } | null} */
      quantity: null,
    })),
  );

  // A material with no amount of its own takes the sum of what its marks use, when they share a unit and
  // none is fixed, so a recipe's shopping list scales with its servings.
  /** @param {string} name */
  const markedTotal = (name) => {
    const qs = allSteps(parsed).flatMap((s) =>
      s.segments.flatMap((seg) => (seg.type === "material" && seg.name.toLowerCase() === name.toLowerCase() && seg.quantity ? [seg.quantity] : [])),
    );
    const unit = qs[0]?.unit;
    if (qs.length === 0 || qs.some((q) => q.min === null || q.max !== q.min || q.unit !== unit)) return null;
    const sum = qs.reduce((n, q) => n + (q.min ?? 0), 0);
    return { amount: String(sum), unit: unit ?? "", fixed: qs.every((q) => q.fixed), min: sum, max: sum };
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
          group: null,
          kind: null,
          version: null,
          stock: [],
          final: null,
          amount: null,
          per: null,
          solution: null,
          noteHtml: null,
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
    version: known(d.version),
    updated: known(d.updated),
    // What the protocol library filters and lists by (taxonomy.mjs); ids, so the page draws the words.
    methods: /** @type {string[]} */ (list(known(d.method))),
    organisms: /** @type {string[]} */ (list(known(d.organism))),
    targets: /** @type {string[]} */ (list(known(d.target))),
    courses: /** @type {string[]} */ (list(known(d.course))),
    // The library's "Start here" position, or null: stored, never inferred.
    startHere: known(d.start_here) === null ? null : Number(d.start_here),
    firstUsed: known(d.first_used),
    lastRun: known(d.last_run),
    status: known(d.status),
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
      (await Promise.all(list(known(d.references)).map((/** @type {string} */ r) => md(r, { inline: true })))).filter(Boolean)
    ),
    materials,
    equipment: await Promise.all(
      list(d.equipment).map(async (/** @type {any} */ e) =>
        typeof e === "string" ? { name: e, noteHtml: null } : { name: String(e.name), noteHtml: await md(e.note, { inline: true }) },
      ),
    ),
    troubleshooting,
    expectedResultsHtml: await md(d.expected_results),
    limitationsHtml: await md(d.limitations),
    sections,
    toc,
    // Protocol.
    scale: known(d.scale) ? { count: Number(d.scale.count), unit: String(d.scale.unit) } : null,
    biosafety: known(d.biosafety) && d.biosafety !== "not applicable" ? d.biosafety : null,
    hostStrain:
      known(d.host_strain) && d.host_strain !== "not applicable" ? list(d.host_strain).map(String).join("; ") : null,
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
    primers: Array.isArray(d.primers) ? d.primers.filter((/** @type {any} */ p) => known(p.sequence) !== null) : [],
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
    environmentHtml: await md(d.environment),
    prerequisites: /** @type {string[]} */ (
      (await Promise.all(list(known(d.prerequisites)).map((/** @type {string} */ p) => md(p, { inline: true })))).filter(Boolean)
    ),
    gaps,
  };
  return record;
}

/** @typedef {Awaited<ReturnType<typeof renderProcedure>>} ProcedureRecord */

/**
 * The scale factor a request asks for, or 1. A protocol scales its material totals by the count of its
 * unit; a recipe scales its step amounts by servings.
 *
 * @param {ProcedureRecord} record
 * @param {number | null} asked the count (protocol) or servings (recipe) in the URL
 */
export function scaleFactor(record, asked) {
  if (!asked || !(asked > 0) || asked > 1000) return 1;
  if (record.profile === "recipe" && record.servings) return asked / record.servings;
  if (record.profile === "protocol" && record.scale) return asked / record.scale.count;
  return 1;
}

/**
 * The step's HTML with its quantity slots filled. A protocol's step amounts are per unit and never
 * scale; a recipe's scale unless the file fixed them.
 *
 * @param {{ html: string | null, quantities: Array<{ amount: string, unit: string, fixed: boolean, min: number | null, max: number | null }> }} step
 * @param {number} factor
 */
export function fillQuantities(step, factor) {
  return (step.html ?? "").replace(SLOT_PATTERN, (_all, i) => {
    const q = step.quantities[Number(i)];
    if (!q) return "";
    return formatQuantity({ ...q, raw: "" }, factor);
  });
}

/**
 * The markdown twin: the same facts as the page, generated from the same file.
 *
 * @param {ProcedureRecord} record
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 */
export function procedureMarkdown(record, parsed) {
  const d = parsed.data;
  const out = [`# ${record.title}`, "", record.description, ""];
  const facts = [
    ["Version", record.version],
    ["Updated", record.updated],
    ["First used", record.firstUsed],
    ["Last run", record.lastRun],
    ["Status", record.status],
    ["Scale", record.scale ? `${record.scale.count} ${record.scale.unit}${record.scale.count === 1 ? "" : "s"}` : null],
    ["Servings", record.servings],
    ["Prep time", record.prepTime],
    ["Cook time", record.cookTime],
    ["Total time", record.time.total],
    ["Hands-on time", record.time.handsOn],
    ["Host strain", record.hostStrain],
    [
      "Biosafety",
      record.biosafety
        ? [record.biosafety.organism, record.biosafety.strain, record.biosafety.atcc ? `ATCC ${record.biosafety.atcc}` : null]
            .filter(Boolean)
            .join(", ")
        : null,
    ],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");
  for (const [k, v] of facts) out.push(`- ${k}: ${v}`);
  if (facts.length) out.push("");
  if (parsed.intro) out.push(parsed.intro, "");

  if (record.basedOn.length) {
    out.push("## Based on", "");
    for (const s of record.basedOn) {
      const link = s.doi ? ` (doi:${s.doi})` : s.url ? ` (${s.url})` : "";
      out.push(`- ${s.citation}${link}: ${s.for}`);
    }
    out.push("");
  }

  const heading = record.profile === "recipe" ? "Ingredients" : record.profile === "computational" ? "Software and data" : "Reagents";
  out.push(`## ${heading}`, "");
  for (const m of list(d.materials).length ? list(d.materials) : record.materials) {
    const parts = [
      known(m.amount) ? `${m.amount}${known(m.per) ? ` per ${m.per}` : ""}` : null,
      list(m.stock).filter((s) => known(s) !== null).length ? `stock ${list(m.stock).filter((s) => known(s) !== null).join(" or ")}` : null,
      known(m.final) ? `final ${m.final}` : null,
      known(m.version) ? `version ${m.version}` : null,
    ].filter(Boolean);
    const note = known(m.note) ? ` ${m.note}` : "";
    out.push(`- ${m.display ?? m.name}${m.group ? ` (${m.group})` : ""}${parts.length ? `: ${parts.join("; ")}.` : ""}${note}`);
  }
  out.push("");
  for (const s of record.solutions) {
    out.push(`### ${s.name}`, "");
    for (const c of s.components) out.push(`- ${c.name}${c.final ? `, ${c.final} final` : ""}${c.amount ? `, ${c.amount}` : ""}`);
    if (s.storage) out.push(`- Storage: ${s.storage}`);
    if (s.shelfLife) out.push(`- Shelf life: ${s.shelfLife}`);
    out.push("");
  }
  if (record.equipment.length) {
    out.push("## Equipment", "");
    for (const e of list(d.equipment)) out.push(typeof e === "string" ? `- ${e}` : `- ${e.name}${e.note ? `: ${e.note}` : ""}`);
    out.push("");
  }
  if (known(d.environment)) out.push("## Environment", "", String(d.environment), "");
  if (record.prerequisites.length) out.push("## Prerequisites", "", ...list(d.prerequisites).map((p) => `- ${p}`), "");

  for (const section of parsed.sections) {
    out.push(`## ${section.title}`, "");
    for (const block of section.blocks) {
      if (block.type === "prose") {
        out.push(block.markdown, "");
        continue;
      }
      for (const step of block.steps) {
        out.push(`${step.number}. ${step.segments.map((s) => segmentText(s)).join("")}`);
        const flag = (/** @type {string} */ name, /** @type {string[]} */ items) => {
          for (const item of items) if (!GAP.test(item)) out.push(`   > ${name}: ${item.replace(/\n/g, "\n   > ")}`);
        };
        flag("Critical", step.flags.critical);
        flag("Pause point", step.flags.pause);
        flag("Spin", step.flags.spin);
        flag("Why", step.flags.why);
        flag("Expected", step.flags.expect);
        for (const id of step.flags.troubleshooting) out.push(`   > Troubleshooting: see "${id}" below.`);
        for (const cmd of step.commands) {
          out.push("", `   \`\`\`${cmd.lang}`, ...cmd.code.split("\n").map((l) => `   ${l}`), "   ```");
          if (cmd.output !== null) {
            out.push("", "   Expected output:", "", "   ```", ...cmd.output.split("\n").map((l) => `   ${l}`), "   ```");
          }
        }
        for (const p of step.photos) out.push(`   ![${p.alt}](${p.src})`);
      }
      out.push("");
    }
  }

  if (list(d.troubleshooting).length) {
    out.push("## Troubleshooting", "", "| Step | Problem | Possible reason | Solution |", "| --- | --- | --- | --- |");
    for (const r of list(d.troubleshooting)) {
      const cell = (/** @type {unknown} */ v) => String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
      out.push(`| ${cell(r.step)} | ${cell(r.problem)} | ${cell(r.reason)} | ${cell(r.solution)} |`);
    }
    out.push("");
  }
  if (known(d.expected_results)) out.push("## Expected results", "", String(d.expected_results), "");
  if (known(d.limitations)) out.push("## Limitations", "", String(d.limitations), "");
  if (list(d.substitutions).length) {
    out.push("## Substitutions", "");
    for (const s of list(d.substitutions)) out.push(`- For ${s.for}, use ${s.use}${s.note ? `: ${s.note}` : ""}`);
    out.push("");
  }
  const refs = list(known(d.references));
  if (refs.length) out.push("## References", "", ...refs.map((r) => `- ${r}`), "");
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/**
 * The search uid of the page at `path`: the one the page had when it was a content page, so a search
 * link survives the move. Also what removing a procedure's search records is keyed by.
 *
 * @param {string} path
 */
export function procedureSearchUid(path) {
  return `page:${path.slice(1).replaceAll("/", ":")}`;
}

/**
 * What the search index takes for this procedure, in the shape recordsForPages reads, with the uid
 * `procedureSearchUid` names.
 *
 * @param {ProcedureRecord} record
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 */
export function procedureSearchInput(record, parsed) {
  const markdown = procedureMarkdown(record, parsed);
  const sections = parsed.sections.map((section) => {
    const body = section.blocks
      .map((block) =>
        block.type === "prose"
          ? block.markdown
          : block.steps
              .map((s) => [s.segments.map((x) => segmentText(x)).join(""), ...s.flags.why, ...s.flags.critical].join(" "))
              .join(" "),
      )
      .join(" ");
    return { anchor: section.id, title: section.title, body: plainText(body) };
  });
  return {
    url: record.path,
    uid: procedureSearchUid(record.path),
    title: record.title,
    description: record.description,
    intro: plainText(parsed.intro),
    sections,
    markdown,
  };
}
