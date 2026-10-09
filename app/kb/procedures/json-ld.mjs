// The structured data a procedure page carries, from its D1 record: Bioschemas LabProtocol for a
// protocol (https://bioschemas.org/profiles/LabProtocol/0.8-DRAFT, the version the profile's page
// resolves to; every LabProtocol version is a draft), schema.org Recipe for a recipe, following Google's
// recipe structured-data guidance, and schema.org HowTo for a computational procedure, the closest type
// for a sequence of commands with tools and supplies. Only facts the record states: a gap stays out.

import { citeFacts } from "./cite.mjs";

const LAB_PROTOCOL_PROFILE = "https://bioschemas.org/profiles/LabProtocol/0.8-DRAFT";

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
export function isoDuration(value) {
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
 */
export function procedureJsonLd(record, origin, person) {
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
  const basedOn = record.basedOn.map((s) => ({
    "@type": "CreativeWork",
    name: s.citation,
    ...(s.doi ? { identifier: `https://doi.org/${s.doi}`, url: `https://doi.org/${s.doi}` } : s.url ? { url: s.url } : {}),
  }));
  const cite = citeFacts(record);
  const common = {
    "@context": "https://schema.org",
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
    return {
      ...common,
      "@type": "LabProtocol",
      "http://purl.org/dc/terms/conformsTo": { "@id": LAB_PROTOCOL_PROFILE },
      reagent: record.materials.map((m) => m.display),
      labEquipment: record.equipment.map((e) => e.name),
      ...(record.biosafetyLevel ? { additionalProperty: { "@type": "PropertyValue", name: "Biosafety level", value: record.biosafetyLevel } } : {}),
      ...(record.biosafety ? { bioSample: [record.biosafety.organism, record.biosafety.strain].filter(Boolean).join(" ") } : {}),
      ...(record.expectedResultsHtml ? { protocolOutcome: text(record.expectedResultsHtml) } : {}),
      ...(record.limitationsHtml ? { protocolLimitation: text(record.limitationsHtml) } : {}),
      ...(isoDuration(record.time.total) ? { totalTime: isoDuration(record.time.total) } : {}),
      step: steps,
    };
  }

  if (record.profile === "recipe") {
    const prep = isoDuration(record.prepTime);
    const cook = isoDuration(record.cookTime);
    const minutes = (/** @type {string | null} */ d) => {
      const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(d ?? "");
      return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : null;
    };
    const total = prep && cook ? isoDuration(`${(minutes(prep) ?? 0) + (minutes(cook) ?? 0)} minutes`) : null;
    return {
      ...common,
      "@type": "Recipe",
      ...(record.image ? { image: [`${origin}${record.image.src}`] } : {}),
      ...(record.servings ? { recipeYield: String(record.servings) } : {}),
      ...(record.cuisine ? { recipeCuisine: record.cuisine } : {}),
      ...(record.category ? { recipeCategory: record.category } : {}),
      ...(prep ? { prepTime: prep } : {}),
      ...(cook ? { cookTime: cook } : {}),
      ...(total ? { totalTime: total } : {}),
      recipeIngredient: record.materials.map((m) => (m.amount ? `${m.amount} ${m.display}` : m.display)),
      recipeInstructions: steps,
    };
  }

  return {
    ...common,
    "@type": "HowTo",
    tool: record.materials
      .filter((m) => m.kind === "software")
      .map((m) => ({ "@type": "HowToTool", name: m.version ? `${m.display} ${m.version}` : m.display })),
    supply: record.materials
      .filter((m) => m.kind !== "software")
      .map((m) => ({ "@type": "HowToSupply", name: m.display })),
    step: steps,
  };
}
