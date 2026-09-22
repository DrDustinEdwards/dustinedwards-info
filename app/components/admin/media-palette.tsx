import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { byteSize } from "~/lib/media/byte-size.mjs";

/**
 * THE COMMAND PALETTE, LAYERED OVER THE SEARCH FORM RATHER THAN REPLACING IT.
 *
 * THIS COMPONENT RENDERS NOTHING ON THE SERVER. It mounts, finds the search input
 * already in the DOM, and attaches to it. With scripting off the page is
 * byte-for-byte what it was. That is also why it takes the input by ID rather than
 * owning it: an enhanced control that REPLACES the unenhanced one has to
 * reimplement everything the platform gave the original, and the first thing it
 * loses is the no-script path.
 *
 * THE RESULTS COME FROM THE SAME QUERY THE FORM RUNS. A client-side filter would
 * be a SECOND answer to "what matches this", which this page has already paid for
 * once.
 *
 * CLIENT STATE, DECLARED: five pieces, all transient, none in a URL.
 */

/** What `?palette=1` returns. Named so the fetch is typed rather than `any`. */
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
  /**
   * HARNESS SEAM: an optional prop with a production default. `check:admin-ui`
   * renders one static pass and dispatches no events, so without this the panel never
   * opens. Wire-unreachable: React Router never supplies it.
   */
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

  /** The real input, which lives in the form and is never re-created here. */
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Ignore a response that arrives after a newer one. */
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

  /*
   * THE FETCH, DEBOUNCED, AND ORDERED BY SEQUENCE NUMBER. The sequence number is
   * the half that gets forgotten: two requests in flight can complete in either
   * order, so a slow response to a shorter query can land after a fast one and
   * replace the right answer with a stale one.
   */
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
          // A failed lookup leaves the form underneath untouched, so pressing Enter still
          // navigates and still searches. Silence is the right behavior: an error banner
          // over a working control is noise.
          if (id === seq.current) setResults([]);
        });
    }, 130);
    return () => window.clearTimeout(timer);
  }, [query]);

  /** Copy, with the acknowledgment a copy control owes. */
  const copy = (value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(value);
        window.setTimeout(() => setCopied(""), 1600);
      })
      .catch(() => setCopied(""));
  };

  /*
   * On the window, because two bindings are global. Everything else applies only
   * while the search box has focus, and the guard is what keeps arrow keys working
   * in the alt textarea: a palette that stole ArrowDown from every field would break
   * typing to fix finding.
   */
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
      // Slash focuses search, but only from OUTSIDE a field, or it would be
      // impossible to type a slash into the alt text of a file called and/or.
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
        /*
         * ENTER COPIES. SHIFT+ENTER OPENS. `preventDefault` matters: without it the form
         * submits and navigates, which is the unenhanced behavior and would throw away the
         * copy. With scripting off there is no handler and the same key does exactly that
         * navigation.
         */
        event.preventDefault();
        const hit = results[Math.min(cursor, results.length - 1)];
        if (!hit) return;
        if (event.shiftKey) {
          // A ROUTER navigation, not `window.location`: the destination is this same route
          // with a `key` in the query, and assigning to `location` tore the document down
          // and rebuilt it to show a panel.
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
              {/*
               * A LINK, not a button. The pointer path and the keyboard path differ on
               * purpose: clicking a row opens it, because that is what clicking a row means
               * everywhere, while Enter copies, because that is what the reader came for.
               */}
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

      {/*
       * THE HINTS, which are the only documentation these shortcuts get: a keyboard
       * affordance nobody can discover is one nobody uses. The count says "6+ matches"
       * when the cap was hit, so six never reads as the whole answer.
       */}
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
