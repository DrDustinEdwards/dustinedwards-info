# Utility-page ads

A vintage comic-book ad sits behind each utility page as an Easter egg: the 404 today, and the 410, 403 and 500 through the same error page; the gallery at `/ads`. It is decoration on top of the shared pages, never a replacement for them.

## What is shared and what is this site's

- **Shared:** the message, status, buttons and help are Capsomer's `ErrorPage` (`capsomer/react/error-page`) with this site's header, footer and `NotFoundHelp` (`app/components/error-page.tsx`). Nothing there is forked.
- **This site's theme slot:** `app/components/utility-ad.tsx` and `app/utility-ads/`. `SiteErrorPage` gives `main` the `ad-scene` class and puts `<UtilityAd>` last inside it.
- **The 503 maintenance page** is site-runtime's self-contained page (no database, loader or stylesheet), so it carries no ad.

## The template (fixed, the same for every ad)

The UI column is 34 rem wide, centered, over a solid backing in the theme's surface color, so it reads over any ad. The ad fills the rest of `main`, edge to edge, with no frame:

| Layout | Used from    | Regions (view box)                                         |
| ------ | ------------ | ---------------------------------------------------------- |
| wide   | 64 rem up    | top 1200×200, left 300×500, right 300×500, bottom 1200×160 |
| tall   | below 64 rem | top 600×360, bottom 200 high, 600×200                      |

The geometry is in `utility-ads.css`. An ad supplies content for the regions and never moves them, so the status code, message and buttons are in the same place on every page. The ad layer is `aria-hidden`, comes after the message in the document, takes no pointer events and is not printed or drawn in forced-colors mode.

## The ad format

One folder per ad, `app/utility-ads/<id>/`, found by `import.meta.glob`. Adding the folder is the whole of adding an ad: it appears on the utility pages and in the gallery.

- `ad.json`: `id` (the folder name), `title`, `era` (`1940s` to `1970s`), `credit` (who made the art and copy), `ground` (`color`, optional halftone `dots`), and `layouts.wide` and `layouts.tall` holding the regions above, each `{ viewBox, parts }`.
- `art.svg`: `<symbol id="...">` elements with the ad's illustrations. Write bare ids; the renderer prefixes them with the ad id.
- Parts: `text` (`lines`, `font`, `size`, `x`, `y`, `anchor`, `fill`, `stroke`, `strokeWidth`, `shadow`, `rotate`, `leading`), `burst` (`cx`, `cy`, `outer`, `inner`, `points`, `fill`, `stroke`), `rect`, and `use` (`ref` is a symbol, with `x`, `y`, `w`, `h`, `color`).
- Fonts: `display` (Bangers), `slab` (Alfa Slab One) and `serif` (the site's Source Serif 4, bold). Bangers and Alfa Slab One are SIL Open Font License, self-hosted in `app/utility-ads/fonts/` with their licenses; `font-display: optional` and a preload, as the site's other faces.

`test/utility-ads.test.mjs` checks every folder against the template.

## Choice and the gallery

The error page picks one ad per request on the server, with `Math.random`, so there is no flicker; those pages do not hydrate, so the pick stands. `?ad=<id>` names one. The gallery is `/ads` (the first ad), `/ads/<id>`, and `/ads/random` (a 302 to a random one), with Previous, Next and Random as plain links. Nothing is tracked and nothing is fetched from outside the site.

## Rights and content

The ads are original period-style work for this site: the art, copy and product names are made here, not copied from any real ad, and no trademark is used. Do not add scans, traced art or a real brand. Skip live animals, weapons, weight, height and acne ads, and any caricature or demeaning content.
