/** Which tier each gate runs in, which are left to CI, and the arguments a gate takes against a remote. */

/** @type {Record<string, string>} */
export const CI_EXCLUDED = {
  /* Provisioning a CI D1 would invent the state the backup path is checked against. */
  "check:backup": "needs the gitignored .wrangler/ miniflare state, absent from a checkout.",
  /* Needs gitignored local D1 content. Kept off ship: a slow preview boot on a loaded machine would
     fail a ship for a reason that is not the site. */
  "check:browser":
    "its public cases need gitignored local D1 content; the admin cases are CI-capable via SMOKE_TOKEN. Ruled 2026-09-14: stays on the network tier and the daily schedule, because a preview-server boot past the readiness ceiling on a loaded machine would fail a ship for a reason that is not the site.",
  "check:systems-map":
    "boots a preview server and a browser, ruled off the clean checkout with check:browser (2026-09-14); .github/workflows/systems-map.yml runs it on each pull request that touches the map.",
};

/** @type {Record<string, "offline" | "network" | undefined>} */
export const TIERS = {
  "check:types": "offline",
  "check:tests": "offline",
  // Offline: test/worker/setup.ts makes any outbound fetch throw.
  "check:worker": "offline",
  "check:content": "offline",
  "check:features": "offline",
  "check:fonts": "offline",
  "check:postinstall": "offline",
  "check:contrast": "offline",
  "check:secrets": "offline",
  "check:migrations": "offline",
  // The console.* ratchet (devkit-console, .console.json): raw calls in server code may only go down.
  "check:console": "offline",
  "check:ask-guards": "offline",
  "check:test-assertions": "offline",
  // Offline: the renderer takes alt from the reference alone, never from the media index in D1.
  "check:alt-text": "offline",
  "check:urls": "offline",
  // Offline: the address book is built from the sources, never from D1, R2 or the network.
  "check:links": "offline",
  "check:destructive": "offline",
  "check:backup": "offline",
  // Network: the preview server's AI_SEARCH binding reaches a real instance.
  "check:browser": "network",
  // Network for check:browser's reason: a preview boot. Its own workflow runs it on each pull request that touches the map.
  "check:systems-map": "network",
};

/** @type {Record<string, string[] | undefined>} */
export const REMOTE_ARGS = {
  "check:backup": ["--remote"],
  "check:content": ["--remote"],
};
