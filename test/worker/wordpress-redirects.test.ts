import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../../workers/app";

import { STUB_GONE_BODY } from "./stub-server-build";

/* Through the gateway with the apex Host, the way a reader arrives after DNS moves: each explicit row
 * and each pattern rule of cutover.md's redirect map, status and Location. */

const APEX = "https://dustinedwards.info";

async function get(url: string) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(url, { redirect: "manual" }) as never,
    env as never,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

async function expectGone(path: string) {
  const response = await get(`${APEX}${path}`);
  expect(response.status, path).toBe(410);
  expect(response.headers.get("location"), path).toBeNull();
  expect(await response.text(), path).toBe(STUB_GONE_BODY);
}

describe("pattern rules, on the apex host", () => {
  it("the molarity and metric prefix calculators answer 410", async () => {
    await expectGone("/molarity-calculator/");
    await expectGone("/knowledge-base/metric-prefix/");
  });
});

describe("the map's edges", () => {
  it("www sends an old address straight to its replacement on the apex, in one hop", async () => {
    const response = await get("https://www.dustinedwards.info/virus-isolation/");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${APEX}/teaching/virus-isolation`);
  });

  it("www sends every other path, with its query, to the same path on the apex", async () => {
    for (const url of ["https://www.dustinedwards.info/", "http://www.dustinedwards.info/"]) {
      const response = await get(url);
      expect(response.status, url).toBe(301);
      expect(response.headers.get("location"), url).toBe(`${APEX}/`);
    }
    const response = await get("http://www.dustinedwards.info/research/phages?x=1");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${APEX}/research/phages?x=1`);
  });

  it("www sends a removed address to the apex, which answers 410", async () => {
    const response = await get("https://www.dustinedwards.info/molarity-calculator/");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${APEX}/molarity-calculator/`);
  });

  it("NEVER applies on another host: workers.dev passes the path to the Renderer", async () => {
    const moved = await get("https://dustinedwards.dustin-edwards.workers.dev/virus-isolation");
    expect(moved.status).not.toBe(301);
  });
});
