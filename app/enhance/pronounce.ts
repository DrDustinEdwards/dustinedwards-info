import { enhance } from "capsomer/behavior/player";

// An island (devkit ./islands): each <template data-island="pronounce"> on the page calls this, and the first one runs it.
// The pronunciation button on a dictionary entry (app/components/dictionary-entry.tsx) is Capsomer's PlayClip: this
// attaches every one on the page, swapping the plain link for the button that plays the clip in place.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  enhance();
}
