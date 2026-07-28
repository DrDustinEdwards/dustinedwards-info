import { useEffect, useRef, useState } from "react";

/**
 * The Ask affordance on /search. Search Layer 2.
 *
 * Renders a button and an empty container. The button does nothing without
 * script, so it is not rendered until the client has mounted: an inert control
 * that looks live is worse than no control. Classic results are already on
 * screen by the time any of this exists, and nothing here can delay them.
 *
 * The streaming client is a dynamic import, so it is its own chunk and is
 * fetched only when a reader actually asks something. A reader who never clicks
 * Ask never downloads it.
 */
export function AskMount({ question }: { question: string }) {
  const container = useRef<HTMLDivElement>(null);
  const handle = useRef<{ cancel(): void } | null>(null);
  // False during SSR and the first paint, so the button appears only where it
  // can work. This is the same reasoning as the palette upgrading a real link.
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    setReady(true);
    return () => handle.current?.cancel();
  }, []);

  // A new query means the previous answer is about a different question.
  useEffect(() => {
    handle.current?.cancel();
    handle.current = null;
    setAsking(false);
  }, [question]);

  async function run() {
    if (!container.current || !question.trim()) return;
    setAsking(true);
    const { ask } = await import("~/enhance/ask");
    handle.current = ask(container.current, question);
  }

  return (
    <div className="ask-mount">
      {ready && !asking ? (
        <button type="button" className="ask-trigger" onClick={run}>
          Ask AI about this
        </button>
      ) : null}
      <div ref={container} className="ask-container" hidden />
    </div>
  );
}
