import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { toast } from "~/components/admin/toast";
import { useMediaSearch } from "~/components/admin/use-media-search";
import { copyText } from "~/lib/clipboard";
import { byteSize } from "~/lib/media/byte-size.mjs";

// Attaches to the existing search input by id rather than replacing it, so the no-script page is unchanged.
// The input becomes an APG combobox over a listbox, the pattern the editor's link palette uses.

const LIST_ID = "media-palette-list";
const optionId = (key: string) => `media-palette-opt-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;

type PaletteKey =
  | { do: "focus"; select: boolean }
  | { do: "close" }
  | { do: "move"; by: 1 | -1 }
  | { do: "choose"; open: boolean };

/**
 * The key map. Only Cmd+K is global: a bare "/" was a single-key shortcut on the whole page, which
 * WCAG 2.1.4 forbids without a way to turn it off. The rest applies in the search box alone, and the
 * list keys only while a list is showing.
 */
function paletteKey(
  event: KeyboardEvent,
  inSearchBox: boolean,
  listing: boolean,
): PaletteKey | null {
  if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
    return { do: "focus", select: true };
  }
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
  const listing = open && results.length > 0 && !searchError;
  const activeResult = listing ? results[Math.min(cursor, results.length - 1)] : undefined;

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

  // The combobox state lives on the page's own input, so it is written there rather than rendered.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", String(listing));
    if (listing) input.setAttribute("aria-controls", LIST_ID);
    else input.removeAttribute("aria-controls");
    if (activeResult) input.setAttribute("aria-activedescendant", optionId(activeResult.key));
    else input.removeAttribute("aria-activedescendant");
  }, [listing, activeResult]);

  // Announced by the page's toast region as well as shown in the count: the count is not a live region.
  const copy = (value: string) => {
    copyText(value)
      .then(() => {
        setCopyFailed(false);
        setCopied(value);
        toast(`Copied ${value}`);
        window.setTimeout(() => setCopied(""), 1600);
      })
      .catch(() => {
        setCopied("");
        setCopyFailed(true);
        toast(`Copy failed. The address is ${value}`);
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
      // APG: Escape closes the list and, pressed again, clears the field. Focus stays in the box.
      if (key.do === "close") {
        event.preventDefault();
        if (open) {
          setOpen(false);
          return;
        }
        if (inputRef.current) inputRef.current.value = "";
        setQuery("");
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

  const count = `${results.length}${hasMore ? "+" : ""} match${results.length === 1 && !hasMore ? "" : "es"}`;
  // In the document before the list opens, so the first count is announced as well as later ones.
  const announcement = !open || !query.trim()
    ? ""
    : searchError
      ? "Search failed"
      : results.length
        ? count
        : "No matches";
  const status = (
    <p className="sr-only" role="status">
      {announcement}
    </p>
  );

  const showing = open && (results.length > 0 || query.trim().length > 0);

  // One return, so the region keeps its place whether or not the list shows and is never remounted.
  return (
    <>
    {status}
    {showing ? (
    <div className="media-palette">
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
        <ul className="media-palette-list" id={LIST_ID} role="listbox" aria-label="Matching files">
          {results.map((r, i) => (
            <li key={r.key} role="presentation">
              {/* A link, not a button: clicking a row opens it, while Enter copies. Out of the tab
                  order: the box keeps focus and points at the option. */}
              <a
                href={`/admin/media?key=${encodeURIComponent(r.key)}`}
                id={optionId(r.key)}
                role="option"
                aria-selected={i === Math.min(cursor, results.length - 1)}
                tabIndex={-1}
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
        <span className="media-palette-count" aria-hidden="true">
          {copied ? "copied" : copyFailed ? "copy failed" : results.length ? count : ""}
        </span>
      </p>
    </div>
    ) : null}
    </>
  );
}
