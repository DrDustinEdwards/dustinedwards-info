import type { EditorView } from "@codemirror/view";
import { useState } from "react";

import { uploadMedia } from "~/lib/media/upload-contract.mjs";
import { insertBlock } from "./md-editor-commands";

/**
 * The markdown editor's dropped or pasted image: the upload, its failure, the alt prompt, and the
 * figure it inserts once alt text exists.
 */
export function useImageUpload(viewRef: React.RefObject<EditorView | null>) {
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  // Callers `void` this; `uploadMedia` never rejects, so every failure ends here as a message.
  const uploadFile = async (file: File) => {
    setUploadError(null);
    setUpload({ url: "", name: file.name });
    const result = await uploadMedia(file);
    if ("error" in result) {
      setUpload(null);
      setUploadError(result.error);
      return;
    }
    setUpload({ url: result.url, name: file.name });
    setAlt("");
  };

  const insertFigure = () => {
    const view = viewRef.current;
    if (!view || !upload?.url || !alt.trim()) return;
    insertBlock(
      view,
      [`:::figure{src="${upload.url}" alt="${alt.trim().replace(/"/g, "&quot;")}"}`, ":::"].join(
        "\n",
      ),
    );
    setUpload(null);
    setAlt("");
  };

  return { upload, setUpload, uploadError, alt, setAlt, uploadFile, insertFigure };
}
