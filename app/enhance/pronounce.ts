import { enhance } from "capsomer/behavior/dictionary-entry";

// An island (devkit ./islands): each <template data-island="pronounce"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // The speaker on a dictionary entry (Capsomer's, capsomer/behavior/dictionary-entry): the server renders the plain
  // link to the clip, which works with script off, and this swaps in the button that plays it in place.
  enhance();
}
