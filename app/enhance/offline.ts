// An island (devkit ./islands): each <template data-island="offline"> on the page calls this, and the first one runs it.
import { enhance } from "capsomer/behavior/offline-keep";

let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // "Keep on this device" on a procedure page (docs/KNOWLEDGE-BASE.md, A3) is Capsomer's offline-keep: the slot joins the
  // row of buttons under the title, and the module fills it. The worker is Capsomer's too (capsomer/offline-sw.js),
  // served at /sw.js by vite.config.ts.
  const links = document.querySelector<HTMLElement>(".procedure .procedure-links");
  if (!links) return;
  const slot = document.createElement("span");
  slot.dataset.cap = "offline-keep";
  links.appendChild(slot);
  enhance(links);
}
