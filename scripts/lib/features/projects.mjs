// The projects roster: every card's shape, its metric, its citations, and the page that renders it.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isAllowedUrl } from "../../../app/lib/content/pipeline.mjs";
import { PHAGE_YEARS } from "../../../app/data/phage-hunters.ts";
import {
  METRIC_DERIVATIONS,
  PROJECTS_URL,
  metricValue,
  projectAnchor,
} from "../../../app/lib/projects-page.mjs";
import { assertFloor } from "../floor.mjs";
import { checkRosterProse } from "./prose-numbers.mjs";
import { codeOf, pageReadsItsList, pageRecordParity, root } from "./shared.mjs";

const PROJECTS_PATH = join(root, "content", "projects.json");
const PROJECTS_ROUTE_PATH = join(root, "app", "routes", "projects.tsx");

const REQUIRED = [
  "slug",
  "name",
  "oneLiner",
  "description",
  "schemaType",
  "role",
  "status",
  "stack",
  "metric",
];
const STATUSES = ["live", "building", "internal"];
/* Closed: the route shapes structured data for these only. */
const SCHEMA_TYPES = ["SoftwareApplication", "WebPage"];
const EVIDENCE_KINDS = ["post", "page", "repo"];

/**
 * One citation on a card: a known kind, a label, cited once, and a target the live site serves.
 *
 * @param {import("./shared.mjs").FeaturesContext} ctx
 * @param {string} id
 * @param {any} item
 * @param {Set<string>} seenRefs
 */
function checkEvidence({ ok, routes, publishedTitles }, id, item, seenRefs) {
  const ref = String(item?.ref ?? "(no ref)");
  ok(
    `${id} evidence ${ref} declares a known kind`,
    EVIDENCE_KINDS.includes(item?.kind),
    `got ${JSON.stringify(item?.kind)}; the route throws on anything but ` +
      `${EVIDENCE_KINDS.join(", ")}`,
  );
  ok(
    `${id} evidence ${ref} carries a label`,
    typeof item?.label === "string" && item.label.trim().length > 0,
    `a citation with no label renders as a link with no text`,
  );
  ok(
    `${id} evidence ${ref} is cited once`,
    !seenRefs.has(`${item?.kind}:${ref}`),
    `duplicated within this card, which the route would render as two ` +
      `identical links and React would key identically`,
  );
  seenRefs.add(`${item?.kind}:${ref}`);

  if (item?.kind === "page") {
    ok(
      `${id} evidence cites a declared route: ${ref}`,
      routes.has(ref),
      `routes.ts declares no such path, so this citation is a link to nothing. ` +
        `parsed: ${[...routes].join(", ")}`,
    );
    return;
  }

  if (item?.kind === "repo") {
    ok(
      `${id} evidence repo passes the URL protocol allowlist: ${ref}`,
      isAllowedUrl(ref),
      `not an allowed protocol (rule 6)`,
    );
    return;
  }

  if (item?.kind !== "post") return;
  ok(
    `${id} evidence cites a published post: ${ref}`,
    publishedTitles.has(ref),
    `no published post has that slug. A draft or a typo here is a link to ` +
      `a page the live site does not serve.`,
  );
  /* Must equal the post's title; a stale one would still link. */
  if (!publishedTitles.has(ref)) return;
  ok(
    `${id} evidence label matches the post's title: ${ref}`,
    item.label === publishedTitles.get(ref),
    `card says ${JSON.stringify(item.label)}, the corpus says ` +
      `${JSON.stringify(publishedTitles.get(ref))}`,
  );
}

