import { useEffect, useMemo, useState } from "react";
import { Form, useNavigation } from "react-router";

import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { ButtonLink } from "capsomer/react/link";
import { Panel } from "capsomer/react/panel";
import { Tabs, TabsList, TabsTrigger } from "capsomer/react/tabs";

import { PageHead } from "capsomer/react/page-head";
import { crumbLink } from "~/components/admin/shell-parts";
import { KbCheckSave, type KbEditorActionData } from "~/components/admin/kb-file-editor";
import type { KbFile } from "~/kb/editor.server";
import type { FormBody, FormModel } from "~/kb/form.mjs";
import type { Choice, FormField, KbForm } from "~/kb/form.server";
import {
  type EquipmentEntry,
  KbFields,
  type Material,
  type Values,
} from "~/components/admin/kb-form-fields";
import { PreviewPane, useEntryPreview } from "~/components/admin/kb-form-preview";
import { BodyEditor, goTo } from "~/components/admin/kb-form-steps";
import type { Inserts } from "~/components/admin/kb-step-card";
import { SLUG_ATTRIBUTE_PATTERN } from "@drdustinedwards/site-helpers/slug";
import { safeDecode } from "~/lib/safe-decode.mjs";

/*
 * The Knowledge Base's form editor (docs/KNOWLEDGE-BASE.md): every field its own input, the method as step cards
 * reordered by dragging or with Move up and Move down (Alt+Up and Alt+Down), as WCAG 2.2's 2.5.7 asks of any drag.
 * It sends the form's model; the server writes the file (form.mjs) and runs the same Check and Save as the raw editor.
 */

/** The width at which the preview sits beside the form; below it, the preview is a tab. Matches app/admin.css. */
const SIDE_BY_SIDE = "(min-width: 72rem)";

/**
 * What the form posts: the model, with each YAML field sent as its text for the server to read, and each list of lines
 * trimmed, without the empty lines the box keeps while it is typed in.
 */
