/*
 * The one inline script a public page runs. <Enhance module> renders an inert
 * `<template data-enhance="/assets/x-HASH.js">` marker; this script, rendered once at the end of
 * <body> by app/root.tsx, turns every marker into a module script. The policy allows it by its
 * sha256 (workers/csp.mjs hashes THIS constant), and 'self' allows the same-origin bundles it
 * inserts, so a cached public page carries no nonce at all.
 *
 * Firefox and Safari do not match hashes against external scripts, which is why the bundles are
 * inserted by a hashed inline script instead of carrying hashes themselves.
 *
 * THE TEXT IS THE HASH: any edit here changes the policy, and the gates recompute it from this
 * string. It must never contain `<`, so React can render it raw and the bytes stay identical.
 *
 * - Deduplicated by resolved URL, in document order, like the parser-inserted tags it replaces.
 * - `async = false` keeps that order: a dynamic module script is otherwise run as it arrives.
 * - Only the rule in app/lib/enhance-url.mjs, which the palette trigger applies too: resolved
 *   against the page, same origin, and a normalized path under `/assets/`, so a marker
 *   smuggled into a page cannot borrow the trust and `..` cannot climb out.
 *   test/enhance-loader.test.mjs runs this text and the palette's rule over the same cases.
 * - A refused marker is skipped, and one error naming every refusal is thrown after the loop, so
 *   later bundles still load and the refusal still reaches the console.
 * - Document methods are taken from `Document.prototype`, because a named element such as
 *   `<img name="querySelectorAll">` shadows the ones on `document` itself.
 */

import { ENHANCE_URL_PREFIX } from "./enhance-url.mjs";

export { ENHANCE_URL_PREFIX };

export const ENHANCE_LOADER =
  '{const d=document,P=Document.prototype,h=P.querySelector.call(d,"head"),seen=new Set,bad=[];' +
  'for(const t of P.querySelectorAll.call(d,"template[data-enhance]")){' +
  'const r=t.getAttribute("data-enhance");let u;try{u=new URL(r,location.href)}catch{}' +
  `if(!u||u.origin!==location.origin||!u.pathname.startsWith("${ENHANCE_URL_PREFIX}")){bad.push(r);continue}` +
  "if(seen.has(u.href))continue;seen.add(u.href);" +
  'const s=P.createElement.call(d,"script");s.type="module";s.async=false;s.src=u.href;h.appendChild(s)}' +
  'if(bad.length)throw new Error("enhance: refused "+bad.join(", "))}';
