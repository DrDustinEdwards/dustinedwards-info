/*
 * DROP A FILE ANYWHERE ON THE PAGE.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { useEffect, useState } from "react";

/**
 * Drop a file anywhere on the page to load it into the upload form.
 *
 * LAYERED OVER THE FORM, never instead of it. It sets the EXISTING input's
 * `files` and does not submit, so what happens next is what has always happened
 * next: the author sees the filename in the field and presses Upload. That is
 * the whole enhancement, and it is why it degrades perfectly: with script off
 * the form is untouched and the page behaves exactly as it did before this
 * existed.
 *
 * It deliberately DOES NOT auto-submit. A drop is easy to do by accident, an
 * upload writes to R2, and the friction ladder puts a deliberate press in front
 * of every write on this page.
 *
 * KEYBOARD REACHABILITY is not this control's job and it does not claim any: it
 * renders no focusable element and adds no shortcut. The file input beside it
 * is the keyboard path and always was, which is why this can be a pure
 * convenience rather than a second way in that has to be made accessible.
 *
 * CLIENT STATE ADDED: one boolean, `over`, purely to draw the target. It is
 * initialised false so the hydration render matches the server's.
 */
export function DropAnywhere({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [over, setOver] = useState(false);

  useEffect(() => {
    /* A COUNTER, not a boolean, because dragenter and dragleave fire for every
       nested element the pointer crosses and a naive boolean flickers off the
       moment the cursor moves between two tiles. */
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
      one.items.add(files[0]);
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
