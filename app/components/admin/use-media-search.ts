import { useEffect, useRef, useState } from "react";

import { errorMessage } from "~/lib/error-message.mjs";

type PalettePayload = { results: PaletteResult[]; hasMore: boolean };

export type PaletteResult = {
  key: string;
  url: string;
  name: string;
  dir: string;
  size: number;
  viewable: boolean;
};

/**
 * The palette's search: debounced, and sequenced, because a slow response to a shorter query can
 * land after a fast one and replace the right answer. `setCursor(0)` runs when fresh results land.
 */
export function useMediaSearch(query: string, setCursor: (cursor: number) => void) {
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  /* A failed search is said as one; an empty list would read as "nothing matches". */
  const [searchError, setSearchError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasMore(false);
      setSearchError(null);
      return;
    }
    const id = (seq.current += 1);
    const timer = window.setTimeout(() => {
      // Answered as JSON by the route's middleware; anything else (an expired session's page) is a failure.
      fetch(`/admin/media?palette=1&q=${encodeURIComponent(trimmed)}`, {
        headers: { accept: "application/json" },
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          if (!(r.headers.get("content-type") ?? "").includes("application/json")) {
            throw new Error("the server did not answer with results");
          }
          return r.json() as Promise<PalettePayload>;
        })
        .then((data) => {
          if (id !== seq.current) return;
          setSearchError(null);
          setResults(data.results ?? []);
          setHasMore(Boolean(data.hasMore));
          setCursor(0);
        })
        .catch((error: unknown) => {
          if (id !== seq.current) return;
          setResults([]);
          setHasMore(false);
          setSearchError(errorMessage(error));
        });
    }, 130);
    return () => window.clearTimeout(timer);
  }, [query, setCursor]);

  return { results, hasMore, searchError };
}
