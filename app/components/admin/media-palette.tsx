import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { isTypingTarget } from "~/components/admin/media-keyboard";
import { useMediaSearch } from "~/components/admin/use-media-search";
import { copyText } from "~/lib/clipboard";
import { byteSize } from "~/lib/media/byte-size.mjs";

// Attaches to the existing search input by id rather than replacing it, so the no-script page is unchanged.

type PaletteKey =
  | { do: "focus"; select: boolean }
  | { do: "close" }
  | { do: "move"; by: 1 | -1 }
  | { do: "choose"; open: boolean };

/**
 * The key map. Only Cmd+K and / are global; the rest applies in the search box alone, so arrows keep
 * working in fields, and the list keys only while a list is showing.
 */
function paletteKey(
  event: KeyboardEvent,
  inSearchBox: boolean,
  listing: boolean,
): PaletteKey | null {
  if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
    return { do: "focus", select: true };
  }
  if (event.key === "/" && !isTypingTarget(event.target)) return { do: "focus", select: false };
  if (!inSearchBox) return null;

  if (event.key === "Escape") return { do: "close" };
  if (!listing) return null;

  if (event.key === "ArrowDown") return { do: "move", by: 1 };
  if (event.key === "ArrowUp") return { do: "move", by: -1 };
  if (event.key === "Enter") return { do: "choose", open: event.shiftKey };
  return null;
}

export function MediaPalette({
  inputId = "media-q",
}: {
  inputId?: string;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const { results, hasMore, searchError } = useMediaSearch(query, setCursor);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const copy = (value: string) => {
    copyText(value)
      .then(() => {
        setCopyFailed(false);
        setCopied(value);
        window.setTimeout(() => setCopied(""), 1600);
      })
      .catch(() => {
        setCopied("");
        setCopyFailed(true);
        window.setTimeout(() => setCopyFailed(false), 2400);
      });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = paletteKey(
        event,
        event.target === inputRef.current,
        open && results.length > 0,
      );
      if (!key) return;

      if (key.do === "focus") {
        event.preventDefault();
        inputRef.current?.focus();
        if (key.select) inputRef.current?.select();
        return;
      }
      if (key.do === "close") {
        setOpen(false);
        if (inputRef.current) inputRef.current.value = "";
        setQuery("");
        inputRef.current?.blur();
        return;
      }
      if (key.do === "move") {
        event.preventDefault();
        setCursor((c) =>
          key.by > 0 ? Math.min(results.length - 1, c + 1) : Math.max(0, c - 1),
        );
        return;
      }
      // preventDefault: otherwise the form submits and navigates, throwing away the copy.
      event.preventDefault();
      const hit = results[Math.min(cursor, results.length - 1)];
      if (!hit) return;
      if (key.open) {
        // Router navigation: assigning window.location rebuilds the whole document just to show a panel.
        navigate(`/admin/media?key=${encodeURIComponent(hit.key)}`, {
          preventScrollReset: true,
        });
      } else {
        copy(hit.url);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, navigate]);

  if (!open || (results.length === 0 && !query.trim())) return null;

  return (
    <div className="media-palette" role="presentation">
      {searchError ? (
        <p className="media-palette-empty">
          Search failed: {searchError}. Press Enter to search the full page.
        </p>
      ) : results.length === 0 ? (
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
            : copyFailed
              ? "copy failed"
              : results.length
              ? `${results.length}${hasMore ? "+" : ""} match${results.length === 1 && !hasMore ? "" : "es"}`
              : ""}
        </span>
      </p>
    </div>
  );
}
