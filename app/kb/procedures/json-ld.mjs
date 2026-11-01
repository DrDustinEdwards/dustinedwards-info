// The structured data a procedure page carries, from its D1 record: Bioschemas LabProtocol for a protocol
// (https://bioschemas.org/profiles/LabProtocol/0.9-DRAFT; every LabProtocol version is a draft), schema.org Recipe for a
// recipe, following Google's recipe structured-data guidance, and schema.org HowTo for a computational procedure, the closest type
// for a sequence of commands with tools and supplies. Only facts the record states: a gap stays out.

import { thing } from "@drdustinedwards/site-helpers/schema";

import { citeFacts } from "./cite.mjs";
import { readConditions } from "./marks.mjs";

const LAB_PROTOCOL_PROFILE = "https://bioschemas.org/profiles/LabProtocol/0.9-DRAFT";

/** A number as a step writes it: "13,000" is 13000. @param {string} n */
const numeral = (n) => Number(n.replaceAll(",", ""));

/**
 * The protocol's conditions as 0.9-DRAFT's `parameter` (docs/KNOWLEDGE-BASE.md, P4): every temperature and spin its steps
 * state, once each, in the order first stated. The profile puts them on the protocol as a whole, not on a step, and these
 * are the conditions the compile already reads (marks.mjs readConditions): from a step's words, and the g-force its
 * SPIN flag states. Nothing is typed twice.
 *
 * @param {import("./render.mjs").ProcedureRecord} record
 */
export function protocolParameters(record) {
  // Keyed by the condition, so one stated in several steps is one parameter, at the place it was first stated.
  /** @type {Map<string, Record<string, unknown>>} */
  const seen = new Map();
  for (const section of record.sections) {
    for (const block of section.blocks) {
      if (block.type !== "steps") continue;
      for (const step of block.steps) {
        // A row compiled before the conditions were stored has none until the next sync rewrites it.
        for (const t of step.temperatures ?? []) {
          seen.set(`t:${t.min}:${t.max}`, { "@type": "PropertyValue", name: "Temperature", ...(t.min === t.max ? { value: t.min } : { minValue: t.min, maxValue: t.max }), unitCode: "CEL", unitText: "°C" });
        }
        const flagged = (step.spin ?? []).flatMap((s) => readConditions(s).spins);
        for (const spin of [...(step.spins ?? []), ...flagged]) {
          const [low = "", high] = spin.speed.split(/\s*to\s*/);
          const range = high === undefined ? { value: numeral(low) } : { minValue: numeral(low), maxValue: numeral(high) };
          seen.set(`s:${spin.speed}:${spin.unit}`, { "@type": "PropertyValue", name: spin.unit === "rpm" ? "Rotor speed" : "Relative centrifugal force", ...range, unitText: spin.unit === "rpm" ? "rpm" : "x g" });
        }
      }
    }
  }
  return [...seen.values()];
}

/**
 * The procedure a variant was copied from, as `isBasedOn` names it (P3): its address, at the version copied when there is
 * a frozen copy of it, and its title. Resolved at request time from the parent's row (lineage.server.ts).
 *
 * @param {import("./lineage.mjs").Lineage | null} lineage
 * @param {string} origin
 */
function lineageWork(lineage, origin) {
  if (!lineage?.href) return [];
  return [{ "@type": "CreativeWork", name: lineage.title, url: `${origin}${lineage.href}`, ...(lineage.version ? { version: lineage.version } : {}) }];
}

