import { decode } from 'fast-png';

export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_PIXELS = 4_000_000;
export const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
export type Scheme = 'RGB' | 'R' | 'G' | 'B';
export interface Candidate { offset: number; length: number; bytes?: Uint8Array; width?: number; height?: number; text?: Record<string, string>; status: string; valid: boolean }
const ascii = new TextDecoder('latin1');
const fail = (message: string): never => { throw new Error(message); };
export function checkSize(bytes: Uint8Array) {
  if (!bytes.length) fail('This file is empty.');
  if (bytes.length > MAX_BYTES) fail('File exceeds the 8 MB limit.');
}
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function hasSignature(bytes: Uint8Array, offset = 0) { return SIGNATURE.every((b, i) => bytes[offset + i] === b); }

/** Walk declared chunk boundaries; never search for an arbitrary IEND string. */
export function inspectPng(bytes: Uint8Array, start = 0) {
  if (!hasSignature(bytes, start)) fail('No PNG signature at this offset.');
  let cursor = start + 8, width = 0, height = 0, channels = 0, idat = false, idatClosed = false;
  const metadata: Record<string, string> = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let chunks = 0;
  while (cursor < bytes.length) {
    if (++chunks > 4096) fail('Too many PNG chunks.');
    if (cursor + 12 > bytes.length) fail('Truncated PNG: missing chunk header or CRC.');
    const length = view.getUint32(cursor);
    if (length > bytes.length - cursor - 12) fail('Truncated PNG or invalid declared chunk length.');
    const type = ascii.decode(bytes.subarray(cursor + 4, cursor + 8));
    if (!/^[A-Za-z]{4}$/.test(type)) fail('Invalid PNG chunk type.');
    const data = cursor + 8, end = data + length;
    if (crc32(bytes.subarray(cursor + 4, end)) !== view.getUint32(end)) fail(`Bad CRC in ${type} chunk; candidate rejected.`);
    if (cursor === start + 8 && type !== 'IHDR') fail('PNG must begin with IHDR.');
    if (type === 'IHDR') {
      if (cursor !== start + 8 || length !== 13) fail('Invalid or repeated IHDR.');
      width = view.getUint32(data); height = view.getUint32(data + 4);
      if (!width || !height || width * height > MAX_PIXELS) fail('Image exceeds the four-million-pixel limit, or has invalid dimensions.');
      if (bytes[data + 8] !== 8 || ![2, 6].includes(bytes[data + 9])) fail('Unsupported PNG: use 8-bit RGB or RGBA.');
      if (bytes[data + 10] !== 0 || bytes[data + 11] !== 0 || bytes[data + 12] !== 0) fail('Unsupported PNG compression, filter, or interlacing. Use a non-interlaced PNG.');
      channels = bytes[data + 9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      if (idatClosed) fail('PNG image chunks must be consecutive.');
      idat = true;
    } else {
      if (idat) idatClosed = true;
      if (type === 'tEXt' && length <= 8192) {
        const field = bytes.subarray(data, end), split = field.indexOf(0);
        if (split > 0 && split < 80) metadata[ascii.decode(field.subarray(0, split))] = ascii.decode(field.subarray(split + 1));
      }
      if (type === 'IEND') {
        if (length !== 0 || !idat) fail('Invalid IEND or missing image data.');
        return { width, height, channels, length: end + 4 - start, text: metadata };
      }
      if (type !== 'IHDR' && type !== 'PLTE' && /^[A-Z]/.test(type)) fail(`Unsupported critical PNG chunk: ${type}.`);
      if (type === 'acTL') fail('Animated PNGs are not supported.');
    }
    cursor = end + 4;
  }
  return fail('Truncated PNG: no complete IEND chunk.');
}
export function decodePng(bytes: Uint8Array) {
  checkSize(bytes);
  const info = inspectPng(bytes);
  const pixels = decode(bytes.subarray(0, info.length), { checkCrc: true });
  if (pixels.data.length !== info.width * info.height * info.channels) fail('Decoded pixel length does not match IHDR.');
  return { ...info, data: new Uint8Array(pixels.data) };
}
export function carvePng(bytes: Uint8Array): Candidate[] {
  checkSize(bytes);
  const candidates: Candidate[] = [];
  let totalPixels = 0;
  for (let offset = 0; offset <= bytes.length - 8; offset++) {
    if (!hasSignature(bytes, offset)) continue;
    if (candidates.length >= 64) fail('Scan limit reached: more than 64 PNG signatures. Try a smaller input.');
    try {
      const info = inspectPng(bytes, offset);
      totalPixels += info.width * info.height;
      if (totalPixels > 16_000_000) fail('Decoded-image budget reached. Split this recorder into smaller inputs.');
      const original = bytes.slice(offset, offset + info.length);
      decodePng(original);
      candidates.push({ offset, ...info, bytes: original, valid: true, status: 'Complete PNG · CRC verified' });
      offset += info.length - 1;
    } catch (error) {
      candidates.push({ offset, length: 0, valid: false, status: error instanceof Error ? error.message : 'Invalid PNG.' });
    }
  }
  return candidates;
}
const components = (scheme: Scheme) => scheme === 'RGB' ? [0, 1, 2] : [{ R: 0, G: 1, B: 2 }[scheme]];
export function decodeStationLsb(bytes: Uint8Array, scheme: Scheme = 'RGB') {
  const png = decodePng(bytes), selected = components(scheme);
  const capacity = Math.floor(png.width * png.height * selected.length / 8);
  const readByte = (index: number) => {
    let value = 0;
    for (let bit = index * 8; bit < index * 8 + 8; bit++) {
      const pixel = Math.floor(bit / selected.length), channel = selected[bit % selected.length];
      value = (value << 1) | (png.data[pixel * png.channels + channel] & 1);
    }
    return value;
  };
  const empty = { found: false, message: '', status: `No supported payload found in ${scheme} mode. Other hidden information may still exist.` };
  if (capacity < 8 || Array.from('P9LSB1').some((c, i) => readByte(i) !== c.charCodeAt(0))) return empty;
  const length = (readByte(6) << 8) | readByte(7);
  if (length > capacity - 8) return { ...empty, status: 'P9LSB1 header found, but its declared payload length exceeds image capacity.' };
  try {
    const message = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from({ length }, (_, i) => readByte(i + 8)));
    return { found: true, message, status: `P9LSB1 · ${length} UTF-8 bytes · ${scheme} channel scheme` };
  } catch { return { ...empty, status: 'P9LSB1 header found, but the payload is not valid UTF-8.' }; }
}
export function encodeStationLsb(data: Uint8Array, channels: number, message: string, scheme: Scheme = 'RGB') {
  const body = new TextEncoder().encode(message), selected = components(scheme);
  const frame = new Uint8Array(8 + body.length);
  if (body.length > 65535 || frame.length * 8 > data.length / channels * selected.length) fail('Message exceeds image capacity.');
  frame.set(new TextEncoder().encode('P9LSB1'));
  frame[6] = body.length >> 8; frame[7] = body.length & 255; frame.set(body, 8);
  const result = data.slice();
  for (let bit = 0; bit < frame.length * 8; bit++) {
    const index = Math.floor(bit / selected.length) * channels + selected[bit % selected.length];
    result[index] = (result[index] & 254) | ((frame[bit >> 3] >> (7 - bit % 8)) & 1);
  }
  return result;
}
export async function sha256(bytes: Uint8Array) {
  checkSize(bytes);
  if (!globalThis.crypto?.subtle) fail('SHA-256 requires HTTPS or a localhost preview.');
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function compareHashes(a: Uint8Array, b: Uint8Array) {
  const [hashA, hashB] = await Promise.all([sha256(a), sha256(b)]);
  return { hashA, hashB, identical: a.length === b.length && hashA === hashB, sizeA: a.length, sizeB: b.length };
}
