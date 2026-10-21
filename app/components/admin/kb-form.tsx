import { useEffect, useMemo, useRef, useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";

import { PageHead } from "~/components/admin/page-head";
import type { KbEditorActionData } from "~/components/admin/kb-file-editor";
import type { KbFile } from "~/kb/editor.server";
import type { FormBody, FormModel } from "~/kb/form.mjs";
import type { Choice, FormField, KbForm } from "~/kb/form.server";
import { type EquipmentEntry, FieldInput, type Material, type Values, plural } from "~/components/admin/kb-form-fields";
import { BodyEditor, type Inserts, goTo } from "~/components/admin/kb-form-steps";

/*
 * The Knowledge Base's form editor (docs/KNOWLEDGE-BASE.md): every field its own input, the values nobody has yet at the
 * top as Needs info, and the method as step cards in their sections, reordered by dragging or with Move up and Move down
 * (Alt+Up and Alt+Down on a focused card), as WCAG 2.2's 2.5.7 asks of any drag. What it sends is the form's model; the
 * server writes the file from it (form.mjs) and runs the same Check and Save the raw editor does. The raw file stays one
 * link away, behind Advanced, which also works with no script.
 */

type PreviewResult = { html: string; styles: string[] } | { errors: string[] } | { error: string };

const PREVIEW_DELAY_MS = 900;
/** The width at which the preview sits beside the form; below it, the preview is a tab. Matches app/admin.css. */
const SIDE_BY_SIDE = "(min-width: 72rem)";

/**
 * The entry the form describes, rendered as its public page by the server a beat after the form stops changing. A
 * sequence number keeps a slow answer from landing over a newer one.
 */
function useEntryPreview(slug: string | null, original: string, model: string, active: boolean) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (!slug || !active) return;
    const mine = (seq.current += 1);
    setBusy(true);
    const timer = window.setTimeout(async () => {
      const body = new FormData();
      body.set("original", original);
      body.set("model", model);
      try {
        const response = await fetch(`/admin/kb/preview/${slug}`, { method: "POST", body });
        const json = (await response.json().catch(() => null)) as PreviewResult | null;
        if (mine !== seq.current) return;
        setResult(json ?? { error: `The preview request failed with HTTP ${response.status}.` });
      } catch (error) {
        if (mine === seq.current) setResult({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [slug, original, model, active]);
  return { result, busy };
}

/**
 * The public page in a sandboxed frame: no script runs in it, and it links the public page's own stylesheets, so it
 * looks as the page will. A frame, because the page's styles are the public site's and the admin's are its own.
 */
function PreviewPane({ result, busy, publicHref }: { result: PreviewResult | null; busy: boolean; publicHref: string | null }) {
  const [doc, setDoc] = useState("");
  useEffect(() => {
    if (!result || !("html" in result)) return;
    const styles = result.styles.map((href) => `<link rel="stylesheet" href="${new URL(href, window.location.href).href}">`).join("");
    const theme = document.documentElement.getAttribute("data-theme");
    setDoc(`<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ""}><head><meta charset="utf-8"><base target="_blank">${styles}</head><body>${result.html}</body></html>`);
  }, [result]);
  const failed = result && "errors" in result ? result.errors : result && "error" in result ? [result.error] : null;
  return (
    <Panel title="Preview" src={busy ? "Updating" : failed ? "Not drawn" : "As the page will look"} flush>
      {failed ? (
        <div className="kb-preview-note">
          <Alert tone="warn" title="The page cannot be drawn until these are fixed">
            <ul>
              {failed.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}
      {doc ? (
        <iframe className="kb-preview-frame" title={`Preview of the page${publicHref ? ` at ${publicHref}` : ""}`} sandbox="" srcDoc={doc} />
      ) : (
        <p className="kb-preview-note">{busy || !result ? "Drawing the page…" : null}</p>
      )}
    </Panel>
  );
}

/** What the form posts: the model, with each YAML field sent as its text for the server to read. */
function posted(model: FormModel, values: Values, yaml: Record<string, string>, fields: FormField[], body: FormBody | null) {
  const data: Values = { ...values };
  for (const f of fields) if (f.kind === "yaml" && f.key in yaml) data[f.key] = { $yaml: yaml[f.key] };
  return JSON.stringify({ ...model, data, body });
}

export function KbFormEditor({
  file,
  form,
  actionData,
  saved,
  created,
}: {
  file: KbFile;
  form: KbForm;
  actionData?: KbEditorActionData;
  saved?: { commit: string; unchanged: boolean } | null;
  created?: boolean;
}) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting" ? String(navigation.formData?.get("intent") ?? "") : "";
  // A Check or a refused Save hands the form back as it was sent, so nothing typed is lost.
  const start = useMemo(() => {
    const sent = actionData && "model" in actionData && actionData.model ? (JSON.parse(actionData.model) as FormModel) : null;
    return sent ?? form.model;
  }, [actionData, form.model]);
  const [values, setValues] = useState<Values>(() => {
    const v = { ...start.data };
    for (const f of form.fields) if (f.kind === "yaml" && v[f.key] && typeof v[f.key] === "object" && "$yaml" in (v[f.key] as object)) delete v[f.key];
    return v;
  });
  const [yaml, setYaml] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.kind !== "yaml") continue;
      const sent = start.data[f.key];
      out[f.key] = sent && typeof sent === "object" && "$yaml" in (sent as object) ? String((sent as { $yaml: string }).$yaml) : (f.yaml ?? "");
    }
    return out;
  });
  const [body, setBody] = useState<FormBody | null>(start.body);
  const [duplicating, setDuplicating] = useState(actionData?.intent === "duplicate");
  // A Needs info link from the Knowledge Base list opens the editor at the gap's field.
  useEffect(() => {
    if (window.location.hash.length > 1) goTo(null, decodeURIComponent(window.location.hash.slice(1)));
  }, []);

  const checked = actionData?.intent === "check" ? actionData : null;
  const errors = checked ? checked.errors : actionData?.intent === "save" ? (actionData.refused ?? []) : file.errors;
  const gaps = checked ? checked.gaps : file.gaps;
  const original = form.model.data;
  const gapFields = form.fields.filter((f) => f.gap && f.kind !== "readonly");
  const otherFields = form.fields.filter((f) => !f.gap);
  // Gaps inside a field (a reagent's amount, a cycling step), which the field's own input holds.
  const topKeys = new Set(form.fields.map((f) => f.key));
  const nested = gaps.filter((g) => !topKeys.has(g.field));

  const materials = (Array.isArray(values.materials) ? values.materials : []) as Material[];
  const equipment = (Array.isArray(values.equipment) ? values.equipment : []) as EquipmentEntry[];
  const nameOf = (list: Choice[], value: string) => list.find((o) => o.value === value)?.label.replace(/ \(draft\)$/, "") ?? value;
  const inserts: Inserts = {
    reagents: [
      ...materials.filter((m) => m.name).map((m) => ({ value: `m:${m.name}`, label: String(m.name) })),
      ...form.registry.reagent.filter((r) => !materials.some((m) => m.reagent === r.value)).map((r) => ({ value: `r:${r.value}`, label: `${r.label} (from the registry)` })),
    ],
    equipment: [
      ...equipment.map((e) => (typeof e === "string" ? e : String(e.name ?? ""))).filter(Boolean).map((name) => ({ value: `m:${name}`, label: name })),
      ...form.registry.equipment.filter((r) => !equipment.some((e) => typeof e === "object" && e.equipment === r.value)).map((r) => ({ value: `r:${r.value}`, label: `${r.label} (from the registry)` })),
    ],
    primers: form.registry.primer,
    strains: form.registry.strain,
    names: {
      reagent: materials.map((m) => String(m.name ?? "")).filter(Boolean),
      equipment: equipment.map((e) => (typeof e === "string" ? e : String(e.name ?? ""))).filter(Boolean),
    },
    references: form.references,
  };

  /** An insert from a step card: a material or equipment the protocol does not list yet is added to its list, so the mark resolves. */
  const onInsert = (kind: "reagent" | "equipment" | "primer" | "strain", value: string, amount?: string): string | null => {
    if (kind === "reagent") {
      let name = value.slice(2);
      if (value.startsWith("r:")) {
        name = nameOf(form.registry.reagent, value.slice(2));
        setValues((v) => ({ ...v, materials: [...((Array.isArray(v.materials) ? v.materials : []) as Material[]), { name, reagent: value.slice(2) }] }));
      }
      return `@${name}{${amount ?? ""}}`;
    }
    if (kind === "equipment") {
      let name = value.slice(2);
      if (value.startsWith("r:")) {
        name = nameOf(form.registry.equipment, value.slice(2));
        setValues((v) => ({ ...v, equipment: [...((Array.isArray(v.equipment) ? v.equipment : []) as EquipmentEntry[]), { name, equipment: value.slice(2) }] }));
      }
      return `#${name}{}`;
    }
    if (kind === "primer") {
      setValues((v) => {
        const list = (Array.isArray(v.primers) ? v.primers : []) as Array<{ primer: string }>;
        return list.some((p) => p.primer === value) ? v : { ...v, primers: [...list, { primer: value }] };
      });
      return nameOf(form.registry.primer, value);
    }
    setValues((v) => {
      const list = (Array.isArray(v.host_strain) ? v.host_strain : []) as Array<{ strain: string }>;
      return list.some((s) => s.strain === value) ? v : { ...v, host_strain: [...list, { strain: value }] };
    });
    return nameOf(form.registry.strain, value);
  };

  const input = (f: FormField) => (
    <FieldInput
      key={f.key}
      field={f}
      value={values[f.key]}
      original={original[f.key]}
      yaml={yaml[f.key] ?? ""}
      form={form}
      onValue={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
      onYaml={(t) => setYaml((cur) => ({ ...cur, [f.key]: t }))}
    />
  );
  const isEntry = file.target.type === "entry";
  const modelJson = posted(form.model, values, yaml, form.fields, body);
  // The preview is drawn while it can be seen: beside the form on a wide screen, or on the phone when its tab is open.
  const [pane, setPane] = useState<"form" | "preview">("form");
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(SIDE_BY_SIDE);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const preview = useEntryPreview(file.target.type === "entry" ? file.target.slug : null, file.raw, modelJson, wide || pane === "preview");

  return (
    <div className="app-page">
      <PageHead
        crumbs={[
          { label: "Knowledge Base", href: "/admin/kb" },
          { label: file.group, href: file.listHref },
        ]}
        title={file.title}
        lead={
          <>
            <code>{file.file}</code>
            {file.publicHref ? (
              <>
                {" "}
                <Link to={file.publicHref} reloadDocument>
                  View the page
                </Link>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {isEntry ? (
              <Button type="button" onClick={() => setDuplicating(!duplicating)} aria-expanded={duplicating} aria-controls="kb-duplicate">
                Duplicate
              </Button>
            ) : null}
            <Link to="?view=file" className="cap-btn" data-variant="quiet">
              Advanced: edit the file
            </Link>
          </>
        }
      />

      {created ? <Banner tone="ok">A new draft, copied from the protocol named under Copied from. Nothing about it is public until you publish it.</Banner> : null}
      {saved ? (
        <Banner tone="ok">
          {saved.unchanged ? "Nothing to commit: the file was already this. Its page was brought up to date." : `Saved as commit ${saved.commit}. The page shows it on the next visit.`}
        </Banner>
      ) : null}

      {isEntry && duplicating ? (
        <Panel title="Duplicate as a new draft" description="A copy with its own title and address, recording that it came from this one. Its version, history and Start-here place are left behind.">
          <Form method="post" id="kb-duplicate" className="app-filters">
            <input type="hidden" name="intent" value="duplicate" />
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-dup-title">
                New title
              </label>
              <input id="kb-dup-title" name="title" className="cap-input" required defaultValue={`${file.title} (variant)`} />
            </div>
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-dup-slug">
                File name (optional)
              </label>
              <input id="kb-dup-slug" name="slug" className="cap-input" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="made from the title" />
            </div>
            <Button type="submit" variant="primary" pending={busy === "duplicate"}>
              Make the copy
            </Button>
          </Form>
          {actionData?.intent === "duplicate" ? (
            <Alert tone="crit" title="Not copied">
              <ul>
                {actionData.refused.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </Panel>
      ) : null}

      {isEntry ? (
        <div className="kb-pane-tabs" role="tablist" aria-label="Form or preview">
          <button type="button" role="tab" id="kb-tab-form" aria-controls="kb-pane-form" aria-selected={pane === "form"} className="cap-btn" data-variant={pane === "form" ? "primary" : "quiet"} onClick={() => setPane("form")}>
            Edit
          </button>
          <button type="button" role="tab" id="kb-tab-preview" aria-controls="kb-pane-preview" aria-selected={pane === "preview"} className="cap-btn" data-variant={pane === "preview" ? "primary" : "quiet"} onClick={() => setPane("preview")}>
            Preview
          </button>
        </div>
      ) : null}

      <div className={isEntry ? "kb-layout" : undefined} data-pane={pane}>
      <Form method="post" className="kb-editor-form kb-pane-form" id="kb-pane-form" role={isEntry && !wide ? "tabpanel" : undefined} aria-labelledby={isEntry && !wide ? "kb-tab-form" : undefined}>
        <input type="hidden" name="sha" value={file.sha} />
        <input type="hidden" name="original" value={file.raw} />
        <input type="hidden" name="model" value={modelJson} />

        {gapFields.length > 0 || nested.length > 0 ? (
          <Panel title="Needs info" count={gapFields.length + nested.length} description="Values nobody has yet. Fill one in here and it is saved with the rest; leave it empty and it keeps its reason.">
            <div className="kb-fields">{gapFields.map(input)}</div>
            {nested.length > 0 ? (
              <ul className="kb-nested-gaps">
                {nested.map((g) => (
                  <li key={`${g.field}#${g.reason}`}>
                    <a href={`#${g.anchor}`} onClick={(e) => goTo(e, g.anchor)}>
                      {g.label}
                    </a>
                    : {g.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Details">
          <div className="kb-fields">{otherFields.map(input)}</div>
        </Panel>

        {body ? <BodyEditor body={body} flags={form.flags} inserts={inserts} onChange={setBody} onInsert={onInsert} /> : null}

        <div className="kb-savebar">
          <div className="app-actions">
            <Button type="submit" name="intent" value="check" pending={busy === "check"}>
              Check
            </Button>
            <Button type="submit" name="intent" value="save" variant="primary" pending={busy === "save"}>
              Save
            </Button>
          </div>
          <div role="status">{checked?.ok ? <Banner tone="ok">Passes every check. Nothing was saved.</Banner> : null}</div>
          {actionData?.intent === "save" && actionData.conflict ? (
            <Alert tone="crit" title="Not saved">
              {actionData.conflict}
            </Alert>
          ) : null}
          {errors.length > 0 ? (
            <Alert tone="crit" title={`${plural(errors.length, "check fails", "checks fail")}`}>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </div>
      </Form>
      {isEntry ? (
        <aside className="kb-pane-preview" id="kb-pane-preview" role={wide ? undefined : "tabpanel"} aria-labelledby={wide ? undefined : "kb-tab-preview"} aria-label={wide ? "Preview" : undefined}>
          <PreviewPane result={preview.result} busy={preview.busy} publicHref={file.publicHref} />
        </aside>
      ) : null}
      </div>
    </div>
  );
}
