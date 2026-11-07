import { preload } from "react-dom";

import { burstPoints } from "~/utility-ads/model.mjs";
import type { Ad, AdPart } from "~/utility-ads/registry";
// `?url`, not imports of the sheet itself: the root error boundary renders this, and a module import there would put the
// ad's sheet and fonts on every page of the site.
import adCssUrl from "~/utility-ads/utility-ads.css?url";
import bangersUrl from "~/utility-ads/fonts/bangers-latin-400-normal.woff2?url";
import alfaUrl from "~/utility-ads/fonts/alfa-slab-one-latin-400-normal.woff2?url";

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
        fill={fill === "ink" ? undefined : fill}
        stroke={stroke}
        strokeWidth={stroke ? part.strokeWidth : undefined}
        strokeLinejoin="round"
        paintOrder="stroke"
        className={`ad-f-${part.font}${fill === "ink" ? " ad-ink" : ""}`}
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

/**
 * One ad, as a corner piece for the foot of a utility page: inline SVG, so the lettering is real text in real fonts and
 * nothing is fetched but the two fonts. It has no ground and no frame, so the page's own background shows through.
 * Decoration only: hidden from assistive technology, and placed after the page's message and links. Put it last in main.
 */
export function UtilityAd({
  ad,
  size = "corner",
}: {
  ad: Ad & { art: string };
  size?: "corner" | "large";
}) {
  preload(bangersUrl, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload(alfaUrl, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <>
      {/* No `precedence`: React would lift the sheet above the color-scheme meta. */}
      <link rel="stylesheet" href={adCssUrl} />
      <div className="ad-corner" data-size={size} aria-hidden="true" data-ad={ad.id}>
        {/* The art's symbols, defined once. Trusted markup from this repository. */}
        <svg className="ad-defs" focusable="false" dangerouslySetInnerHTML={{ __html: ad.art }} />
        <svg className="ad-art" viewBox={`0 0 ${ad.viewBox[0]} ${ad.viewBox[1]}`} focusable="false">
          {ad.parts.map((part, i) => (
            <Part key={i} part={part} adId={ad.id} />
          ))}
        </svg>
      </div>
    </>
  );
}
