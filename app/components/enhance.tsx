import { ENHANCE_URLS } from "virtual:enhance";

/*
 * The one way a public piece becomes interactive: <Enhance module="plate" /> where the markup it
 * enhances is rendered. The URLs come from the app build, which bundles each `app/enhance/*.ts`
 * in isolation and emits it as a self-contained asset (scripts/lib/enhance-bundle.mjs).
 * check:page-payload reads `<Enhance module="…"` in a route's source to know which bundles that
 * route serves.
 */
export { ENHANCE_URLS };

export type EnhanceModule = keyof typeof ENHANCE_URLS;

// A marker, not a script: a `<template>` is never fetched or run. The loader app/root.tsx renders
// at the end of <body> (app/lib/enhance-loader.mjs) inserts one module script per URL, which the
// policy trusts through 'strict-dynamic', so a cached page needs no nonce.
export function Enhance({ module }: { module: EnhanceModule }) {
  return <template data-enhance={ENHANCE_URLS[module]} />;
}
