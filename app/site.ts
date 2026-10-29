import { startIslands } from "@dustinedwards/devkit/islands";

// The one script every page runs, /site.js (devkit's siteScript in vite.config.ts): it starts each
// <template data-island> on the page, importing that island's content-hashed module from /islands/.
startIslands();

// An island added after load (the command palette, on the first Command-K: app/enhance/theme.ts) asks for a
// second pass; startIslands skips every element it has already started.
document.addEventListener("islands:start", () => startIslands());
