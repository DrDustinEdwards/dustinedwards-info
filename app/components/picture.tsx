import type { PictureProps } from "@dustinedwards/site-runtime/image";

/** A `<picture>` from site-runtime's pictureProps: AVIF and WebP sources over the `<img>`. */
export function Picture({ picture }: { picture: PictureProps }) {
  return (
    <picture>
      {picture.sources.map((source) => (
        <source key={`${source.type} ${source.media ?? ""}`} type={source.type} srcSet={source.srcSet} sizes={source.sizes} media={source.media} />
      ))}
      <img {...picture.img} />
    </picture>
  );
}
