import { enhance } from "capsomer/behavior/tabs";

// An island (devkit ./islands): each <template data-island="platforms"> on the page calls this, and the first one runs it.
// Platform tabs on a software how-to (docs/KNOWLEDGE-BASE.md, S4) are Capsomer's progressive, remembered tabs
// (app/components/procedure-steps.tsx Platforms): this attaches every set on the page.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  enhance();
}
