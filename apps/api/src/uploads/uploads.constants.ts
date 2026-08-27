import { join } from 'path';

/**
 * Local default: <cwd>/uploads.
 * On Railway, set UPLOADS_DIR=/data/uploads and mount a Volume at /data/uploads
 * so product images survive redeploys.
 */
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR?.trim() || join(process.cwd(), 'uploads');

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Raster image types only. SVG is deliberately excluded: it is a script-capable
 * document, and anything served back from /static runs on the API origin.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
};

export function isAllowedUploadMime(mimetype: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimetype);
}

/**
 * The stored extension is derived from the accepted MIME type, never from the
 * client-supplied filename, so an uploader cannot choose how the file is later
 * served.
 */
export function extensionForMime(mimetype: string): string {
  return EXTENSION_BY_MIME[mimetype] ?? '.bin';
}
