import { enhance } from "capsomer/behavior/lightbox";

// An island (devkit ./islands): each <template data-island="roster"> on the page calls this. The roster's cohort photos
// open full size in Capsomer's lightbox, the one the posts use; the roster marks itself data-cap="lightbox".
export default function start(): void {
  enhance();
}
