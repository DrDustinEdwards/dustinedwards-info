import { useEffect, useState } from "react";

// Never auto-submits: a drop is easy to do by accident and an upload writes to R2.
export function DropAnywhere({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [over, setOver] = useState(false);

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
      if (!files || files.length === 0) return;
      event.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      const one = new DataTransfer();
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
