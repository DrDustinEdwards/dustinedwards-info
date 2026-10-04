import { useEffect, useState } from "react";
import { useMessage } from "capsomer/react/message";

const TOAST_EVENT = "media-toast";

// A custom event, not context: a provider would put the toast in the server render, where it has nothing to say.
export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

/**
 * The page's copy of a toast is Capsomer's message region, which is in the document from the start and
 * says a result without taking focus. The inspector carries its own, `inDialog`, because the page's
 * region is inert and hidden behind the modal; the page's stays quiet while the inspector is open.
 */
export function MediaToast({ inDialog = false }: { inDialog?: boolean }) {
  const { say } = useMessage();
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer = 0;
    const onToast = (event: Event) => {
      const open = document.querySelector("dialog[data-media-inspector]:modal") !== null;
      if (!inDialog && open) return;
      const detail = (event as CustomEvent<string>).detail;
      if (!inDialog) {
        say(detail, { clears: true });
        return;
      }
      setMessage(detail);
      window.clearTimeout(timer);
      // Long enough to read a filename; a long address gets longer.
      timer = window.setTimeout(() => setMessage(""), Math.max(2600, detail.length * 60));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, [inDialog, say]);

  // Only the inspector draws one: the page's message goes to the region.
  return inDialog ? (
    <p className="cap-muted" role="status" aria-live="polite">
      {message}
    </p>
  ) : null;
}
