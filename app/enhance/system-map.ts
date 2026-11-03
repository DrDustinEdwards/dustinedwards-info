import { enhance } from "capsomer/behavior/system-map";

// An island (devkit ./islands): each <template data-island="system-map"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // The network at /systems and each /systems/<id> are whole as served: every system a link, every tie a line and
  // words, each flow an ordered list. Capsomer's script adds the tabs between the hexagons and the plain map, the
  // lighting of a system's ties under the pointer or the focus, and Start, Next and Back over a flow's steps.
  enhance();
}
