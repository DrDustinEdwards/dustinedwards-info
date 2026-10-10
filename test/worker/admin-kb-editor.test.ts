import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminActorContext } from "~/lib/admin-actor.server";
import EditEntry, { action as entryAction, loader as entryLoader } from "~/routes/admin.kb.entry";
import { action as itemAction, loader as itemLoader } from "~/routes/admin.kb.item";

import protocol from "../../content/procedures/phage-dna-extraction.md?raw";

import { stubGitHub, versionOf, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { equipmentRepoFiles, reagentRepoFiles, seedProcedures, seedRegistry, strainRepoFiles } from "./seed";
import { testEnv } from "./test-env";

/* The admin's Knowledge Base editor (docs/KNOWLEDGE-BASE.md, step 3): a file opens as the repository holds it, Check runs
 * the save's checks and commits nothing, Save commits through the save the operator API uses, and a file that moved since
 * it was opened is refused. */

// The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one.
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const SLUG = "phage-dna-extraction";
const FILE = `content/procedures/${SLUG}.md`;
const OLD_STEP = "Incubate at 55 to 60 °C for ~{30 to 60%minutes}.";
const NEW_STEP = "Incubate at 60 °C for ~{45%minutes}.";
const ITEM_FILE = "content/registry/equipment/nanodrop.md";

const context = () => {
  const ctx = routeContext();
  ctx.set(adminActorContext, { kind: "admin", email: "owner@example.com" });
  return ctx;
};
const entryUrl = (search = "") => `https://example.com/admin/kb/entry/${SLUG}${search}`;
const post = (url: string, fields: Record<string, string>) =>
  new Request(url, { method: "POST", body: new URLSearchParams(fields) });
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
/** The payload of a data() answer, or the Response a redirect is. */
const payload = (result: unknown) => (result instanceof Response ? result : (result as { data: Record<string, unknown> }).data);

let gh: GitHubStub;

beforeAll(async () => {
  await seedProcedures();
  await seedRegistry();
});

beforeEach(() => {
  purge.mockClear();
  gh = stubGitHub({ [FILE]: protocol, ...strainRepoFiles, ...reagentRepoFiles, ...equipmentRepoFiles });
});

afterEach(() => {
  gh.restore();
});

describe("the Knowledge Base editor", () => {
  it("opens an entry as its file, at its blob sha, with its title, list and recorded gaps", async () => {
    const { file } = payload(await entryLoader({ request: new Request(entryUrl()), params: { slug: SLUG }, context: context() } as never)) as {
      file: { raw: string; sha: string; title: string; listHref: string; publicHref: string; gaps: unknown[]; errors: string[] };
    };
    expect(file.raw).toBe(protocol);
    expect(file.sha).toBe(await versionOf(gh, FILE));
    expect(file.title).toBe("Phage DNA Extraction Protocol");
    expect(file.listHref).toBe("/admin/kb?tab=protocols");
    expect(file.publicHref).toBe(`/research/protocols/${SLUG}`);
    expect(file.errors).toEqual([]);
    expect(file.gaps.length).toBeGreaterThan(0);
    const html = renderRoute(`/admin/kb/entry/${SLUG}`, EditEntry, { loaderData: { file, saved: null } });
    expect(html).toContain('name="raw"');
    expect(html).toContain('value="check"');
    expect(html).toContain('value="save"');
  });

  it("answers 404 for a file that is not there and for an address that names nothing", async () => {
    const missing = (slug: string) =>
      entryLoader({ request: new Request(entryUrl()), params: { slug }, context: context() } as never).then(
        () => 0,
        (thrown: unknown) => (thrown instanceof Response ? thrown.status : -1),
      );
    expect(await missing("no-such-procedure")).toBe(404);
    expect(await missing("../secrets")).toBe(404);
  });

  it("Check runs the save's checks on the edit and commits nothing", async () => {
    const good = payload(await entryAction({ request: post(entryUrl(), { intent: "check", raw: protocol.replace(OLD_STEP, NEW_STEP) }), params: { slug: SLUG }, context: context() } as never)) as {
      ok: boolean;
      errors: string[];
    };
    expect(good).toMatchObject({ ok: true, errors: [] });
    const bad = payload(await entryAction({ request: post(entryUrl(), { intent: "check", raw: protocol.replace(/^title: .*$/m, "title: ") }), params: { slug: SLUG }, context: context() } as never)) as {
      ok: boolean;
      errors: string[];
    };
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(commits()).toHaveLength(0);
  });

  it("Save commits the edit through the procedure save and redirects back to the file view with the commit", { timeout: 120_000 }, async () => {
    const edited = protocol.replace(OLD_STEP, NEW_STEP);
    const result = payload(
      await entryAction({ request: post(entryUrl(), { intent: "save", raw: edited, sha: await versionOf(gh, FILE) }), params: { slug: SLUG }, context: context() } as never),
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toMatch(new RegExp(`^/admin/kb/entry/${SLUG}\\?saved=\\w{7}&view=file$`));
    expect(gh.files.get(FILE)).toBe(edited);
    expect(commits()).toHaveLength(1);
    const row = await testEnv.DB.prepare("SELECT markdown FROM procedures WHERE slug = ?1").bind(SLUG).first<{ markdown: string }>();
    expect(row?.markdown).toContain("60 °C");
  });

  it("REFUSES a save of a file that moved since it was opened, and keeps the edit", async () => {
    const edited = protocol.replace(OLD_STEP, NEW_STEP);
    const result = payload(
      await entryAction({ request: post(entryUrl(), { intent: "save", raw: edited, sha: "b".repeat(40) }), params: { slug: SLUG }, context: context() } as never),
    ) as { conflict?: string; raw: string };
    expect(result.conflict).toMatch(/changed since it was opened/);
    expect(result.raw).toBe(edited);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a save the validator fails, with its messages, and commits nothing", async () => {
    const result = payload(
      await entryAction({
        request: post(entryUrl(), { intent: "save", raw: protocol.replace(/^title: .*$/m, "title: "), sha: await versionOf(gh, FILE) }),
        params: { slug: SLUG },
        context: context(),
      } as never),
    ) as { refused?: string[] };
    expect(result.refused?.length).toBeGreaterThan(0);
    expect(commits()).toHaveLength(0);
  });

  it("edits a registry item through the registry save", { timeout: 120_000 }, async () => {
    const params = { kind: "equipment", id: "nanodrop" };
    const url = "https://example.com/admin/kb/item/equipment/nanodrop";
    const { file } = payload(await itemLoader({ request: new Request(url), params, context: context() } as never)) as {
      file: { raw: string; sha: string; title: string; listHref: string };
    };
    expect(file.title).toBe("NanoDrop");
    expect(file.listHref).toBe("/admin/kb?tab=needs-info");
    const edited = file.raw.replace(/^manufacturer: .*$/m, "manufacturer: Thermo Fisher Scientific");
    expect(edited).not.toBe(file.raw);
    const result = payload(await itemAction({ request: post(url, { intent: "save", raw: edited, sha: file.sha }), params, context: context() } as never));
    expect(result).toBeInstanceOf(Response);
    expect(gh.files.get(ITEM_FILE)).toBe(edited);
  });
});

describe("the Knowledge Base form", () => {
  const loadForm = async () =>
    payload(await entryLoader({ request: new Request(entryUrl()), params: { slug: SLUG }, context: context() } as never)) as {
      file: { raw: string; sha: string };
      form: { model: { data: Record<string, unknown>; order: string[]; body: unknown }; fields: Array<{ key: string; kind: string }> };
      view: string;
    };

  it("opens as the form, with the file behind Advanced", async () => {
    const { view, form } = await loadForm();
    expect(view).toBe("form");
    expect(form.fields.find((f) => f.key === "status")?.kind).toBe("select");
    const advanced = payload(await entryLoader({ request: new Request(entryUrl("?view=file")), params: { slug: SLUG }, context: context() } as never)) as { view: string; form: unknown };
    expect(advanced).toMatchObject({ view: "file", form: null });
  });

  it("Save from the form writes only the changed field, through the procedure save", { timeout: 120_000 }, async () => {
    const { file, form } = await loadForm();
    const model = { ...form.model, data: { ...form.model.data, status: "in-use" } };
    const result = payload(
      await entryAction({
        request: post(entryUrl(), { intent: "save", sha: file.sha, original: file.raw, model: JSON.stringify(model) }),
        params: { slug: SLUG },
        context: context(),
      } as never),
    );
    expect(result).toBeInstanceOf(Response);
    const saved = gh.files.get(FILE) ?? "";
    const changed = saved.split("\n").filter((line, i) => line !== protocol.split("\n")[i]);
    expect(changed).toEqual(["status: in-use"]);
  });

  it("refuses YAML it cannot read, says why, and commits nothing", async () => {
    const { file, form } = await loadForm();
    const model = { ...form.model, data: { ...form.model.data, based_on: { $yaml: "- citation: [unclosed" } } };
    const result = payload(
      await entryAction({
        request: post(entryUrl(), { intent: "check", sha: file.sha, original: file.raw, model: JSON.stringify(model) }),
        params: { slug: SLUG },
        context: context(),
      } as never),
    ) as { ok: boolean; errors: string[]; model: string };
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/^based_on is not valid YAML/);
    expect(result.model).toBe(JSON.stringify(model));
    expect(commits()).toHaveLength(0);
  });

  it("Duplicate makes a new draft with its own title and address, recording where it came from", { timeout: 120_000 }, async () => {
    const result = payload(
      await entryAction({
        request: post(entryUrl(), { intent: "duplicate", title: "Phage DNA extraction, half volume", slug: "" }),
        params: { slug: SLUG },
        context: context(),
      } as never),
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/admin/kb/entry/phage-dna-extraction-half-volume?created=1");
    const copy = gh.files.get("content/procedures/phage-dna-extraction-half-volume.md") ?? "";
    expect(copy).toMatch(/^title: "?Phage DNA extraction, half volume"?$/m);
    expect(copy).toMatch(/^path: \/research\/protocols\/phage-dna-extraction-half-volume$/m);
    expect(copy).toMatch(/^draft: true$/m);
    expect(copy).toMatch(/^forked_from:\n {2}slug: phage-dna-extraction$/m);
    expect(copy).not.toMatch(/^start_here:/m);
    // The original is untouched.
    expect(gh.files.get(FILE)).toBe(protocol);
  });

  it("Duplicate refuses a file name that is taken or malformed, and makes nothing", async () => {
    const result = payload(
      await entryAction({ request: post(entryUrl(), { intent: "duplicate", title: "Copy", slug: "Not A Slug" }), params: { slug: SLUG }, context: context() } as never),
    ) as { refused: string[] };
    expect(result.refused[0]).toMatch(/is not a file name/);
    expect(commits()).toHaveLength(0);
  });
});
