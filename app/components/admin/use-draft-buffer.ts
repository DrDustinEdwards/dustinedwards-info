import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  bufferDiffers,
  clearAllBuffersFor,
  draftKey,
  purgeLegacyBuffers,
  readBuffer,
  readForm,
  writeBuffer,
  type DraftBuffer,
} from "~/lib/editor/draft-buffer";
import type { EditorFeedback } from "~/lib/editor/feedback";

// The label reads in whole minutes, so 30s lags by at most half a unit; a 1s tick would re-render sixty times per change.
const BUFFER_AGE_TICK_MS = 30_000;

/**
 * The editor's browser-local crash net: the buffer write, the offer to restore an earlier session's
 * buffer, its clearing once a save lands, and the clock its age label reads.
 */
export function useDraftBuffer({
  formRef,
  slug,
  headSha,
  isNew,
  feedback,
  dirty,
  setDirty,
  setRestoredFrom,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  /** The committed slug, empty for a new post. */
  slug: string;
  headSha: string;
  isNew: boolean;
  feedback: EditorFeedback | null | undefined;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  setRestoredFrom: Dispatch<SetStateAction<string | null>>;
}) {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [ageNow, setAgeNow] = useState(() => Date.now());
  // writeBuffer returns null both before it has run and when storage refuses, so the attempt is tracked separately.
  const [bufferTried, setBufferTried] = useState(false);
  const [offer, setOffer] = useState<DraftBuffer | null>(null);

  const autosaveTimer = useRef<number>(0);
  const storageKey = draftKey(slug, headSha);

  // Never commits: a browser-local crash net. The save path is the only writer.
  const persist = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    setBufferTried(true);
    setSavedAt(writeBuffer(storageKey, readForm(form)));
  }, [storageKey, formRef]);

  useEffect(() => {
    purgeLegacyBuffers();
  }, []);

  // Restoring is never automatic: replacing committed content with older local text is the surprise this prevents.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const stored = readBuffer(storageKey);
    if (!stored) return;
    if (!bufferDiffers(stored, readForm(form))) {
      clearAllBuffersFor(slug);
      return;
    }
    setOffer(stored);
  }, [storageKey, slug, formRef]);

  useEffect(() => {
    if (!feedback || feedback.state === "failed") return;
    clearAllBuffersFor(slug);
    if (isNew) clearAllBuffersFor("");
    setOffer(null);
    setDirty(false);
    setRestoredFrom(null);
  }, [feedback, slug, isNew, setDirty, setRestoredFrom]);

  useEffect(() => {
    if (!dirty || !savedAt) return;
    setAgeNow(Date.now());
    const id = window.setInterval(() => setAgeNow(Date.now()), BUFFER_AGE_TICK_MS);
    return () => window.clearInterval(id);
  }, [dirty, savedAt]);

  return { offer, setOffer, savedAt, ageNow, bufferTried, persist, autosaveTimer };
}
