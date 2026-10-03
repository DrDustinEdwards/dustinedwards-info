import { ENHANCE_URLS } from "virtual:enhance";

/*
 * How a public piece becomes interactive today, while public pages do not hydrate:
 * <Enhance module="plate" /> where the markup it enhances is rendered. The URLs come from the app
 * build, which bundles each `app/enhance/*.ts` in isolation and emits it as a self-contained asset
 * (scripts/lib/enhance-bundle.mjs).
 */
export { ENHANCE_URLS };

export type EnhanceModule = keyof typeof ENHANCE_URLS;

// A marker, not a script: a `<template>` is never fetched or run. The loader app/root.tsx renders
// at the end of <body> (app/lib/enhance-loader.mjs) inserts one module script per URL, which the
// policy allows as same-origin ('self'), so a cached page needs no nonce.
export function Enhance({ module }: { module: EnhanceModule }) {
  return <template data-enhance={ENHANCE_URLS[module]} />;
}
