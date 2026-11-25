/** The markdown twin of a procedure and the search input derived from it. */

import { mdLink } from "../md-link.mjs";
import { mdCell, plural } from "@drdustinedwards/site-helpers/text";
import { TOOLS } from "../../lib/phage-tools.mjs";
import { productsForRows } from "../registry/align.mjs";
import { itemPath } from "../registry/address.mjs";
import { plainText } from "../../lib/search/records.mjs";
import { keyResources, keyResourcesMarkdown } from "./key-resources.mjs";
import { segmentText } from "./marks.mjs";
import { PLATFORMS, readCalcs } from "./parse.mjs";
import { HOWTO_TYPES } from "./validate-profiles.mjs";
import { storedLineage } from "./lineage.mjs";
import { reagentSource } from "./render-stored.mjs";
import { GAP, known, list } from "./render.mjs";

/** @typedef {import("./render.mjs").ProcedureRecord} ProcedureRecord */

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
    ["Type", record.howtoType ? HOWTO_TYPES[record.howtoType] : null],
    ["Version", record.version],
    ["Updated", record.updated],
    ["First used", record.firstUsed],
    ["Last run", record.lastRun],
    ["Status", record.status],
    ["Scale", record.scale ? plural(record.scale.count, record.scale.unit) : null],
    ["Servings", record.servings],
    ["Prep time", record.prepTime],
    ["Cook time", record.cookTime],
    ["Total time", record.time.total],
    ["Hands-on time", record.time.handsOn],
    // The parent's file name and version; the twin's route reads it out as the parent's title and address (lineage.mjs).
    ["Based on", record.forkedFrom ? storedLineage(record.forkedFrom) : null],
    [
      "Host strain",
      record.hostStrains.length > 0
        ? record.hostStrains.map((s) => mdLink(s.name, s.path)).join("; ")
        : null,
    ],
    ["Biosafety level", record.biosafetyLevel],
    [
      "Biosafety",
      record.biosafety
        ? [
            record.biosafety.organism,
            record.biosafety.strain,
            record.biosafety.atcc ? `ATCC ${record.biosafety.atcc}` : null,
          ]
            .filter(Boolean)
            .join(", ")
        : null,
    ],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");
  for (const [k, v] of facts) out.push(`- ${k}: ${v}`);
  if (facts.length) out.push("");
  // A tutorial opens with what it answers and teaches (S2), as the page does.
  const bullets = (/** @type {string} */ title, /** @type {unknown} */ value) => {
    const items = list(known(value));
    if (items.length) out.push(`## ${title}`, "", ...items.map((x) => `- ${x}`), "");
  };
  bullets("Questions", d.questions);
  bullets("Objectives", d.objectives);
  if (parsed.intro) out.push(parsed.intro, "");

  if (record.basedOn.length) {
    out.push("## Based on", "");
    for (const s of record.basedOn) {
      const link = s.doi ? ` (doi:${s.doi})` : s.url ? ` (${s.url})` : "";
      out.push(`- ${s.citation}${link}: ${s.for}`);
    }
    out.push("");
  }

  const heading =
    record.profile === "recipe"
      ? "Ingredients"
      : record.profile === "computational"
        ? "Software and data"
        : "Reagents";
  out.push(`## ${heading}`, "");
  // The registry reagents the materials name, as the record baked them (the file holds only their ids).
  const reagentOf = new Map(record.materials.map((m) => [m.name, m.reagent]));
  for (const m of list(d.materials).length ? list(d.materials) : record.materials) {
    const parts = [
      known(m.amount) ? `${m.amount}${known(m.per) ? ` per ${m.per}` : ""}` : null,
      list(m.stock).filter((s) => known(s) !== null).length
        ? `stock ${list(m.stock)
            .filter((s) => known(s) !== null)
            .join(" or ")}`
        : null,
      known(m.final) ? `final ${m.final}` : null,
      known(m.version) ? `version ${m.version}` : null,
    ].filter(Boolean);
    const note = known(m.note) ? ` ${m.note}` : "";
    const reagent = reagentOf.get(m.name) ?? null;
    const shown = m.display ?? reagent?.name ?? m.name;
    if (reagent) {
      const source = reagentSource(reagent);
      parts.push(source.href ? `source [${source.text}](${source.href})` : `source ${source.text}`);
    }
    // A published reagent links its page, as the page's table does.
    const named =
      reagent?.status === "published" ? mdLink(shown, itemPath("reagent", reagent.id)) : shown;
    out.push(
      `- ${named}${m.group ? ` (${m.group})` : ""}${parts.length ? `: ${parts.join("; ")}.` : ""}${note}`,
    );
  }
  out.push("");
  for (const s of record.solutions) {
    out.push(`### ${s.name}`, "");
    for (const c of s.components)
      out.push(
        `- ${c.name}${c.final ? `, ${c.final} final` : ""}${c.amount ? `, ${c.amount}` : ""}`,
      );
    if (s.storage) out.push(`- Storage: ${s.storage}`);
    if (s.shelfLife) out.push(`- Shelf life: ${s.shelfLife}`);
    out.push("");
  }
  if (record.equipment.length) {
    out.push("## Equipment", "");
    // The registry facts of each item, as the record baked them (the file holds only the ids).
    const itemOf = new Map(record.equipment.map((e) => [e.name, e.item]));
    for (const e of list(d.equipment)) {
      const name = typeof e === "string" ? e : String(e.name);
      const item = itemOf.get(name) ?? null;
      const facts = item
        ? ` (${[`manufacturer ${item.manufacturer ?? "not recorded"}`, item.rotor ? `rotor ${item.rotor}` : item.rotorGap ? "rotor not recorded" : null].filter(Boolean).join("; ")})`
        : "";
      const named =
        item?.status === "published" ? mdLink(name, itemPath("equipment", item.id)) : name;
      out.push(`- ${named}${facts}${typeof e === "string" || !e.note ? "" : `: ${e.note}`}`);
    }
    out.push("");
  }
  if (record.primers.length) {
    const products = productsForRows(record.primers);
    out.push(
      "## Primers",
      "",
      "| Primer | Direction | Sequence (5′ to 3′) | Product (computed) |",
      "| --- | --- | --- | --- |",
    );
    for (const p of record.primers) {
      const pair = products.get(p.id);
      const sizes = pair
        ? [...new Set(pair.products.map((x) => x.length))].map((n) => `${n} bp`).join(" or ")
        : "";
      out.push(
        "| " +
          mdLink(p.name, "/research/lab/primers/" + p.id) +
          " | " +
          mdCell(p.direction) +
          " | " +
          (p.sequence ? "`" + p.sequence + "`" : "") +
          " | " +
          sizes +
          " |",
      );
    }
    out.push("");
    const references = [...new Set([...products.values()].map((pair) => pair.reference.id))];
    if (references.length > 0)
      out.push(
        `Product sizes are computed from where the primers bind ${references.join(", ")}, in that accession's coordinates.`,
        "",
      );
  }
  out.push(...keyResourcesMarkdown(keyResources(record)));
  if (known(d.environment)) out.push("## Environment", "", String(d.environment), "");
  if (record.prerequisites.length)
    out.push("## Prerequisites", "", ...list(d.prerequisites).map((p) => `- ${p}`), "");

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
          for (const item of items)
            if (!GAP.test(item)) out.push(`   > ${name}: ${item.replace(/\n/g, "\n   > ")}`);
        };
        flag("Critical", step.flags.critical);
        flag("Pause point", step.flags.pause);
        flag("Spin", step.flags.spin);
        flag("Why", step.flags.why);
        flag("Expected", step.flags.expect);
        for (const id of step.flags.troubleshooting)
          out.push(`   > Troubleshooting: see "${id}" below.`);
        for (const c of readCalcs(step.flags.calc))
          out.push(
            `   > Calculator: [${TOOLS[c.id]?.title}](${TOOLS[c.id]?.path})${
              Object.keys(c.values).length
                ? ` with ${Object.entries(c.values)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ")}`
                : ""
            }`,
          );
        // Every platform's block, each under its name (S4): the page's tabs are a view of these.
        for (const cmd of step.commands) {
          if (cmd.platform)
            out.push(
              "",
              `   ${PLATFORMS[/** @type {keyof typeof PLATFORMS} */ (cmd.platform)] ?? cmd.platform}:`,
            );
          out.push(
            "",
            `   \`\`\`${cmd.lang}`,
            ...cmd.code.split("\n").map((l) => `   ${l}`),
            "   ```",
          );
          if (cmd.output !== null) {
            out.push(
              "",
              "   Expected output:",
              "",
              "   ```",
              ...cmd.output.split("\n").map((l) => `   ${l}`),
              "   ```",
            );
          }
        }
        for (const p of step.photos) out.push(`   ![${p.alt}](${p.src})`);
        // A challenge and its solution, both: the page folds the solution away, and a machine reads it anyway.
        step.flags.challenge.forEach((c, i) => {
          out.push("", `   > Challenge: ${c.replace(/\n/g, "\n   > ")}`);
          const solution = step.flags.solution[i];
          if (solution) out.push("", `   > Solution: ${solution.replace(/\n/g, "\n   > ")}`);
        });
      }
      out.push("");
    }
  }

  bullets("Key points", d.key_points);
  if (record.explanation.length)
    out.push(
      "## Explanation",
      "",
      ...record.explanation.map((e) => `- ${mdLink(e.title, e.url)}`),
      "",
    );

  if (list(d.troubleshooting).length) {
    out.push(
      "## Troubleshooting",
      "",
      "| Step | Problem | Possible reason | Solution |",
      "| --- | --- | --- | --- |",
    );
    for (const r of list(d.troubleshooting)) {
      out.push(
        `| ${mdCell(String(r.step ?? ""))} | ${mdCell(String(r.problem ?? ""))} | ${mdCell(String(r.reason ?? ""))} | ${mdCell(String(r.solution ?? ""))} |`,
      );
    }
    out.push("");
  }
  if (known(d.expected_results))
    out.push("## Expected results", "", String(d.expected_results), "");
  if (known(d.limitations)) out.push("## Limitations", "", String(d.limitations), "");
  if (list(d.substitutions).length) {
    out.push("## Substitutions", "");
    for (const s of list(d.substitutions))
      out.push(`- For ${s.for}, use ${s.use}${s.note ? `: ${s.note}` : ""}`);
    out.push("");
  }
  if (record.history.length) {
    out.push("## Version history", "");
    for (const h of list(d.history))
      out.push(`- Version ${h.version}, ${h.date}: ${h.summary}${h.doi ? ` (doi:${h.doi})` : ""}`);
    out.push("");
  }
  const refs = list(known(d.references));
  if (refs.length) out.push("## References", "", ...refs.map((r) => `- ${r}`), "");
  return `${out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
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
              .map((s) =>
                [
                  s.segments.map((x) => segmentText(x)).join(""),
                  ...s.flags.why,
                  ...s.flags.critical,
                ].join(" "),
              )
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
