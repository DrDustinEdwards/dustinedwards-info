import { wireListen } from "capsomer/behavior/dictionary-entry";

// An island (devkit ./islands): each <template data-island="pronounce"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  /*
   * The speaker on a dictionary entry (Capsomer's, capsomer/behavior/dictionary-entry): the server renders
   * the plain link to the clip, which works with script off, and this swaps in the button that plays it in
   * place. wireListen per entry, not enhance(): React's DictionaryEntry marks its section data-cap-ready for
   * a hydrated page, and this page is not hydrated, so enhance() would skip it.
   */
  for (const entry of document.querySelectorAll<HTMLElement>("[data-cap='dictionary-entry']")) {
    const button = entry.querySelector<HTMLButtonElement>("button[data-cap-part='listen']");
    const link = entry.querySelector<HTMLAnchorElement>("a[data-cap-part='listen-link']");
    if (button && link) wireListen(button, link);
  }
}
