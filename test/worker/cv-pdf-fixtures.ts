import { vi } from "vitest";

/* What the CV PDF tests stand in for: Browser Run's binding (it has no local emulation, and the real one is
 * remote-only), the ASSETS binding the fonts are read through, and an ExecutionContext that keeps the promises a
 * save hands to waitUntil so a case can await the render the save started. Everything else (R2, D1, the
 * markdown pipeline, the save, the route) is the real code. */

export type RenderCall = { html: string; pdfOptions: Record<string, unknown> };

/** A body that passes the "is a PDF" guard in renderCvPdf: the magic number, then enough bytes. */
export function fakePdf(label: string) {
  return new TextEncoder().encode(`%PDF-1.7\n% ${label}\n${"x".repeat(2048)}\n%%EOF`);
}

/**
 * quickAction("pdf", ...) as a mock. `respond` decides each call's answer from its number (1-based); it may await
 * something, which is how a case holds one render open while another save lands.
 */
export function fakeBrowser(respond: (call: number, options: RenderCall) => Promise<Response> | Response) {
  const calls: RenderCall[] = [];
  const quickAction = vi.fn(async (action: string, options: RenderCall) => {
    if (action !== "pdf") throw new Error(`unexpected quickAction ${action}`);
    calls.push(options);
    return respond(calls.length, options);
  });
  return { calls, binding: { quickAction } as unknown as Env["BROWSER"] };
}

/** A browser that always answers with a PDF labelled by its call number. */
export const workingBrowser = () => fakeBrowser((call) => new Response(fakePdf(`render ${call}`), { headers: { "content-type": "application/pdf" } }));

/** The fonts: any asset URL answers with a few bytes. */
export const fakeAssets = {
  fetch: async () => new Response(new Uint8Array([0, 1, 2, 3])),
} as unknown as Env["ASSETS"];

/** An ExecutionContext whose waitUntil promises a case can await (settled, so one failure does not hide another). */
export function collectingContext() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (work: Promise<unknown>) => void pending.push(work),
    passThroughOnException: () => undefined,
  } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.allSettled(pending.splice(0)) };
}
