// The media key demo: every preset through the real classifier, and the page runs that module.

import {
  classify,
  cropSafe,
  digestFromKey,
  dimensionsFromKey,
  isContentKey,
  isRaster,
  roleOf,
  storageOf,
} from "../../../../app/lib/media/classify.mjs";

/** @param {import("./index.mjs").PlaygroundContext} p */
export function checkMediaKey({ ok, keyPresets, playgroundSource, statesInputCap }) {
  for (const preset of keyPresets) {
    const label = preset.label ?? preset.key;
    const expect = preset.expect ?? {};

    ok(
      `media key: ${label} declares a key`,
      typeof preset.key === "string" && preset.key.length > 0,
    );
    ok(
      `media key: ${label} declares a note`,
      typeof preset.note === "string" && preset.note.trim().length > 0,
      "each preset's note is what the reader gets instead of a table of booleans",
    );

    ok(
      `media key: ${label} isContentKey is ${expect.contentKey}`,
      isContentKey(preset.key) === expect.contentKey,
      `the module says ${isContentKey(preset.key)}`,
    );
    ok(
      `media key: ${label} digest is ${JSON.stringify(expect.digest)}`,
      digestFromKey(preset.key) === expect.digest,
      `the module says ${JSON.stringify(digestFromKey(preset.key))}`,
    );

    const measured = dimensionsFromKey(preset.key);
    const measuredText = measured ? `${measured.width}x${measured.height}` : null;
    ok(
      `media key: ${label} dimensions are ${JSON.stringify(expect.dimensions)}`,
      measuredText === expect.dimensions,
      `the module says ${JSON.stringify(measuredText)}`,
    );

    ok(
      `media key: ${label} storage tier is ${expect.storage}`,
      storageOf(preset.key) === expect.storage,
      `the module says ${storageOf(preset.key)}`,
    );
    ok(
      `media key: ${label} role is ${expect.role}`,
      roleOf(preset.key) === expect.role,
      `the module says ${roleOf(preset.key)}`,
    );

    /* "refused" is an answer, so the throw branch runs. Only the classifier's own refusal counts: any
       other exception is a crash, and reading it as "refused" would pass every refusal preset. */
    let actualKind;
    try {
      actualKind = classify(preset.key).kind;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      actualKind = message.startsWith("unclassified asset ") ? "refused" : `a crash: ${message}`;
    }
    ok(
      `media key: ${label} classifies as ${expect.kind}`,
      actualKind === expect.kind,
      `the module says ${actualKind}`,
    );

    ok(
      `media key: ${label} isRaster is ${expect.raster}`,
      isRaster(preset.key) === expect.raster,
      `the module says ${isRaster(preset.key)}`,
    );
    ok(
      `media key: ${label} cropSafe is ${expect.cropSafe}`,
      cropSafe(preset.key) === expect.cropSafe,
      `the module says ${cropSafe(preset.key)}`,
    );
  }

  const presetKinds = new Set(keyPresets.map((/** @type {any} */ p) => p.expect?.kind));
  const presetStorage = new Set(keyPresets.map((/** @type {any} */ p) => p.expect?.storage));
  const presetRoles = new Set(keyPresets.map((/** @type {any} */ p) => p.expect?.role));
  ok(
    "media key: a preset exercises the classifier's refusal",
    presetKinds.has("refused"),
    "without one, the throw branch is never entered and the fail-closed design is untested",
  );
  ok(
    "media key: a preset exercises each storage tier",
    ["static", "r2", "r2-derived"].every((tier) => presetStorage.has(tier)),
    `covered: ${[...presetStorage].join(", ")}`,
  );
  ok(
    "media key: presets exercise more than one role",
    presetRoles.size >= 2,
    `covered: ${[...presetRoles].join(", ")}`,
  );
  ok(
    "media key: a preset carries a dimension segment and another does not",
    keyPresets.some((/** @type {any} */ p) => p.expect?.dimensions !== null) &&
      keyPresets.some((/** @type {any} */ p) => p.expect?.dimensions === null),
    "the optional segment is the part of the grammar that drifted, so both forms " +
      "have to be present or the pin is on the easy half",
  );

  ok(
    "media key: the page imports the grammar's readers",
    /from\s+["']~\/lib\/media\/classify\.mjs["']/.test(playgroundSource),
    "the demo must run the module, not a parser written here",
  );
  ok(
    "media key: the page carries no content-key regex of its own",
    !/\[0-9a-f\]\{16\}/.test(playgroundSource),
    "a second spelling of the grammar in this route is exactly the defect the " +
      "demo exists to describe",
  );
  ok(
    "media key: the page renders the classifier's refusal rather than swallowing it",
    /classifyRefusal/.test(playgroundSource),
    "a caught throw that renders nothing turns the module's loudest behavior into " +
      "a blank row",
  );
  statesInputCap("media key: ", /Up to \{KEY_CAP\} characters/);
}
