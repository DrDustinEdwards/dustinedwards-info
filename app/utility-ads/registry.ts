import { chooseAd, scopeArt } from "./model.mjs";

/**
 * Every ad, found by folder: adding `<id>/ad.json` and `<id>/art.svg` here is the whole of adding an ad, and it
 * reaches the utility pages and the gallery with no other edit (docs/UTILITY-ADS.md). Eager, so the data is in the
 * Worker bundle and a request reads no file.
 */
export interface AdPart {
  kind: "text" | "burst" | "rect" | "use";
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  w?: number;
  h?: number;
  ref?: string;
  anchor?: "start" | "middle" | "end";
  font?: "display" | "slab" | "serif";
  size?: number;
  leading?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: { dx: number; dy: number; fill: string };
  rotate?: number;
  lines?: string[];
  outer?: number;
  inner?: number;
  points?: number;
  color?: string;
}
export interface AdRegion {
  viewBox: [number, number];
  parts: AdPart[];
}
export interface Ad {
  id: string;
  title: string;
  era: string;
  credit: string;
  ground: { color: string; dots?: string };
  layouts: {
    wide: { top: AdRegion; left: AdRegion; right: AdRegion; bottom: AdRegion };
    tall: { top: AdRegion; bottom: AdRegion };
  };
}

const data = import.meta.glob<Ad>("./*/ad.json", { eager: true, import: "default" });
const art = import.meta.glob<string>("./*/art.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

export const ADS: (Ad & { art: string })[] = Object.entries(data)
  .map(([path, ad]) => ({
    ...ad,
    art: scopeArt(art[path.replace("ad.json", "art.svg")] ?? "", ad.id),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

export function pickAd(search: string): (typeof ADS)[number] | undefined {
  return chooseAd(ADS, search);
}
