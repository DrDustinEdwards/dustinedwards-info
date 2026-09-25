import { useEffect, useRef, useState } from "react";

import { errorMessage } from "~/lib/error-message.mjs";

export type Layout = "write" | "split" | "preview";

const PREVIEW_DELAY_MS = 600;
const LAYOUT_KEY = "post-editor:layout";

/**
 * The editor's layout (Write, Split, Preview), remembered in this browser, and the rendered preview
 * that the Split and Preview layouts show, re-requested a beat after the body stops changing.
 */
export function useLivePreview({
  body,
  fieldsSlug,
  slug,
}: {
  body: string;
  /** The committed slug, which wins; the typed one stands in for a post not yet saved. */
  fieldsSlug: string;
  slug: string;
}) {
  const [layout, setLayout] = useState<Layout>("write");
  const [preview, setPreview] = useState<{ html: string } | { error: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Read after mount, not during render, so the server and the first client paint agree.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_KEY);
      if (stored === "write" || stored === "split" || stored === "preview") setLayout(stored);
    } catch {
      // Storage disabled. The editor opens in Write, which is the default anyway.
    }
  }, []);

  const chooseLayout = (next: Layout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // As above. The choice still applies to this session.
    }
  };

  // A sequence number guards the response: with two renders in flight the slower can land last.
  const previewSeq = useRef(0);
  useEffect(() => {
    if (layout === "write") return;
    const seq = (previewSeq.current += 1);
    setPreviewing(true);
    const timer = window.setTimeout(async () => {
      const form = new FormData();
      form.set("body", body);
      form.set("slug", fieldsSlug || slug);
      try {
        const response = await fetch("/admin/preview", { method: "POST", body: form });
        // Not JSON is a failed request, such as an expired session answering with a page.
        const result = (await response.json().catch(() => null)) as {
          html?: string;
          error?: string;
        } | null;
        if (seq !== previewSeq.current) return;
        if (!result || (!response.ok && !result.error)) {
          setPreview({ error: `The preview request failed with HTTP ${response.status}.` });
          return;
        }
        setPreview(result.error ? { error: result.error } : { html: result.html ?? "" });
      } catch (error) {
        if (seq !== previewSeq.current) return;
        setPreview({ error: errorMessage(error) });
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [body, layout, fieldsSlug, slug]);

  return { layout, chooseLayout, preview, previewing };
}
