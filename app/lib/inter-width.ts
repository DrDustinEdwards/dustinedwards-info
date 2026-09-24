import { INTER_ADVANCES } from "./inter-advances.generated.ts";

/*
 * A filter link's box is sized from Inter's own advances, so the row wraps the same way in whichever
 * face is drawing it. Wrapping by measured glyph width re-flowed the /blog tag row when Inter replaced
 * its fallback: the metric-matched Arial held the row still only between size-adjust 108% and 110%, and
 * a machine with a different Arial fell outside that window (nightly CLS 0.094).
 */
export function interWidthEm(text: string, weight: 400 | 600): number {
  const advances = INTER_ADVANCES[weight];
  // Wider than any Latin glyph, so a character outside the table can only widen the box.
  const unknown = Math.max(...advances);
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    width += advances[code - 32] ?? unknown;
  }
  return Math.ceil(width * 100) / 100;
}
