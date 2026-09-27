import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../workers/app";
import { EXPLICIT_ROWS } from "~/lib/wordpress-redirects.mjs";

import { STUB_GONE_BODY } from "./stub-server-build";

/* Through the gateway with the apex Host, the way a reader arrives after DNS moves: each explicit row
 * and each pattern rule of cutover.md's redirect map, status and Location. */

const APEX = "https://dustinedwards.info";

async function get(url: string) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(url, { redirect: "manual" }) as never, env as never, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function expectMoved(path: string, target: string, origin = APEX) {
  const response = await get(`${origin}${path}`);
  expect(response.status, path).toBe(301);
  expect(response.headers.get("location"), path).toBe(`${origin}${target}`);
}

async function expectGone(path: string) {
  const response = await get(`${APEX}${path}`);
  expect(response.status, path).toBe(410);
  expect(response.headers.get("location"), path).toBeNull();
  expect(await response.text(), path).toBe(STUB_GONE_BODY);
}

describe("explicit rows, on the apex host", () => {
  for (const [from, to] of Object.entries(EXPLICIT_ROWS)) {
    // `/research/` rebuilds its page in place, so only its slashed form moves.
    const bareIsThePage = from === to;
    it(`${from}/ answers 301 to ${to}`, async () => {
      await expectMoved(`${from}/`, to);
      if (!bareIsThePage) await expectMoved(from, to);
    });
  }
});

describe("pattern rules, on the apex host", () => {
  it("/discovery-of-{name}/ and /annotation-of-{name}/ go to the phage's row on /research/phages", async () => {
    await expectMoved("/discovery-of-lucinda/", "/research/phages#lucinda");
    await expectMoved("/discovery-of-acorn15", "/research/phages#acorn15");
    await expectMoved("/annotation-of-arlo/", "/research/phages#arlo");
  });

  it("the four phage project pages go to /research/phages", async () => {
    for (const path of ["/phylogenetics-lysm/", "/arlo-gene-67/", "/arlo-gene-67-cloning/", "/raspberry-pi-plaque-counter/"]) {
      await expectMoved(path, "/research/phages");
    }
  });

  it("/directory-*/ goes to /research/science-education", async () => {
    await expectMoved("/directory-2023-phage-researchers/", "/research/science-education");
    await expectMoved("/directory-research-group/", "/research/science-education");
  });

  it("student and author profiles answer 410, query and all", async () => {
    // Placeholders: real profile names are not kept in this repository.
    await expectGone("/user/example-student/");
    await expectGone("/user/example-student/?profiletab=main");
    await expectGone("/author/example/");
    await expectGone("/user/");
  });

  it("the membership pages answer 410", async () => {
    for (const path of ["/register/", "/members/", "/logout/", "/account/", "/password-reset/"]) {
      await expectGone(path);
    }
  });

  it("isolation-notes archives and paged listings go to /research/phages, query dropped", async () => {
    await expectMoved("/category/phage-isolation-notes/page/5/", "/research/phages");
    await expectMoved("/microbiomes/page/5/?et_blog", "/research/phages");
    await expectMoved("/phages/page/2/?et_blog", "/research/phages");
  });

  it("knowledge-base categories go to /research/protocols", async () => {
    await expectMoved("/knowledge-base/category/protocols/pcr/", "/research/protocols");
    await expectMoved("/knowledge-base/category/articles/", "/research/protocols");
  });

  it("every other category and tag answers 410", async () => {
    await expectGone("/category/uncategorized/");
    await expectGone("/category/phage-annotation-notes/");
    await expectGone("/tag/fall-2025/");
  });

  it("the Baylor DNA extraction PDF goes to its protocol page", async () => {
    await expectMoved(
      "/wp-content/uploads/2017/09/DNA-Extraction-Protocol-Baylor.pdf",
      "/research/protocols/phage-dna-extraction",
    );
  });

  it("the 2019 CV PDF goes to /about", async () => {
    await expectMoved("/wp-content/uploads/2019/02/Dustin-Edwards-Curriculum-Vitae-2019.pdf", "/about");
  });

  it("every other upload answers 410", async () => {
    await expectGone("/wp-content/uploads/2023/11/Electrophoresis.pdf");
    await expectGone("/wp-content/uploads/2017/09/Spot-Titer.png");
  });

  it("the old /publications/ goes to /research/publications in one hop", async () => {
    await expectMoved("/publications/", "/research/publications");
  });
});

describe("the map's edges", () => {
  it("www answers the same map", async () => {
    await expectMoved("/virus-isolation/", "/research/protocols/phage-isolation", "https://www.dustinedwards.info");
  });

  it("NEVER applies on another host: workers.dev passes the path to the Renderer", async () => {
    const moved = await get("https://dustinedwards.dustin-edwards.workers.dev/virus-isolation/");
    expect(moved.status).not.toBe(301);
  });
});
