/* The post-body render the directive and image tests drive, stated once. It is the real
 * pipeline with a fixed file label; only the image resolver varies between files. */

import { renderBody } from "../../app/lib/content/pipeline.mjs";

/**
 * @param {string} body
 * @param {(src: string) => any} [resolveImage] defaults to resolving nothing
 */
export const render = (body, resolveImage = () => null) =>
  renderBody({ file: "test.md", body, resolveImage });

/** Every image resolves to one fixed size, deliberately not the dimensions in a media key. */
export const fixedSize = async () => ({ width: 1280, height: 720 });

/** @param {string} html */
export const images = (html) => html.match(/<img\b[^>]*>/g) ?? [];

/**
 * @param {string} tag
 * @param {string} name
 */
export function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/**
 * Two images separated by prose, so they are not siblings.
 *
 * @param {[alt: string, src: string]} first
 * @param {[alt: string, src: string]} second
 * @param {string} prose
 */
export const twoImages = ([firstAlt, firstSrc], [secondAlt, secondSrc], prose) =>
  [`![${firstAlt}](${firstSrc})`, "", prose, "", `![${secondAlt}](${secondSrc})`, ""].join("\n");
