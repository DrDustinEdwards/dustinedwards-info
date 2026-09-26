/*
 * The one inline script a public page runs. <Enhance module> renders an inert
 * `<template data-enhance="/assets/x-HASH.js">` marker; this script, rendered once at the end of
 * <body> by app/root.tsx, turns every marker into a module script. The policy allows it by its
 * sha256 (workers/csp.mjs hashes THIS constant), and 'strict-dynamic' extends that trust to the
 * scripts it inserts, so a cached public page carries no nonce at all.
 *
 * Firefox and Safari do not match hashes against external scripts, which is why the bundles are
 * inserted by a hashed inline script instead of carrying hashes themselves.
 *
 * THE TEXT IS THE HASH: any edit here changes the policy, and the gates recompute it from this
 * string. It must never contain `<`, so React can render it raw and the bytes stay identical.
 *
 * - Deduplicated, in document order, like the parser-inserted tags it replaces.
 * - `async = false` keeps that order: a dynamic module script is otherwise run as it arrives.
 * - Only same-origin `/assets/` URLs: a marker smuggled into a page cannot borrow the trust.
 *   Refusing one throws, so it reaches the console and check:browser's error sweep.
 */

/** Where the app build emits the bundles (scripts/lib/enhance-bundle.mjs), under Vite's base `/`. */
export const ENHANCE_URL_PREFIX = "/assets/";

export const ENHANCE_LOADER =
  'for(const u of new Set(Array.from(document.querySelectorAll("template[data-enhance]"),t=>t.dataset.enhance))){' +
  `if(!u.startsWith("${ENHANCE_URL_PREFIX}"))throw new Error("enhance: refused "+u);` +
  'const s=document.createElement("script");s.type="module";s.async=false;s.src=u;document.head.appendChild(s)}';