/** @param {import("./shared.mjs").FeaturesContext} ctx */
export function checkProjects(ctx) {
  const { ok, tally, routes, stack } = ctx;
  /* The projects roster; parity catches a roster edited without a rebuild. */
  console.log("\n  projects roster");

  const projectsDoc = JSON.parse(readFileSync(PROJECTS_PATH, "utf8"));
  const projects = projectsDoc.projects ?? [];
  const vocabulary = projectsDoc.stackVocabulary ?? [];
  const projectsChecksBefore = tally.checks;

  const METRIC_INPUTS = { stack, phageYears: PHAGE_YEARS };

  // Fail closed: an empty roster passes every loop below.
  const MINIMUM_PROJECTS = 5;
  const projectsBreach = assertFloor(
    "check:features",
    "projects",
    projects.length,
    MINIMUM_PROJECTS,
    "A shorter list means the file was truncated, not curated.",
  );
  ok("the roster is non-empty", projectsBreach === null, projectsBreach ?? "");
  ok(
    "the stack vocabulary is non-empty",
    vocabulary.length > 0,
    "an empty vocabulary would make every tag check pass vacuously",
  );

  // The route must be the one the page module names, not a string typed here.
  ok(
    `routes.ts declares ${PROJECTS_URL}`,
    routes.has(PROJECTS_URL),
    `parsed routes: ${[...routes].join(", ")}`,
  );

  const seenSlugs = new Set();

  for (const project of projects) {
    const id = project.slug ?? "(no slug)";

    for (const field of REQUIRED) {
      ok(
        `${id} declares ${field}`,
        project[field] !== undefined && project[field] !== null && project[field] !== "",
        `missing or empty`,
      );
    }

    ok(`${id} has a unique slug`, !seenSlugs.has(project.slug), "duplicated in the roster");
    seenSlugs.add(project.slug);

    ok(
      `${id} status is one of ${STATUSES.join(", ")}`,
      STATUSES.includes(project.status),
      `got ${project.status}`,
    );

    for (const field of ["url", "repo"]) {
      const value = project[field];
      if (value === null || value === undefined) continue;
      ok(
        `${id} ${field} passes the URL protocol allowlist`,
        isAllowedUrl(String(value)),
        `${value} is not an allowed protocol (rule 6)`,
      );
    }

    const stack = Array.isArray(project.stack) ? project.stack : [];
    ok(`${id} declares at least one stack tag`, stack.length > 0);
    for (const tag of stack) {
      ok(
        `${id} stack tag is in the closed vocabulary: ${tag}`,
        vocabulary.includes(tag),
        `not in stackVocabulary`,
      );
    }

    ok(
      `${id} schemaType is one of ${SCHEMA_TYPES.join(", ")}`,
      SCHEMA_TYPES.includes(project.schemaType),
      `got ${JSON.stringify(project.schemaType)}; the route emits this as the item's ` +
        `@type and branches on it, so an unknown value is structured data nobody designed`,
    );

    const metric = project.metric ?? {};
    ok(`${id} metric has a label`, typeof metric.label === "string" && metric.label.length > 0);

    const isDerived = metric.derived !== undefined;
    ok(
      `${id} metric declares a value or a derivation, never both`,
      isDerived !== (metric.value !== undefined),
      isDerived && metric.value !== undefined
        ? `it declares both, so two things own how fresh this number is`
        : `it declares neither, so the card has no number to lead with`,
    );

    if (isDerived) {
      ok(
        `${id} metric names a derivation that exists`,
        Object.hasOwn(METRIC_DERIVATIONS, metric.derived),
        `got ${JSON.stringify(metric.derived)}; METRIC_DERIVATIONS implements ` +
          `${Object.keys(METRIC_DERIVATIONS).join(", ")}`,
      );
      ok(
        `${id} metric carries no asOf date, because a derived value cannot rot`,
        metric.asOf === undefined,
        `a date beside a value this build recomputed records when a human last ` +
          `looked, which is the tense-bound claim rule 17 was extended to cover`,
      );
      if (Object.hasOwn(METRIC_DERIVATIONS, metric.derived)) {
        const derivedValue = metricValue(metric, METRIC_INPUTS);
        ok(
          `${id} metric derives a non-empty value: ${metric.derived}`,
          typeof derivedValue === "string" && derivedValue.length > 0 && derivedValue !== "0",
          `derived ${JSON.stringify(derivedValue)}; zero or empty means the input ` +
            `collection is gone, and the card would render a number that is really an absence`,
        );
      }
    } else {
      ok(
        `${id} metric has a value`,
        typeof metric.value === "string" && metric.value.length > 0,
      );
      ok(
        `${id} metric carries an ISO asOf date`,
        typeof metric.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metric.asOf),
        `got ${JSON.stringify(metric.asOf)}; a number without a date is the thing this page refuses`,
      );
    }

    if (project.notable !== undefined) {
      const notable = Array.isArray(project.notable) ? project.notable : [];
      ok(
        `${id} notable carries two or three sentences`,
        notable.length >= 2 && notable.length <= 3,
        `${notable.length} present; the field is optional, so an entry with nothing ` +
          `derivable omits it rather than padding it`,
      );
      for (const [index, point] of notable.entries()) {
        ok(
          `${id} notable[${index}] is a non-empty string`,
          typeof point === "string" && point.trim().length > 0,
        );
      }
    }

    if (project.evidence !== undefined) {
      const evidence = Array.isArray(project.evidence) ? project.evidence : [];
      ok(
        `${id} evidence is non-empty when declared`,
        evidence.length > 0,
        `an empty list renders nothing and means nothing; omit the field instead`,
      );
      const seenRefs = new Set();
      for (const item of evidence) checkEvidence(ctx, id, item, seenRefs);
    }
  }

  // Closed both ways: an unused term stops meaning anything.
  for (const term of vocabulary) {
    ok(
      `vocabulary term is used by at least one project: ${term}`,
      projects.some((/** @type {any} */ p) => (p.stack ?? []).includes(term)),
      `nothing declares it`,
    );
  }

  checkRosterProse(ok, projects);

  const projectsSource = codeOf(PROJECTS_ROUTE_PATH);
  pageReadsItsList(ok, projectsSource, {
    route: "projects.tsx",
    list: "roster",
    json: "projects.json",
    reads: /import\s+projectsData\s+from\s+["'][^"']*content\/projects\.json["']/,
    noun: "card",
    anchorFn: "projectAnchor",
    anchorModule: /from\s+["']~\/lib\/projects-page\.mjs["']/,
  });

  /* Asserted on code: a field nothing renders passes every shape check. */
  ok(
    "the page computes derived metrics through metricValue",
    /metricValue\(/.test(projectsSource),
    "app/routes/projects.tsx must call the shared derivation, or a derived metric " +
      "renders as undefined and the gate above is checking a value nobody sees",
  );
  ok(
    "the page does not implement a derivation itself",
    !/METRIC_DERIVATIONS/.test(projectsSource),
    "the route names METRIC_DERIVATIONS, so it holds a second way to compute a value " +
      "the shared function already owns",
  );
  ok(
    "the page renders the notable list",
    /project\.notable/.test(projectsSource),
    "the manifest carries notable sentences the page never reads",
  );
  ok(
    "the page renders the evidence list",
    /project\.evidence/.test(projectsSource),
    "the manifest carries citations the page never reads",
  );
  ok(
    "the page emits the declared schema type rather than a literal",
    /"@type":\s*project\.schemaType/.test(projectsSource) &&
      !/"@type":\s*"SoftwareApplication"/.test(projectsSource),
    "the item's @type must come from the entry, or the roster page is emitted as an " +
      "application again and the field is decoration",
  );
  /* Unbranched, a derived metric renders an empty `<time>`. */
  ok(
    "the page renders a provenance line for both metric forms",
    /metric\.derived\s*!==\s*undefined/.test(projectsSource) &&
      /dateTime=\{metric\.asOf\}/.test(projectsSource),
    "both branches must be present: a derived metric says it was derived, a dated " +
      "one renders its <time>",
  );

  const projectRecords = pageRecordParity(
    ctx,
    "page:projects",
    { kind: "project", page: "projects", item: "project", list: "roster" },
    projects.map((/** @type {any} */ p) => ({ slug: p.slug, anchor: projectAnchor(p.slug) })),
  );

  /* Executed-count floor, measured by running the gate, never by summing. */
  const projectsChecks = tally.checks - projectsChecksBefore;
  const MINIMUM_PROJECT_CHECKS = 281;
  const projectsFloorBreach = assertFloor(
    "check:features",
    "projects-checks",
    projectsChecks,
    MINIMUM_PROJECT_CHECKS,
  );
  if (projectsFloorBreach) {
    ok("the projects section executed its assertions", false, projectsFloorBreach);
  }

  console.log(
    `  ${projects.length} project(s), ${vocabulary.length} vocabulary term(s), ` +
      `${projectRecords.length} artifact record(s), ${projectsChecks} assertion(s)`,
  );
}
