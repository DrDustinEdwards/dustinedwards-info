// Ruling 115, wave 1: the ten files, largest comment bytes first (measured at cdb4300
// by scratchpad/code-measure.mjs, the same ten Grok measured at 5b8007e).
export const WAVE1 = [
  "scripts/check-browser.mjs",
  "scripts/check-invariants.mjs",
  "scripts/check-admin-ui.mjs",
  "scripts/check-features.mjs",
  "scripts/verify-live.mjs",
  "app/routes/admin.media._index.tsx",
  "app/db/index.ts",
  "scripts/ship.mjs",
  "scripts/check-contrast.mjs",
  "scripts/check-all.mjs",
];

// Work chunks: [file, first block id, last block id], about 50 to 60 KB of
// comment each. Decisions for chunk N live in scratchpad/code-decisions/N.mjs.
export const CHUNKS = {
  1: ["scripts/check-browser.mjs", 0, 107],
  2: ["scripts/check-browser.mjs", 108, 259],
  3: ["scripts/check-browser.mjs", 260, 340],
  4: ["scripts/check-invariants.mjs", 0, 142],
  5: ["scripts/check-invariants.mjs", 143, 252],
  6: ["scripts/check-invariants.mjs", 253, 343],
  7: ["scripts/check-admin-ui.mjs", 0, 210],
  8: ["scripts/check-admin-ui.mjs", 211, 384],
  9: ["scripts/check-features.mjs", 0, 210],
  10: ["scripts/verify-live.mjs", 0, 159],
  11: ["app/routes/admin.media._index.tsx", 0, 125],
  12: ["app/db/index.ts", 0, 123],
  13: ["scripts/ship.mjs", 0, 95],
  14: ["scripts/check-contrast.mjs", 0, 130],
  15: ["scripts/check-all.mjs", 0, 94],
};

// Comment bytes the whole wave may keep: a fifth of the code bytes, so the
// wave lands at 20% comment. Each chunk gets the same share of its own bytes.
export const KEEP_SHARE = 0.19;
