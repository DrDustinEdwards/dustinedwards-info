/**
 * Minimal readers for the two binary container formats the icon suite ships.
 *
 * Hand-rolled on purpose. The repo carries `image-size`, which answers
 * dimensions and nothing else, and `@resvg/resvg-js`, which ENCODES PNG and
 * cannot decode one. Nothing here needs a decoder in the general sense: the
 * gate asks for a header and for one corner pixel, and both are reachable
 * without decompressing an image.
 *
 * Every function throws rather than returning a sentinel. A gate that receives
 * `null` from a parser and carries on is a gate that passes on a file it could
 * not read, which is the failure mode that looks most like success.
 *
 * These readers are SELF-TESTED by check:logo against files produced by a third
 * party encoder, not against fixtures built with the same assumptions the reader
 * makes. A parser and its test agreeing about a format both got wrong is not
 * evidence.
 */

import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Bytes per pixel at bit depth 8, by PNG colour type. 3 is palette, unsupported.
 * @type {Record<number, number>}
 */
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * @typedef {object} PngHeader
 * @property {number} width
 * @property {number} height
 * @property {number} bitDepth
 * @property {number} colorType
 * @property {number} compression
 * @property {number} filter
 * @property {number} interlace
 */

/**
 * Walks a PNG's chunk list and returns its IHDR fields plus the joined IDAT.
 *
 * @param {Buffer} buf
 * @returns {PngHeader & { idat: Buffer }}
 */
export function readPngChunks(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not a PNG: bad signature");

  let offset = 8;
  /** @type {PngHeader | null} */
  let ihdr = null;
  /** @type {Buffer[]} */
  const idat = [];

  // A chunk is length(4) + type(4) + data(length) + CRC(4).
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (!ihdr) throw new Error("PNG has no IHDR chunk");
  return { ...ihdr, idat: Buffer.concat(idat) };
}

/**
 * The colour of pixel (0, 0), as an uppercase #RRGGBB string.
 *
 * WHY ONLY THE FIRST PIXEL, and why that is exact rather than approximate.
 * A PNG scanline is filtered against its left neighbour and the row above it,
 * so reading an arbitrary pixel means reconstructing every row before it. The
 * FIRST pixel of the FIRST row has neither: there is no prior row and no left
 * neighbour, so all five filter types collapse to the identity there.
 *
 *   None     x
 *   Sub      x + left(0)              = x
 *   Up       x + above(0)             = x
 *   Average  x + floor((0 + 0) / 2)   = x
 *   Paeth    x + Paeth(0, 0, 0) = x + 0
 *
 * So one inflate and three bytes answer it, with no unfiltering loop to get
 * wrong. This is a deliberate limit, not an unfinished decoder: callers that
 * need an interior pixel need a real decoder and should say so.
 *
 * @param {Buffer} buf
 */
export function pngCornerPixel(buf) {
  const png = readPngChunks(buf);
  if (png.bitDepth !== 8) throw new Error(`PNG bit depth ${png.bitDepth} unsupported, need 8`);
  if (png.interlace !== 0) throw new Error("interlaced PNG unsupported");
  const channels = CHANNELS[png.colorType];
  if (!channels) throw new Error(`PNG colour type ${png.colorType} unsupported`);
  if (channels < 3) throw new Error(`PNG colour type ${png.colorType} carries no RGB`);

  const raw = inflateSync(png.idat);
  if (raw.length < 1 + channels) throw new Error("PNG scanline shorter than one pixel");
  const filter = raw[0];
  if (filter > 4) throw new Error(`unknown PNG filter type ${filter}`);

  /** @param {number} n */
  const hex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${hex(raw[1])}${hex(raw[2])}${hex(raw[3])}`;
}

/** @param {Buffer} buf */
export function pngSize(buf) {
  const { width, height } = readPngChunks(buf);
  return { width, height };
}

/**
 * An ICO is a CONTAINER: a directory of independently encoded images.
 *
 * Each ICONDIRENTRY is 16 bytes. A width or height byte of 0 means 256, which
 * is the format's way of fitting 256 into one byte and is the one place a naive
 * reader silently reports the wrong number.
 *
 * @param {Buffer} buf
 * @returns {Array<{ size: number, width: number, height: number, bpp: number, bytes: number, offset: number, encoding: string }>}
 */
export function readIco(buf) {
  if (buf.length < 6) throw new Error("not an ICO: shorter than its header");
  if (buf.readUInt16LE(0) !== 0) throw new Error("not an ICO: reserved field is not zero");
  const type = buf.readUInt16LE(2);
  if (type !== 1) throw new Error(`not an icon: image type ${type} (1 = icon, 2 = cursor)`);
  const count = buf.readUInt16LE(4);
  if (count === 0) throw new Error("ICO declares zero images");

  const out = [];
  for (let i = 0; i < count; i += 1) {
    const o = 6 + i * 16;
    if (o + 16 > buf.length) throw new Error(`ICO entry ${i} runs past the end of the file`);
    const width = buf[o] === 0 ? 256 : buf[o];
    const height = buf[o + 1] === 0 ? 256 : buf[o + 1];
    const bpp = buf.readUInt16LE(o + 6);
    const bytes = buf.readUInt32LE(o + 8);
    const offset = buf.readUInt32LE(o + 12);
    if (offset + bytes > buf.length) {
      throw new Error(`ICO entry ${i} claims ${bytes} bytes at ${offset}, past the end`);
    }
    const payload = buf.subarray(offset, offset + bytes);
    const encoding = payload.subarray(0, 8).equals(PNG_SIGNATURE) ? "PNG" : "BMP";
    out.push({ size: width, width, height, bpp, bytes, offset, encoding });
  }
  return out;
}

/**
 * The payload of one ICO entry, for handing to the PNG readers.
 *
 * @param {Buffer} buf
 * @param {{ offset: number, bytes: number }} entry
 */
export function icoPayload(buf, entry) {
  return buf.subarray(entry.offset, entry.offset + entry.bytes);
}
