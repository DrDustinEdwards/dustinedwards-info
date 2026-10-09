// The one Node built-in the Worker imports. Workers run with nodejs_compat on by default at this
// compatibility date, so `node:crypto` resolves at runtime, but the Worker's type project carries no
// Node types (and should not: Node globals would type-check code that fails in workerd). This
// declares only the function bearer.server.ts uses, with the signature the runtime provides.
declare module "node:crypto" {
  export function timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean;
}
