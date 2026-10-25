// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import { imageFilename } from "@/lib/image-filename"

import {
  imageCrop,
  imagePreviewUrl,
  prepareArticleImage,
} from "./imagePreparation"

afterEach(() => vi.restoreAllMocks())

describe("article image preparation", () => {
  it("limits local previews to object URLs and encodes HTML metacharacters", () => {
    expect(imagePreviewUrl("blob:https://example.test/image-id")).toBe(
      "blob:https://example.test/image-id"
    )
    expect(imagePreviewUrl('blob:https://example.test/<image>"')).toBe(
      "blob:https://example.test/%3Cimage%3E%22"
    )
    for (const url of [
      // eslint-disable-next-line sonarjs/code-eval -- asserting it is rejected, never executed
      "javascript:alert(1)",
      "data:text/html,<svg>",
      "https://example.test/image",
    ])
      expect(imagePreviewUrl(url)).toBeUndefined()
  })

  it("preserves the original and crops and positions within source bounds", () => {
    const size = { width: 400, height: 200 }
    expect(imageCrop(size, null, 3, { x: 100, y: 0 })).toEqual({
      ...size,
      x: 0,
      y: 0,
    })
    expect(imageCrop(size, 1, 1, { x: 50, y: 50 })).toEqual({
      width: 200,
      height: 200,
      x: 100,
      y: 0,
    })
    expect(imageCrop(size, 1, 2, { x: 100, y: 100 })).toEqual({
      width: 100,
      height: 100,
      x: 300,
      y: 100,
    })
    expect(imageCrop(size, 1, 1, { x: -10, y: 200 })).toEqual({
      width: 200,
      height: 200,
      x: 0,
      y: 0,
    })
  })

  it("keeps a meaningful filename with the actual output extension", () => {
    expect(imageFilename("Reading room.png", "image/webp")).toBe(
      "Reading room.webp"
    )
    expect(imageFilename("../photo<script>", "image/jpeg")).toBe(
      "-photo-script-.jpg"
    )
    expect(imageFilename("...", "image/png")).toBe("image.png")
  })

  it("uses the preview crop for exported pixels and does not enlarge small images", async () => {
    const drawImage = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (callback: BlobCallback) =>
        callback(new Blob(["cropped"], { type: "image/webp" })),
    }
    vi.spyOn(document, "createElement").mockReturnValue(
      canvas as unknown as HTMLCanvasElement
    )
    const image = {} as HTMLImageElement
    const crop = imageCrop({ width: 400, height: 200 }, 1, 1, { x: 100, y: 0 })
    const prepared = await prepareArticleImage(
      new File(["original"], "old.webp", { type: "image/webp" }),
      "Library",
      image,
      crop
    )
    expect(drawImage).toHaveBeenCalledWith(
      image,
      200,
      0,
      200,
      200,
      0,
      0,
      200,
      200
    )
    expect(prepared.name).toBe("Library.webp")
    expect(prepared.size).toBe(7)
  })
})
