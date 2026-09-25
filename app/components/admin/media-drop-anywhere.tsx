import { useEffect, useState } from "react";

// Never auto-submits: a drop is easy to do by accident and an upload writes to R2.
export function DropAnywhere({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /* The file input is clipped out of sight, so the name it holds is said here or nowhere. */
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    // A counter, not a boolean: dragenter and dragleave fire for every nested element the pointer crosses.
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
      if (!files || files.length === 0) {
        // A dropped link or text would otherwise navigate away from the page; a field still takes its text.
        const target = event.target as HTMLElement | null;
        const editable = target?.closest("input, textarea, [contenteditable='true']");
        if (!editable) event.preventDefault();
        return;
      }
      event.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      const one = new DataTransfer();
      const first = files[0];
      if (!first) return;
      one.items.add(first);
      input.files = one.files;
      input.focus();
      setChosen(first.name);
      setNote(
        files.length > 1
          ? `Only ${first.name} was loaded. The form takes one file, so the other ${files.length - 1} were left out.`
          : null,
      );
    };

    // Browsing sets the input directly; assigning `files` on a drop fires no change, hence both paths.
    const input = inputRef.current;
    const onChange = () => {
      setChosen(input?.files?.[0]?.name ?? "");
      setNote(null);
    };
    input?.addEventListener("change", onChange);

    window.addEventListener("dragover", stop);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      input?.removeEventListener("change", onChange);
      window.removeEventListener("dragover", stop);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [inputRef]);

  // One region, in the document before anything is dropped or chosen, so each change is announced.
  return (
    <div className="media-drop-status" role="status">
      {over ? (
        <p className="media-drop-hint">
          Drop to load it into the upload form. Nothing uploads until you press
          Upload.
        </p>
      ) : (
        <>
          {chosen ? <p className="media-upload-chosen">Ready to upload {chosen}.</p> : null}
          {note ? <p className="media-drop-hint">{note}</p> : null}
        </>
      )}
    </div>
  );
}
