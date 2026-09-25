import test from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { bundler, collector, root } from "./lib/invariants-harness.mjs";

const bundle = bundler("write-paths");

/* Bundling cold took 62s on a loaded host, past the suite's 60s default. */
test("write paths: the Node and Worker resolveImage paths agree", { timeout: 180_000 }, async (t) => {
  const { ok, fail, done } = collector();

  /**
   * Only `/media/` srcs are pure functions of the key. Neither resolver may give them a
   * placeholder; the proxy env below throws on any binding read. Each src carries the outcome both
   * resolvers must reach, so two resolvers that refuse everything fail rather than agree.
   */
  const MEDIA_SRCS = [
    { src: "/media/dustin-edwards-0001020304050607-1600x900.webp", resolves: true },
    { src: "/media/dustin-edwards-cover-aabbccddeeff0011-32x32.png", resolves: true },
    { src: "/media/dustin-edwards-0123456789abcdef-1x1.avif", resolves: true },
    { src: "/media/dustin-edwards-0001020304050607-1600x900.webp?w=640", resolves: true },
    // A key without dimensions, a key without a digest, and a key from before the prefix.
    { src: "/media/dustin-edwards-0001020304050607.webp", resolves: false },
    { src: "/media/dustin-edwards-notahash-800x600.webp", resolves: false },
    { src: "/media/0001020304050607-1600x900.webp", resolves: false },
  ];

  try {
    const nodeModule = await import(
      pathToFileURL(join(root, "scripts", "lib", "content.mjs")).href
    );
    const workerModule = await bundle(
      join(root, "app", "lib", "editor", "publish.server.ts"),
      "publish.mjs",
      /^(~\/(db|lib\/context|lib\/auth)|.*\.server(\.[tj]s)?$|\.\/github\.server)/,
    );

    ok(
      "the Node resolver is exported",
      typeof nodeModule.makeResolveImage === "function",
      "export makeResolveImage from scripts/lib/content.mjs so this test can reach it",
    );
    ok(
      "the Worker resolver is exported",
      typeof workerModule.makeResolveImage === "function",
    );

    if (
      typeof nodeModule.makeResolveImage === "function" &&
      typeof workerModule.makeResolveImage === "function"
    ) {
      const nodeResolve = nodeModule.makeResolveImage("content/posts/fixture.md");
      const workerResolve = workerModule.makeResolveImage(
        new Proxy(
          {},
          {
            get() {
              throw new Error("a /media/ resolve must not touch any binding");
            },
          },
        ),
      );

      /**
       * @param {(s: string) => Promise<{width: number, height: number}>} fn
       * @param {string} src
       */
      const settle = async (fn, src) => {
        try {
          return { ok: true, value: await fn(src) };
        } catch (error) {
          return { ok: false, value: String(error) };
        }
      };
      // Same size with different placeholders is still two documents.
      const dims = (/** @type {{ok: boolean, value: any}} */ r) =>
        r.ok
          ? `${r.value.width}x${r.value.height} lqip=${r.value.placeholder ? "yes" : "none"}`
          : "refused";
      const lqip = (/** @type {{ok: boolean, value: any}} */ r) =>
        Boolean(r.ok && r.value.placeholder);

      let resolutions = 0;
      let refusals = 0;
      for (const { src, resolves } of MEDIA_SRCS) {
        const a = await settle(nodeResolve, src);
        const b = await settle(workerResolve, src);
        if (a.ok && b.ok) resolutions += 1;
        if (!a.ok && !b.ok) refusals += 1;

        ok(
          `both resolvers agree on ${src}`,
          a.ok === b.ok && dims(a) === dims(b),
          `Node ${dims(a)}, Worker ${dims(b)}`,
        );
        ok(
          `both resolvers ${resolves ? "resolve" : "refuse"} ${src}`,
          a.ok === resolves && b.ok === resolves,
          `Node ${a.ok ? "resolved" : `refused: ${a.value}`}, Worker ${b.ok ? "resolved" : `refused: ${b.value}`}`,
        );
        // Agreement is not correctness: both inventing a placeholder fails.
        ok(
          `neither resolver returns a placeholder for ${src}`,
          !lqip(a) && !lqip(b),
          `a /media/ key has no build-time derivation, so a placeholder here is a ` +
            `value one writer could produce and the other could not.`,
        );
      }

      ok(
        "the fixture produced both resolutions and refusals",
        resolutions > 0 && refusals > 0,
        `${resolutions} resolved on both sides, ${refusals} refused on both sides`,
      );
      t.diagnostic(`     ${resolutions} media src(s) resolved, ${refusals} refused`);
    }
  } catch (error) {
    fail("the resolveImage comparison could not run", String(error));
  }

  done();
});
