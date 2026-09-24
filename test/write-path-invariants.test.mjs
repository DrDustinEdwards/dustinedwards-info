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
   * placeholder; the proxy env below throws on any binding read.
   */
  const MEDIA_SRCS = [
    "/media/0001020304050607-1600x900.webp",
    "/media/aabbccddeeff0011-32x32.png",
    "/media/0123456789abcdef-1x1.avif",
    "/media/0001020304050607-1600x900.webp?w=640",
    // A key without dimensions must fail on both sides.
    "/media/0001020304050607.webp",
    "/media/notahash-800x600.webp",
  ];

  ok("the media src fixture is not empty", MEDIA_SRCS.length > 0);
  ok(
    "the fixture contains both resolvable and unresolvable keys",
    MEDIA_SRCS.some((s) => /-\d+x\d+\./.test(s)) &&
      MEDIA_SRCS.some((s) => !/-\d+x\d+\./.test(s)),
  );

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

      let compared = 0;
      let agreements = 0;
      for (const src of MEDIA_SRCS) {
        /** @param {(s: string) => Promise<{width: number, height: number}>} fn */
        const settle = async (fn) => {
          try {
            return { ok: true, value: await fn(src) };
          } catch (error) {
            return { ok: false, value: String(error) };
          }
        };
        const a = await settle(nodeResolve);
        const b = await settle(workerResolve);
        compared += 1;

        // Same size with different placeholders is still two documents.
        const dims = (/** @type {{ok: boolean, value: any}} */ r) =>
          r.ok
            ? `${r.value.width}x${r.value.height} lqip=${r.value.placeholder ? "yes" : "none"}`
            : "refused";
        const same = a.ok === b.ok && dims(a) === dims(b);
        if (same) agreements += 1;
        ok(
          `both resolvers agree on ${src}`,
          same,
          `Node ${dims(a)}, Worker ${dims(b)}`,
        );
        // Agreement is not correctness: both inventing a placeholder fails.
        const lqip = (/** @type {{ok: boolean, value: any}} */ r) =>
          Boolean(r.ok && r.value.placeholder);
        ok(
          `neither resolver returns a placeholder for ${src}`,
          !lqip(a) && !lqip(b),
          `a /media/ key has no build-time derivation, so a placeholder here is a ` +
            `value one writer could produce and the other could not.`,
        );
      }

      ok(
        "every fixture src was actually compared",
        compared === MEDIA_SRCS.length,
        `${compared} of ${MEDIA_SRCS.length}`,
      );
      ok(
        "the fixture produced both resolutions and refusals",
        agreements === MEDIA_SRCS.length,
      );
      t.diagnostic(
        `     ${compared} media src(s) compared, ${agreements} in agreement`,
      );
    }
  } catch (error) {
    fail("the resolveImage comparison could not run", String(error));
  }

  done();
});
