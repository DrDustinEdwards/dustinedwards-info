import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { MarkdownEditor } from "capsomer/react/markdown-editor";
import { Panel } from "capsomer/react/panel";
import { Row, RowList } from "capsomer/react/row-list";

import { PageHead } from "~/components/admin/page-head";
import type { KbFile, KbGap } from "~/kb/editor.server";

/** What the action hands back: a check's verdict, or a save that did not land, with the text the reader sent. */
export type KbEditorActionData =
  | { intent: "check"; raw: string; ok: boolean; errors: string[]; gaps: KbGap[] }
  | { intent: "save"; raw: string; refused?: string[]; conflict?: string };

// Read off the document, not loader data, as the post editor does: the IDL property, since browsers hide the attribute.
function documentCspNonce(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * One Knowledge Base file (docs/KNOWLEDGE-BASE.md, step 3), an entry or a registry item, edited as the file it is. Check
 * runs the save's own checks and commits nothing; Save commits through the save the operator API uses. Without script the
 * editor is a plain textarea in the same form, so both buttons still work.
 */
export function KbFileEditor({
  file,
  actionData,
  saved,
}: {
  file: KbFile;
  actionData?: KbEditorActionData;
  saved?: { commit: string; unchanged: boolean } | null;
}) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting" ? String(navigation.formData?.get("intent") ?? "") : "";
  const [raw, setRaw] = useState(actionData?.raw ?? file.raw);

  // The latest word on the file: a check just run, else what the loader's check said of the committed file.
  const checked = actionData?.intent === "check" ? actionData : null;
  const errors = checked ? checked.errors : actionData?.intent === "save" && actionData.refused ? actionData.refused : file.errors;
  const gaps = checked ? checked.gaps : file.gaps;

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
      />

      {saved ? (
        <Banner tone="ok">
          {saved.unchanged
            ? "Nothing to commit: the file was already this. Its page was brought up to date."
            : `Saved as commit ${saved.commit}. The page shows it on the next visit.`}
        </Banner>
      ) : null}

      <Form method="post" className="kb-editor-form">
        <input type="hidden" name="sha" value={file.sha} />
        <MarkdownEditor
          label="File"
          ariaLabel="File, markdown with front matter"
          id="kb-file"
          name="raw"
          value={raw}
          onChange={setRaw}
          nonce={documentCspNonce()}
          lineNumbers
          help={
            file.target.type === "entry"
              ? "The whole file: its fields between the --- lines, then the steps with their marks. Check runs every check a save runs and saves nothing."
              : "The whole file: the item's fields between the --- lines, and nothing after them. Check runs every check a save runs and saves nothing."
          }
        />
        <div className="app-actions">
          <Button type="submit" name="intent" value="check" pending={busy === "check"}>
            Check
          </Button>
          <Button type="submit" name="intent" value="save" variant="primary" pending={busy === "save"}>
            Save
          </Button>
        </div>
        {/* Beside the buttons that ask for it, so a Check's answer is in view. The status region is always in the DOM,
            so a result is announced; a refusal is an alert. */}
        <div role="status">{checked?.ok ? <Banner tone="ok">Passes every check. Nothing was saved.</Banner> : null}</div>
        {actionData?.intent === "save" && actionData.conflict ? (
          <Alert tone="crit" title="Not saved">
            {actionData.conflict}
          </Alert>
        ) : null}
        {errors.length > 0 ? (
          <Alert tone="crit" title={`${plural(errors.length, "check fails", "checks fail")}${checked ? "" : " on this file"}`}>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </Form>

      {gaps.length > 0 ? (
        <Panel title="Needs info" count={gaps.length} flush>
          <RowList label="Needs info">
            {gaps.map((gap) => (
              <Row key={`${gap.field}#${gap.reason}`} title={<code>{gap.field}</code>} detail={gap.reason} />
            ))}
          </RowList>
        </Panel>
      ) : null}
    </div>
  );
}