function posted(
  model: FormModel,
  values: Values,
  yaml: Record<string, string>,
  fields: FormField[],
  body: FormBody | null,
) {
  const data: Values = { ...values };
  for (const f of fields) {
    if (f.kind === "yaml" && f.key in yaml) data[f.key] = { $yaml: yaml[f.key] };
    const lines = data[f.key];
    if (f.kind === "lines" && Array.isArray(lines))
      data[f.key] = lines.map((l) => String(l).trim()).filter(Boolean);
  }
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
  const busy =
    navigation.state === "submitting" ? String(navigation.formData?.get("intent") ?? "") : "";
  // A Check or a refused Save hands the form back as it was sent, so nothing typed is lost.
  const start = useMemo(() => {
    const sent =
      actionData && "model" in actionData && actionData.model
        ? (JSON.parse(actionData.model) as FormModel)
        : null;
    return sent ?? form.model;
  }, [actionData, form.model]);
  const [values, setValues] = useState<Values>(() => {
    const v = { ...start.data };
    for (const f of form.fields)
      if (
        f.kind === "yaml" &&
        v[f.key] &&
        typeof v[f.key] === "object" &&
        "$yaml" in (v[f.key] as object)
      )
        delete v[f.key];
    return v;
  });
  const [yaml, setYaml] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.kind !== "yaml") continue;
      const sent = start.data[f.key];
      out[f.key] =
        sent && typeof sent === "object" && "$yaml" in (sent as object)
          ? String((sent as { $yaml: string }).$yaml)
          : (f.yaml ?? "");
    }
    return out;
  });
  const [body, setBody] = useState<FormBody | null>(start.body);
  const [duplicating, setDuplicating] = useState(actionData?.intent === "duplicate");
  // A Needs info link from the Knowledge Base list opens the editor at the gap's field.
  useEffect(() => {
    if (window.location.hash.length > 1) goTo(null, safeDecode(window.location.hash.slice(1)));
  }, []);

  const checked = actionData?.intent === "check" ? actionData : null;
  const errors = checked
    ? checked.errors
    : actionData?.intent === "save"
      ? (actionData.refused ?? [])
      : file.errors;
  const gaps = checked ? checked.gaps : file.gaps;
  const original = form.model.data;
  const gapFields = form.fields.filter((f) => f.gap && f.kind !== "readonly");
  const otherFields = form.fields.filter((f) => !f.gap);
  // Gaps inside a field (a reagent's amount, a cycling step), which the field's own input holds.
  const topKeys = new Set(form.fields.map((f) => f.key));
  const nested = gaps.filter((g) => !topKeys.has(g.field));

  const materials = (Array.isArray(values.materials) ? values.materials : []) as Material[];
  const equipment = (Array.isArray(values.equipment) ? values.equipment : []) as EquipmentEntry[];
  const nameOf = (list: Choice[], value: string) =>
    list.find((o) => o.value === value)?.label.replace(/ \(draft\)$/, "") ?? value;
  const inserts: Inserts = {
    reagents: [
      ...materials
        .filter((m) => m.name)
        .map((m) => ({ value: `m:${m.name}`, label: String(m.name) })),
      ...form.registry.reagent
        .filter((r) => !materials.some((m) => m.reagent === r.value))
        .map((r) => ({ value: `r:${r.value}`, label: `${r.label} (from the registry)` })),
    ],
    equipment: [
      ...equipment
        .map((e) => (typeof e === "string" ? e : String(e.name ?? "")))
        .filter(Boolean)
        .map((name) => ({ value: `m:${name}`, label: name })),
      ...form.registry.equipment
        .filter((r) => !equipment.some((e) => typeof e === "object" && e.equipment === r.value))
        .map((r) => ({ value: `r:${r.value}`, label: `${r.label} (from the registry)` })),
    ],
    primers: form.registry.primer,
    strains: form.registry.strain,
    names: {
      reagent: materials.map((m) => String(m.name ?? "")).filter(Boolean),
      equipment: equipment
        .map((e) => (typeof e === "string" ? e : String(e.name ?? "")))
        .filter(Boolean),
    },
    references: form.references,
  };

  /** An insert from a step card: a material or equipment the protocol does not list yet is added to its list, so the mark resolves. */
  const onInsert = (
    kind: "reagent" | "equipment" | "primer" | "strain",
    value: string,
    amount?: string,
  ): string | null => {
    if (kind === "reagent") {
      let name = value.slice(2);
      if (value.startsWith("r:")) {
        name = nameOf(form.registry.reagent, value.slice(2));
        setValues((v) => ({
          ...v,
          materials: [
            ...((Array.isArray(v.materials) ? v.materials : []) as Material[]),
            { name, reagent: value.slice(2) },
          ],
        }));
      }
      return `@${name}{${amount ?? ""}}`;
    }
    if (kind === "equipment") {
      let name = value.slice(2);
      if (value.startsWith("r:")) {
        name = nameOf(form.registry.equipment, value.slice(2));
        setValues((v) => ({
          ...v,
          equipment: [
            ...((Array.isArray(v.equipment) ? v.equipment : []) as EquipmentEntry[]),
            { name, equipment: value.slice(2) },
          ],
        }));
      }
      return `#${name}{}`;
    }
    if (kind === "primer") {
      setValues((v) => {
        const list = (Array.isArray(v.primers) ? v.primers : []) as Array<{ primer: string }>;
        return list.some((p) => p.primer === value)
          ? v
          : { ...v, primers: [...list, { primer: value }] };
      });
      return nameOf(form.registry.primer, value);
    }
    setValues((v) => {
      const list = (Array.isArray(v.host_strain) ? v.host_strain : []) as Array<{ strain: string }>;
      return list.some((s) => s.strain === value)
        ? v
        : { ...v, host_strain: [...list, { strain: value }] };
    });
    return nameOf(form.registry.strain, value);
  };

  const fieldsOf = (fields: FormField[]) => (
    <KbFields
      fields={fields}
      values={values}
      original={original}
      yaml={yaml}
      form={form}
      onValue={(key, v) => setValues((cur) => ({ ...cur, [key]: v }))}
      onYaml={(key, t) => setYaml((cur) => ({ ...cur, [key]: t }))}
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
  const preview = useEntryPreview(
    file.target.type === "entry" ? file.target.slug : null,
    file.raw,
    modelJson,
    wide || pane === "preview",
  );

  return (
    <div className="app-page">
      <PageHead
        renderLink={crumbLink}
        crumbs={[
          { label: "Knowledge Base", href: "/admin/kb" },
          { label: file.group, href: file.listHref },
        ]}
        title={file.title}
        actions={
          <>
            {isEntry ? (
              <Button
                type="button"
                onClick={() => setDuplicating(!duplicating)}
                aria-expanded={duplicating}
                aria-controls="kb-duplicate"
              >
                Duplicate
              </Button>
            ) : null}
            {file.publicHref ? (
              <ButtonLink to={file.publicHref} reloadDocument variant="quiet">
                View the page
              </ButtonLink>
            ) : null}
            <ButtonLink to="?view=file" variant="quiet">
              Advanced: edit the file
            </ButtonLink>
          </>
        }
      />
      <p className="cap-muted">
        <code>{file.file}</code>
      </p>

      {created ? <Banner tone="ok">A new draft. Not public until you publish it.</Banner> : null}
      {saved ? (
        <Banner tone="ok">
          {saved.unchanged
            ? "Nothing to save: the file was already this. Its page was brought up to date."
            : `Saved as revision ${saved.commit}.`}
        </Banner>
      ) : null}

      {isEntry && duplicating ? (
        <Panel title="Duplicate as a new draft">
          <p className="cap-muted">
            A copy with its own title and address, recording that it came from this one. Its
            version, history and Start-here place are left behind.
          </p>
          <Form method="post" id="kb-duplicate" className="app-filters">
            <input type="hidden" name="intent" value="duplicate" />
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-dup-title">
                New title
              </label>
              <input
                id="kb-dup-title"
                name="title"
                className="cap-input"
                required
                defaultValue={`${file.title} (variant)`}
              />
            </div>
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-dup-slug">
                File name (optional)
              </label>
              <input
                id="kb-dup-slug"
                name="slug"
                className="cap-input"
                pattern={SLUG_ATTRIBUTE_PATTERN}
                placeholder="made from the title"
              />
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
        <Tabs value={pane} onValueChange={(v) => setPane(v as "form" | "preview")}>
          <TabsList className="kb-pane-tabs" aria-label="Form or preview">
            <TabsTrigger value="form" id="kb-tab-form" aria-controls="kb-pane-form">
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" id="kb-tab-preview" aria-controls="kb-pane-preview">
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      <div className={isEntry ? "kb-layout" : undefined} data-pane={pane}>
        <Form
          method="post"
          className="kb-editor-form kb-pane-form cap-schema-form"
          id="kb-pane-form"
          role={isEntry && !wide ? "tabpanel" : undefined}
          aria-labelledby={isEntry && !wide ? "kb-tab-form" : undefined}
        >
          <input type="hidden" name="sha" value={file.sha} />
          <input type="hidden" name="original" value={file.raw} />
          <input type="hidden" name="model" value={modelJson} />

          {gapFields.length > 0 || nested.length > 0 ? (
            <Panel title="Needs info" count={gapFields.length + nested.length}>
              {fieldsOf(gapFields)}
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

          <Panel title="Details">{fieldsOf(otherFields)}</Panel>

          {body ? (
            <BodyEditor
              body={body}
              flags={form.flags}
              inserts={inserts}
              onChange={setBody}
              onInsert={onInsert}
            />
          ) : null}

          <KbCheckSave busy={busy} actionData={actionData} errors={errors} sticky />
        </Form>
        {isEntry ? (
          <aside
            className="kb-pane-preview"
            id="kb-pane-preview"
            role={wide ? undefined : "tabpanel"}
            aria-labelledby={wide ? undefined : "kb-tab-preview"}
            aria-label={wide ? "Preview" : undefined}
          >
            <PreviewPane
              result={preview.result}
              doc={preview.doc}
              busy={preview.busy}
              publicHref={file.publicHref}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
