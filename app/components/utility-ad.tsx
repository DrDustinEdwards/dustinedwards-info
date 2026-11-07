import { preload } from "react-dom";

import { burstPoints } from "~/utility-ads/model.mjs";
import type { Ad, AdPart, AdRegion } from "~/utility-ads/registry";
// `?url`, not imports of the sheet itself: the root error boundary renders this, and a module import there would put the
// ad's sheet and fonts on every page of the site.
import adCssUrl from "~/utility-ads/utility-ads.css?url";
import bangersUrl from "~/utility-ads/fonts/bangers-latin-400-normal.woff2?url";
import alfaUrl from "~/utility-ads/fonts/alfa-slab-one-latin-400-normal.woff2?url";

/** The class that makes a page's main region an ad scene (utility-ads.css). */
export const AD_SCENE = "ad-scene";

function Part({ part, adId }: { part: AdPart; adId: string }) {
  const rotate = part.rotate
    ? `rotate(${part.rotate} ${part.x ?? part.cx} ${part.y ?? part.cy})`
    : undefined;
  if (part.kind === "text") {
    const lines = part.lines ?? [];
    const draw = (fill: string, dx: number, dy: number, stroke?: string) => (
      <text
        x={(part.x ?? 0) + dx}
        y={(part.y ?? 0) + dy}
        textAnchor={part.anchor}
        fontSize={part.size}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? part.strokeWidth : undefined}
        strokeLinejoin="round"
        paintOrder="stroke"
        className={`ad-f-${part.font}`}
      >
        {lines.map((line, i) => (
          <tspan
            key={line}
            x={(part.x ?? 0) + dx}
            dy={i === 0 ? 0 : (part.leading ?? (part.size ?? 20) * 1.2)}
          >
            {line}
          </tspan>
        ))}
      </text>
    );
    return (
      <g transform={rotate}>
        {part.shadow
          ? draw(part.shadow.fill, part.shadow.dx, part.shadow.dy, part.shadow.fill)
          : null}
        {draw(part.fill ?? "#000", 0, 0, part.stroke)}
      </g>
    );
  }
  if (part.kind === "burst") {
    return (
      <polygon
        points={burstPoints(
          part.cx ?? 0,
          part.cy ?? 0,
          part.outer ?? 1,
          part.inner ?? 1,
          part.points ?? 12,
        )}
        fill={part.fill}
        stroke={part.stroke}
        strokeWidth={part.strokeWidth}
        strokeLinejoin="round"
        transform={rotate}
      />
    );
  }
  if (part.kind === "rect") {
    return (
      <rect
        x={part.x}
        y={part.y}
        width={part.w}
        height={part.h}
        fill={part.fill}
        transform={rotate}
      />
    );
  }
  return (
    <use
      href={`#ad-${adId}-${part.ref}`}
      x={part.x}
      y={part.y}
      width={part.w}
      height={part.h}
      color={part.color}
      transform={rotate}
    />
  );
}

function Region({ ad, name, region }: { ad: Ad; name: string; region: AdRegion }) {
  return (
    <svg
      className="ad-region"
      data-region={name}
      viewBox={`0 0 ${region.viewBox[0]} ${region.viewBox[1]}`}
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
    >
      {region.parts.map((part, i) => (
        <Part key={i} part={part} adId={ad.id} />
      ))}
    </svg>
  );
}

/**
 * One ad as the page's backdrop: the ad's ground, then its parts in the template's regions, all inline SVG so the lettering
 * is real text in real fonts and nothing is fetched but the two fonts. Decoration only: hidden from assistive technology,
 * with the page's message and links first in the document. Give the page's main the AD_SCENE class and put this last in it.
 */
export function UtilityAd({ ad }: { ad: Ad & { art: string } }) {
  preload(bangersUrl, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload(alfaUrl, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  const dots = `ad-dots-${ad.id}`;
  return (
    <>
      {/* No `precedence`: React would lift the sheet above the color-scheme meta. */}
      <link rel="stylesheet" href={adCssUrl} />
      <div className="ad-layer" aria-hidden="true" data-ad={ad.id}>
        <svg className="ad-ground" focusable="false" preserveAspectRatio="none">
          {ad.ground.dots ? (
            <defs>
              <pattern id={dots} width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="7" cy="7" r="2.6" fill={ad.ground.dots} />
              </pattern>
            </defs>
          ) : null}
          <rect width="100%" height="100%" fill={ad.ground.color} />
          {ad.ground.dots ? <rect width="100%" height="100%" fill={`url(#${dots})`} /> : null}
        </svg>
        {/* The art's symbols, defined once for every region that uses them. Trusted markup from this repository. */}
        <svg className="ad-defs" focusable="false" dangerouslySetInnerHTML={{ __html: ad.art }} />
        <div className="ad-layout" data-layout="wide">
          {(["top", "left", "right", "bottom"] as const).map((name) => (
            <Region key={name} ad={ad} name={name} region={ad.layouts.wide[name]} />
          ))}
        </div>
        <div className="ad-layout" data-layout="tall">
          {(["top", "bottom"] as const).map((name) => (
            <Region key={name} ad={ad} name={name} region={ad.layouts.tall[name]} />
          ))}
        </div>
      </div>
    </>
  );
}
