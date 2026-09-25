import { useEffect, useState } from "react";

const TOAST_EVENT = "media-toast";

// A custom event, not context: a provider would put the toast in the server render, where it has nothing to say.
export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

// Always in the DOM once mounted: a live region inserted when it gets content is often not announced.
export function MediaToast() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer = 0;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(detail);
      window.clearTimeout(timer);
      // Long enough to read a filename, short enough not to sit over the grid.
      timer = window.setTimeout(() => setMessage(""), 2600);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <p className="media-toast" role="status" aria-live="polite" data-showing={message ? "yes" : undefined}>
      {message}
    </p>
  );
}
