import { enhance } from "capsomer/behavior/annotated-figure";

// An island (devkit ./islands): each <template data-island="plate"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // Plate I (app/components/plate-i.tsx) is Capsomer's annotated figure: a plaque and its key entry light
  // together under a mouse and pin on a tap, and the leaders draw themselves in once the plate is in view.
  enhance();
}
