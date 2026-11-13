import { chooseAd, scopeArt, type Ad } from "capsomer/behavior/error-ad";

/**
 * Every ad, found by folder: adding `<id>/ad.json` and `<id>/art.svg` here is the whole of adding an ad, and it
 * reaches the utility pages and the gallery with no other edit (docs/UTILITY-ADS.md). Eager, so the data is in the
 * Worker bundle and a request reads no file.
 */
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
