import {OperationError} from './operations-types';

/** Enforce byte limits while reading, including requests without Content-Length. */
export async function limitedBody(request: Request, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length') || 0) > maximum) throw new OperationError('TOO_LARGE', 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maximum) {await reader.cancel(); throw new OperationError('TOO_LARGE', 413);}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  return bytes;
}

export function verifiedFileMime(bytes: Uint8Array, name: string): string | null {
  if (bytes.length < 8) return null;
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (!starts(0x50, 0x4b) || !name.toLowerCase().endsWith('.xlsx')) return null;
  // Inspect ZIP directory records without decompressing. An arbitrary ZIP renamed
  // to .xlsx, encrypted members, path traversal, and oversized expanded archives fail.
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (data.getUint32(offset, true) === 0x06054b50) {end = offset; break;}
  }
  if (end < 0) return null;
  const count = data.getUint16(end + 10, true), directorySize = data.getUint32(end + 12, true);
  let offset = data.getUint32(end + 16, true), expanded = 0;
  if (!count || count > 2000 || offset + directorySize > end) return null;
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || data.getUint32(offset, true) !== 0x02014b50) return null;
    const flags = data.getUint16(offset + 8, true), length = data.getUint16(offset + 28, true);
    const extra = data.getUint16(offset + 30, true), comment = data.getUint16(offset + 32, true);
    const next = offset + 46 + length + extra + comment;
    if (flags & 1 || length > 512 || next > end) return null;
    const entry = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length));
    if (entry.startsWith('/') || entry.includes('\\') || entry.split('/').includes('..')) return null;
    expanded += data.getUint32(offset + 24, true);
    if (expanded > 100 * 1024 * 1024) return null;
    names.add(entry); offset = next;
  }
  return names.has('[Content_Types].xml') && names.has('xl/workbook.xml')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : null;
}
