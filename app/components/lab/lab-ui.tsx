// The /lab-bench pages' result line: Capsomer's form status, said in the lab's words.

import { useMemo } from "react";
import { FormStatus } from "capsomer/react/form-status";

/** The answer to the last post, as the form status says it: "Done: ..." when it worked, "Not done: ..." when it did not. */
export function LabStatus({ result }: { result?: { ok: boolean; text: string } | null }) {
  const status = useMemo(
    () =>
      result
        ? { ok: result.ok, message: `${result.ok ? "Done" : "Not done"}: ${result.text}` }
        : null,
    [result],
  );
  return <FormStatus status={status} />;
}
