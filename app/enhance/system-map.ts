import { enhance } from "capsomer/behavior/system-map";

// An island (devkit ./islands): each <template data-island="system-map"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // The network at /systems and each /systems/<id> are whole as served: every card a link, every tie and line words,
  // each flow an ordered list. Capsomer's script adds the lighting of a card's ties under the pointer or the focus,
  // and Start, Next and Back over a flow's steps.
  enhance();
}
