import "server-only"

export type SniffedImageType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"

const EXTENSION: Record<SniffedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** Identify a raster image from its magic bytes. SVG is deliberately unsupported (it can carry script). */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  const starts = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b)

  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg"
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png"
  if (
    starts([0x47, 0x49, 0x46, 0x38]) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
    return "image/gif"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp"

  return null
}

/**
 * Validate an uploaded file by content (not the client-declared MIME type or
 * filename) and return a copy with a safe, server-chosen name and type, ready
 * to forward to Strapi. Returns null if the bytes are not an allowed image.
 */
export async function toSafeImageFile(
  file: File,
  allowed: readonly SniffedImageType[]
): Promise<File | null> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const type = sniffImageType(buffer)
  if (!type || !allowed.includes(type)) return null

  return new File(
    [buffer],
    `upload-${crypto.randomUUID()}.${EXTENSION[type]}`,
    {
      type,
    }
  )
}
