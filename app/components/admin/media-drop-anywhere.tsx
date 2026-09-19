/*
 * DROP A FILE ANYWHERE ON THE PAGE.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { useEffect, useState } from "react";

/**
 * LAYERED OVER THE FORM, never instead of it. It sets the EXISTING input's
 * `files` and does not submit, so with script off the form is untouched.
 *
 * It deliberately DOES NOT AUTO-SUBMIT: a drop is easy to do by accident, an
 * upload writes to R2, and the ladder puts a deliberate press in front of every
 * write on this page.
 *
 * KEYBOARD REACHABILITY is not this control's job and it claims none: the file
 * input beside it is the keyboard path and always was.
 */
export function DropAnywhere({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [over, setOver] = useState(false);

  useEffect(() => {
    /*
     * A COUNTER, not a boolean, because dragenter and dragleave fire for every
     * nested element the pointer crosses and a naive boolean flickers off the moment
     * the cursor moves between two tiles.
     */
    let depth = 0;
    const stop = (event: DragEvent) => {
      event.preventDefault();
    };
    const enter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      depth += 1;
      setOver(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const drop = (event: DragEvent) => {
      depth = 0;
      setOver(false);
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      event.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      // ONE file, because the form takes one and inventing a queue here would
      // be a second upload path with none of the server's contract.
      const one = new DataTransfer();
      // The file is read by value. `files.length === 0` already returned above,
      // so the guard is unreachable and it substitutes nothing.
      const first = files[0];
      if (!first) return;
      one.items.add(first);
      input.files = one.files;
      input.focus();
    };

    window.addEventListener("dragover", stop);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [inputRef]);

  if (!over) return null;
  return (
    <p className="media-drop-hint" role="status">
      Drop to load it into the upload form. Nothing uploads until you press
      Upload.
    </p>
  );
}
