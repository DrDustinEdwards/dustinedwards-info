import { ANNEALING_LEAD, NEB_TM_CALCULATOR, tmStatement } from "~/kb/registry/tm.mjs";

/** The Tm statement and the sentence that sends a reader to the annealing calculator: one wording with the twin (tm.mjs). */
export function TmNote({ className }: { className: string }) {
  return (
    <p className={className}>
      {tmStatement()} {ANNEALING_LEAD} <a href={NEB_TM_CALCULATOR.url}>{NEB_TM_CALCULATOR.name}</a>.
    </p>
  );
}