/** @param {string | null | undefined} html */
function text(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "20 minutes", "1.5 hours" as ISO 8601; null for anything else.
 *
 * @param {string | null} value
 */
function isoDuration(value) {
  const m = /^(\d+(?:\.\d+)?) (minutes?|hours?)$/.exec(String(value ?? ""));
  if (!m) return null;
  const minutes = Math.round(Number(m[1]) * (m[2]?.startsWith("hour") ? 60 : 1));
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `PT${h ? `${h}H` : ""}${min || !h ? `${min}M` : ""}`;
}

/**
 * @param {import("./render.mjs").ProcedureRecord} record
 * @param {string} origin
 * @param {{ "@type": string, "@id": string, name: string, url: string }} person
 * @param {import("./lineage.mjs").Lineage | null} [lineage] the procedure this one is a variant of
 */
export function procedureJsonLd(record, origin, person, lineage = null) {
  const url = `${origin}${record.path}`;
  const steps = record.sections.flatMap((section) => {
    const items = section.blocks.flatMap((b) => (b.type === "steps" ? b.steps : []));
    if (items.length === 0) return [];
    return [
      {
        "@type": "HowToSection",
        name: section.title,
        itemListElement: items.map((step) => ({
          "@type": "HowToStep",
          position: step.number,
          text: step.text,
          url: `${url}#${section.id}`,
          ...(step.photos[0] ? { image: `${origin}${step.photos[0].src}` } : {}),
        })),
      },
    ];
  });
  const basedOn = [...lineageWork(lineage, origin), ...record.basedOn.map((s) => ({
    "@type": "CreativeWork",
    name: s.citation,
    ...(s.doi ? { identifier: `https://doi.org/${s.doi}`, url: `https://doi.org/${s.doi}` } : s.url ? { url: s.url } : {}),
  }))];
  const cite = citeFacts(record);
  // Prelum's `thing` writes the context and the type, then these, and drops an empty field.
  const common = {
    "@id": `${url}#procedure`,
    name: record.title,
    description: record.description,
    url,
    author: person,
    ...(record.updated ? { dateModified: record.updated } : {}),
    ...(record.version ? { version: record.version } : {}),
    ...(cite?.doi ? { identifier: `https://doi.org/${cite.doi}` } : {}),
    ...(basedOn.length ? { isBasedOn: basedOn } : {}),
    ...(record.references.length ? { citation: record.references.map(text) } : {}),
  };

  if (record.profile === "protocol") {
    return thing("LabProtocol", {
      ...common,
      "http://purl.org/dc/terms/conformsTo": { "@id": LAB_PROTOCOL_PROFILE },
      reagent: record.materials.map((m) => m.display),
      labEquipment: record.equipment.map((e) => e.name),
      ...(record.biosafetyLevel ? { additionalProperty: { "@type": "PropertyValue", name: "Biosafety level", value: record.biosafetyLevel } } : {}),
      ...(record.biosafety ? { bioSample: [record.biosafety.organism, record.biosafety.strain].filter(Boolean).join(" ") } : {}),
      ...(record.expectedResultsHtml ? { protocolOutcome: text(record.expectedResultsHtml) } : {}),
      ...(record.limitationsHtml ? { protocolLimitation: text(record.limitationsHtml) } : {}),
      ...(isoDuration(record.time.total) ? { totalTime: isoDuration(record.time.total) } : {}),
      ...(protocolParameters(record).length ? { parameter: protocolParameters(record) } : {}),
      step: steps,
    });
  }

  if (record.profile === "recipe") {
    const prep = isoDuration(record.prepTime);
    const cook = isoDuration(record.cookTime);
    const minutes = (/** @type {string | null} */ d) => {
      const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(d ?? "");
      return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : null;
    };
    const total = prep && cook ? isoDuration(`${(minutes(prep) ?? 0) + (minutes(cook) ?? 0)} minutes`) : null;
    return thing("Recipe", {
      ...common,
      ...(record.image ? { image: [`${origin}${record.image.src}`] } : {}),
      ...(record.servings ? { recipeYield: String(record.servings) } : {}),
      ...(record.cuisine ? { recipeCuisine: record.cuisine } : {}),
      ...(record.category ? { recipeCategory: record.category } : {}),
      ...(prep ? { prepTime: prep } : {}),
      ...(cook ? { cookTime: cook } : {}),
      ...(total ? { totalTime: total } : {}),
      recipeIngredient: record.materials.map((m) => (m.amount ? `${m.amount} ${m.display}` : m.display)),
      recipeInstructions: steps,
    });
  }

  return thing("HowTo", {
    ...common,
    tool: record.materials
      .filter((m) => m.kind === "software")
      .map((m) => ({ "@type": "HowToTool", name: m.version ? `${m.display} ${m.version}` : m.display })),
    supply: record.materials
      .filter((m) => m.kind !== "software")
      .map((m) => ({ "@type": "HowToSupply", name: m.display })),
    step: steps,
  });
}
