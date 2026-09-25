import { apca, contrast, normalizeHex } from "~/lib/contrast.mjs";

/** The contrast lab's share of the playground loader: `fg` and `bg` in, the ratio and APCA Lc out. */
export function contrastDemo(params: URLSearchParams) {
  const fgRaw = (params.get("fg") ?? "").trim();
  const bgRaw = (params.get("bg") ?? "").trim();
  let lab = null;
  let labError: string | null = null;

  if (fgRaw || bgRaw) {
    const fg = normalizeHex(fgRaw);
    const bg = normalizeHex(bgRaw);
    if (!fg || !bg) {
      const bad = [!fg ? "foreground" : null, !bg ? "background" : null]
        .filter(Boolean)
        .join(" and ");
      labError = `The ${bad} is not a hex color. Use three or six hex digits, like #4F2D7F.`;
    } else {
      const ratio = contrast(fg, bg);
      lab = {
        fg,
        bg,
        ratio,
        lc: apca(fg, bg),
        // WCAG 2.2 1.4.3. Large is 18.66px bold or 24px, hence the two floors.
        passNormal: ratio >= 4.5,
        passLarge: ratio >= 3,
        passAAANormal: ratio >= 7,
      };
    }
  }

  return { lab, labError, fgRaw, bgRaw };
}
