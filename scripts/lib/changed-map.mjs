/** check:changed's map: which gates would notice an edit to which paths. */

/** Not a gate: the node tests and worker tests that import a changed file. */
export const RELATED = "related tests";

/**
 * A gate belongs on a rule when it would notice the edit, not when it merely runs nearby.
 *
 * @type {Array<{what: string, test: RegExp, gates: string[]}>}
 */
export const MAP = [
  {
    what: "a stylesheet",
    test: /^app\/(app\.css|styles\/.+\.css)$/,
    gates: ["check:contrast"],
  },
  {
    what: "a route, component or other app source",
    test: /^app\/.+\.(ts|tsx|mjs)$/,
    gates: [
      "check:features",
      "check:content",
      "check:urls",
      "check:links",
      "check:console",
      RELATED,
    ],
  },
  {
    /* check-ask-guards reads route files by name and scans app/routes. */
    what: "a route module",
    test: /^app\/routes\/.+\.(ts|tsx)$/,
    gates: ["check:ask-guards"],
  },
  {
    /* check-ask-guards reads the operator bearer and API, and the Ask corpus. */
    what: "a module the Ask guards read",
    test: /^app\/lib\/(operator\/.+\.ts|search\/(ask\.server\.ts|search\.server\.ts|visibility\.mjs))$/,
    gates: ["check:ask-guards"],
  },
  {
    what: "the schema or a migration",
    test: /^(app\/db\/schema\.ts|drizzle\/.+)$/,
    gates: ["check:migrations", RELATED],
  },
  {
    /* The admin MCP is its own package with its own gates, run by CI's mcp job and by `npm test`,
       `npm run check:wrapper` and `npm run check:wrapper:plant` inside mcp/. Of the site's gates only
       the tracked-file credential scan reads it. */
    what: "the admin MCP in mcp/",
    test: /^mcp\//,
    gates: ["check:secrets"],
  },
  {
    /* check-alt-text reads the HTML this pipeline writes, so a change to how it draws an image changes what it sees. */
    what: "the markdown pipeline",
    test: /^app\/lib\/(content\/pipeline|media\/images)\.mjs$/,
    gates: ["check:alt-text"],
  },
  {
    what: "a Worker entry",
    test: /^workers\/.+\.ts$/,
    gates: ["check:urls", "check:ask-guards", "check:secrets", RELATED],
  },
  {
    what: "a post or other content",
    test: /^content\/.+/,
    gates: ["check:content", "check:features", "check:links", "check:alt-text"],
  },
  {
    /* check:content's protocols part compiles every procedure and fixture with the save tool's own validator. */
    what: "a procedure, a procedure fixture or the procedure system",
    test: /^(content\/procedures\/.+\.md|test\/fixtures\/procedures\/.+\.md|app\/kb\/procedures\/.+|app\/kb\/bases\.mjs|scripts\/lib\/procedures\.mjs)$/,
    gates: ["check:content", RELATED],
  },
  {
    /* check:content imports each part by name (scripts/check-content.mjs, PARTS). */
    what: "a check:content part",
    test: /^scripts\/machine-readable\/.+\.mjs$/,
    gates: ["check:content"],
  },
  {
    /* content/publications/ is also a content path above; the cited-by snapshot and the publication
       build and gate modules are not, and each changes what the publication gates read. */
    what: "the cited-by snapshot or the publication build and gate modules",
    test: /^(data\/.+|scripts\/lib\/publications\.mjs|scripts\/machine-readable\/publications-.+)$/,
    gates: ["check:content", "check:links"],
  },
  {
    /* build:content compiles every page with these modules and check:links reads the result; the page
       save runs the same compile, so a change here changes what a save accepts. */
    what: "the page system",
    test: /^(app\/lib\/pages\/.+|app\/db\/pages\.ts|app\/lib\/(phage-table|phage-tools)\.mjs)$/,
    gates: ["check:content", "check:links", "check:alt-text", RELATED],
  },
  {
    /* The file CI judges and the save judges: check:content runs the shared rules on it. */
    what: "the llms.txt rules",
    test: /^(app\/lib\/llms\/.+|scripts\/machine-readable\/llms\.mjs)$/,
    gates: ["check:content", "check:links", RELATED],
  },
  {
    /* content/cv/ is a content path above; build:content compiles it with these modules, check:links reads
       the result and check:content reads the twin, and the CV save runs the same compile. */
    what: "the CV system",
    test: /^(app\/lib\/cv\/.+|app\/db\/cv\.ts|scripts\/lib\/cv\.mjs|scripts\/build-cv-pdf\.mjs)$/,
    gates: ["check:content", "check:links", "check:alt-text", RELATED],
  },
  {
    /* build:content compiles every entry with these modules and check:links reads the twin it leads; the
       dictionary save runs the same compile, so a change here changes what a save accepts. */
    what: "the dictionary system",
    test: /^(app\/lib\/dictionary\/.+|app\/lib\/dictionary-entries\.mjs|app\/db\/dictionary\.ts|scripts\/lib\/dictionary\.mjs)$/,
    gates: ["check:content", "check:links", RELATED],
  },
  {
    /* check:content compiles every cohort file with the roster validator (app/lib/roster/compile.mjs);
       the roster save runs the same compile, so a change here changes what a save accepts. */
    what: "the roster system",
    test: /^(content\/roster\/.+|app\/lib\/roster\/.+|app\/db\/roster\.ts|scripts\/lib\/roster\.mjs)$/,
    gates: ["check:content", RELATED],
  },
  {
    /* check:content compiles every phage file with the phage validator (app/lib/phages/compile.mjs) and draws the
       page from them; the phage save runs the same compile, so a change here changes what a save accepts. */
    what: "the phage table",
    test: /^(content\/phages\/.+|app\/lib\/phages\/.+|app\/db\/phages\.ts|scripts\/lib\/phages\.mjs)$/,
    gates: ["check:content", "check:links", RELATED],
  },
  {
    /* check:content compiles every registry file with its kind's validator (app/kb/registry/compile.mjs); the
       registry save runs the same compile, so a change here changes what a save accepts. */
    what: "the lab registry",
    test: /^(content\/registry\/.+|app\/kb\/registry\/.+|app\/db\/registry\.ts|scripts\/lib\/registry\.mjs)$/,
    gates: ["check:content", "check:links", RELATED],
  },
  {
    /* devkit-bootstrap --check reads package.json's scripts for a bare `wrangler types`. */
    what: "the install step",
    test: /^package\.json$/,
    gates: ["check:postinstall"],
  },
  {
    what: "a served asset",
    test: /^public\/.+/,
    gates: ["check:urls", "check:fonts", "check:links"],
  },
  {
    /* check-urls asserts which entrypoint wrangler.jsonc.example lets the platform cache. */
    what: "the wrangler config example",
    test: /^wrangler\..*jsonc?(\.example)?$/,
    gates: ["check:secrets", "check:urls"],
  },
  {
    what: "a test",
    test: /^test\/.+/,
    gates: [RELATED, "check:test-assertions"],
  },
  {
    /* No gate or test reads these (the last hook test went with stop-typecheck.sh), so a change here
       runs nothing rather than falling through to the whole tier. */
    what: "a document, skill or hook, which no gate reads",
    test: /^(\.claude\/.+|[A-Za-z-]+\.md|docs\/.+\.md)$/,
    gates: [],
  },
];

/**
 * A rule rather than a map row because the gate name comes out of the path.
 *
 * @param {string} file
 * @returns {string[] | null}
 */
function ownGate(file) {
  const m = /^scripts\/check-([a-z0-9-]+)\.mjs$/.exec(file);
  return m ? [`check:${m[1]}`] : null;
}

/**
 * @param {string} file
 * @param {Set<string>} declared
 * @returns {{ own: string[] | null, rules: typeof MAP, gates: string[] }}
 */
export function gatesFor(file, declared) {
  const own = ownGate(file);
  const rules = MAP.filter((r) => r.test.test(file));
  const gates = [...(own ?? []), ...rules.flatMap((r) => r.gates)].filter(
    (g) => g === RELATED || declared.has(g),
  );
  return { own, rules, gates: [...new Set(gates)] };
}
