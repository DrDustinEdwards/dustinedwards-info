import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { byteSize } from "~/lib/media/byte-size.mjs";

// Attaches to the existing search input by id rather than replacing it, so the no-script page is unchanged.

type PalettePayload = { results: PaletteResult[]; hasMore: boolean };

type PaletteResult = {
  key: string;
  url: string;
  name: string;
  dir: string;
  size: number;
  viewable: boolean;
};

export function MediaPalette({
  inputId = "media-q",
  /** Test seam: a static render dispatches no events, so without this the panel never opens. */
  initialResults,
}: {
  inputId?: string;
  initialResults?: { query: string; results: PaletteResult[]; hasMore: boolean };
}) {
  const [query, setQuery] = useState(initialResults?.query ?? "");
  const [results, setResults] = useState<PaletteResult[]>(initialResults?.results ?? []);
  const [hasMore, setHasMore] = useState(initialResults?.hasMore ?? false);
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const [open, setOpen] = useState(Boolean(initialResults));
  const [copied, setCopied] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    inputRef.current = document.getElementById(inputId) as HTMLInputElement | null;
    const input = inputRef.current;
    if (!input) return;

    const onInput = () => {
      setQuery(input.value);
      setCursor(0);
      setOpen(input.value.trim().length > 0);
    };
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, [inputId]);

  // Sequenced: a slow response to a shorter query can land after a fast one and replace the right answer.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasMore(false);
      return;
    }
    const id = (seq.current += 1);
    const timer = window.setTimeout(() => {
      fetch(`/admin/media?palette=1&q=${encodeURIComponent(trimmed)}`, {
        headers: { accept: "application/json" },
      })
        .then((r) => (r.ok ? (r.json() as Promise<PalettePayload>) : null))
        .then((data) => {
          if (id !== seq.current || !data) return;
          setResults(data.results ?? []);
          setHasMore(Boolean(data.hasMore));
          setCursor(0);
        })
        .catch(() => {
          if (id === seq.current) setResults([]);
        });
    }, 130);
    return () => window.clearTimeout(timer);
  }, [query]);

  const copy = (value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(value);
        window.setTimeout(() => setCopied(""), 1600);
      })
      .catch(() => setCopied(""));
  };

  // Only Cmd+K and / are global; the rest applies in the search box alone, so arrows keep working in fields.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toUpperCase();
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (event.key === "/" && !inField) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (target !== inputRef.current) return;

      if (event.key === "Escape") {
        setOpen(false);
        if (inputRef.current) inputRef.current.value = "";
        setQuery("");
        inputRef.current?.blur();
        return;
      }
      if (!open || results.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (event.key === "Enter") {
        // preventDefault: otherwise the form submits and navigates, throwing away the copy.
        event.preventDefault();
        const hit = results[Math.min(cursor, results.length - 1)];
        if (!hit) return;
        if (event.shiftKey) {
          // Router navigation: assigning window.location rebuilds the whole document just to show a panel.
          navigate(`/admin/media?key=${encodeURIComponent(hit.key)}`, {
            preventScrollReset: true,
          });
        } else {
          copy(hit.url);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, navigate]);

  if (!open || (results.length === 0 && !query.trim())) return null;

  return (
    <div className="media-palette" role="presentation">
      {results.length === 0 ? (
        <p className="media-palette-empty">
          Nothing matches &ldquo;{query.trim()}&rdquo;. Searched paths, names, alt
          text and tags.
        </p>
      ) : (
        <ul className="media-palette-list">
          {results.map((r, i) => (
            <li key={r.key}>
              {/* A link, not a button: clicking a row opens it, while Enter copies. */}
              <a
                href={`/admin/media?key=${encodeURIComponent(r.key)}`}
                className="media-palette-row"
                data-active={i === Math.min(cursor, results.length - 1) ? "yes" : undefined}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="media-palette-kind" aria-hidden="true">
                  {r.viewable ? "" : r.key.split(".").pop()?.toUpperCase()}
                </span>
                <span className="media-palette-text">
                  <span className="media-palette-name">{r.name}</span>
                  <span className="media-palette-dir">{r.dir}</span>
                </span>
                <span className="media-palette-size">{byteSize(r.size)}</span>
                {i === Math.min(cursor, results.length - 1) ? (
                  <span className="media-palette-hint" aria-hidden="true">
                    enter
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* The count says "6+" when the cap was hit, so six never reads as the whole answer. */}
      <p className="media-palette-hints">
        <span>
          <b>up down</b> move
        </span>
        <span>
          <b>enter</b> copies the address
        </span>
        <span>
          <b>shift enter</b> opens details
        </span>
        <span className="media-palette-count">
          {copied
            ? "copied"
            : results.length
              ? `${results.length}${hasMore ? "+" : ""} match${results.length === 1 && !hasMore ? "" : "es"}`
              : ""}
        </span>
      </p>
    </div>
  );
}
