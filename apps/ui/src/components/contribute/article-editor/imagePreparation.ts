import { imageFilename } from "@/lib/image-filename"

export type ImageDimensions = { width: number; height: number }
export type ImagePosition = { x: number; y: number }
export type ImageCrop = ImageDimensions & { x: number; y: number }

export const clampPosition = (value: number) =>
  Math.min(100, Math.max(0, value))

/** Keep local previews on object URLs and escape URL metacharacters. */
export function imagePreviewUrl(url: string): string | undefined {
  return url.startsWith("blob:") ? encodeURI(url) : undefined
}

/** Use the same source rectangle for the preview and the uploaded pixels. */
export function imageCrop(
  size: ImageDimensions,
  aspect: number | null,
  zoom: number,
  position: ImagePosition
): ImageCrop {
  if (aspect === null) return { ...size, x: 0, y: 0 }
  const width = Math.min(size.width, size.height * aspect) / zoom
  const height = width / aspect

  return {
    width,
    height,
    x: (size.width - width) * (clampPosition(position.x) / 100),
    y: (size.height - height) * (clampPosition(position.y) / 100),
  }
}

/** Crop locally; the server still validates, re-encodes and strips metadata. */
export async function prepareArticleImage(
  file: File,
  name: string,
  image: HTMLImageElement,
  crop: ImageCrop | null
): Promise<File> {
  const filename = imageFilename(name, file.type)
  if (!crop) return new File([file], filename, { type: file.type })
  const scale = Math.min(1, 4096 / Math.max(crop.width, crop.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(crop.width * scale))
  canvas.height = Math.max(1, Math.round(crop.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Image canvas unavailable")
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Image encoding failed")),
      file.type,
      0.9
    )
  })

  return new File([blob], imageFilename(name, blob.type), { type: blob.type })
}
