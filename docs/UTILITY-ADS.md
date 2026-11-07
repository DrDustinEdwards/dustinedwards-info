# Utility-page ads

A small vintage comic-book ad sits at the foot of each error page (404, 410, 403, 500) as an Easter egg, with a gallery at `/ads`. The page above it is the site's own, unchanged: same background, same plain, functional message, buttons and help. The ad never sits over any of it.

## What is shared and what is this site's

- **Shared:** the message, status, buttons and 404 help are Capsomer's `ErrorPage` (`capsomer/react/error-page`) with this site's header, footer and `NotFoundHelp` (`app/components/error-page.tsx`). Nothing there is forked.
- **This site's theme slot:** `app/components/utility-ad.tsx` and `app/utility-ads/`. `SiteErrorPage` puts `<UtilityAd>` last inside `main`, after the page's content.
- **The 503 maintenance page** is site-runtime's self-contained page (no database, loader or stylesheet), so it carries no ad.

## Placement

One corner piece, bottom right of the page column, 26 rem wide at most and full width on a phone. It has no ground and no frame, so the page background shows through. Text uses the `ink` color, which is dark on a light page and light on a dark one. The ad is `aria-hidden`, comes after the message in the document, takes no pointer events, and is neither printed nor drawn in forced-colors mode. The gallery shows the same piece larger.

## The ad format

One folder per ad, `app/utility-ads/<id>/`, found by `import.meta.glob`. Adding the folder is the whole of adding an ad: it appears on the error pages and in the gallery.

- `ad.json`: `id` (the folder name), `title`, `era` (`1940s` to `1970s`), `credit` (who made the art and copy), `viewBox` (`[width, height]`), and `parts`, drawn in order.
- `art.svg`: `<symbol id="...">` elements with the ad's illustrations. Write bare ids; the renderer prefixes them with the ad id.
- Parts: `text` (`lines`, `font`, `size`, `x`, `y`, `anchor`, `fill`, `stroke`, `strokeWidth`, `shadow`, `rotate`, `leading`), `burst` (`cx`, `cy`, `outer`, `inner`, `points`, `fill`, `stroke`), `rect`, and `use` (`ref` is a symbol, with `x`, `y`, `w`, `h`, `color`). A `fill` is a hex color or `ink`.
- Fonts: `display` (Bangers), `slab` (Alfa Slab One) and `serif` (the site's Source Serif 4, bold). Bangers and Alfa Slab One are SIL Open Font License, self-hosted in `app/utility-ads/fonts/` with their licenses; `font-display: optional` and a preload, as the site's other faces.

`test/utility-ads.test.mjs` checks every folder.

## Choice and the gallery

The error page picks one ad per request on the server, with `Math.random`, so there is no flicker; those pages do not hydrate, so the pick stands. `?ad=<id>` names one. The gallery is `/ads` (the first ad), `/ads/<id>`, and `/ads/random` (a 302 to a random one), with Previous, Next and Random as plain links. Nothing is tracked and nothing is fetched from outside the site.

## Rights and content

The ads are original period-style work for this site: the art, copy and product names are made here, not copied from any real ad, and no trademark is used. Do not add scans, traced art or a real brand. Skip live animals, weapons, weight, height and acne ads, and any caricature or demeaning content.
