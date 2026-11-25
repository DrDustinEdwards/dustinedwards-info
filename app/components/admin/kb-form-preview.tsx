/** The entry preview of the KB form editor: the debounced request and the sandboxed frame (kb-form.tsx). */
import { useEffect, useRef, useState } from "react";
import { trustedHtml } from "capsomer/behavior/trusted-html";
import { Alert } from "capsomer/react/banner";
import { Panel } from "capsomer/react/panel";
import { useDebouncedPreview } from "capsomer/react/form-hooks";

type PreviewResult = { html: string; styles: string[] } | { errors: string[] } | { error: string };

/**
 * The entry the form describes, rendered as its public page by the server a beat after the form stops changing
 * (Capsomer's useDebouncedPreview, at its 900 ms default). A failed request shows as the answer. The frame's document
 * is built when a drawable answer lands, so a failed one keeps the last good page in view.
 */
export function useEntryPreview(
  slug: string | null,
  original: string,
  model: string,
  active: boolean,
) {
  const [doc, setDoc] = useState("");
  const request = slug && active ? JSON.stringify([slug, original, model]) : null;
  const { result, error, busy } = useDebouncedPreview(
    request,
    async (_, signal): Promise<PreviewResult> => {
      const body = new FormData();
      body.set("original", original);
      body.set("model", model);
      const response = await fetch(`/admin/kb/preview/${slug}`, { method: "POST", body, signal });
      const json = (await response.json().catch(() => null)) as PreviewResult | null;
      if (json && "html" in json && !signal.aborted) {
        const styles = json.styles
          .map(
            (href) => `<link rel="stylesheet" href="${new URL(href, window.location.href).href}">`,
          )
          .join("");
        const theme = document.documentElement.getAttribute("data-theme");
        setDoc(
          `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ""}><head><meta charset="utf-8"><base target="_blank">${styles}</head><body>${json.html}</body></html>`,
        );
      }
      return json ?? { error: `The preview request failed with HTTP ${response.status}.` };
    },
  );
  return { result: error === null ? result : { error }, doc, busy };
}

/**
 * The public page in a sandboxed frame: no script runs in it, and it links the public page's own stylesheets, so it
 * looks as the page will. A frame, because the page's styles are the public site's and the admin's are its own.
 */
export function PreviewPane({
  result,
  doc,
  busy,
  publicHref,
}: {
  result: PreviewResult | null;
  doc: string;
  busy: boolean;
  publicHref: string | null;
}) {
  const failed =
    result && "errors" in result
      ? result.errors
      : result && "error" in result
        ? [result.error]
        : null;
  // Set through the policy: React would turn a TrustedHTML prop back into a string.
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (frame.current && doc) frame.current.srcdoc = trustedHtml(doc);
  }, [doc]);
  return (
    <Panel title="Preview" src={busy ? "Updating" : failed ? "Not drawn" : undefined} flush>
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
        <iframe
          className="kb-preview-frame"
          title={`Preview of the page${publicHref ? ` at ${publicHref}` : ""}`}
          sandbox=""
          ref={frame}
        />
      ) : (
        <p className="kb-preview-note">{busy || !result ? "Drawing the page…" : null}</p>
      )}
    </Panel>
  );
}
