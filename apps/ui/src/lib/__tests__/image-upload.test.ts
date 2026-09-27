import sharp from "sharp"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { sniffImageType, toSafeImageFile } from "../image-upload"

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const GIF = new TextEncoder().encode("GIF89a....")
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
])
const HTML = new TextEncoder().encode("<html><script>alert(1)</script>")
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"/>'
)

describe("sniffImageType", () => {
  it.each([
    [PNG, "image/png"],
    [JPEG, "image/jpeg"],
    [GIF, "image/gif"],
    [WEBP, "image/webp"],
  ])("detects %#", (bytes, type) => {
    expect(sniffImageType(bytes)).toBe(type)
  })

  it("rejects HTML and SVG regardless of declared type", () => {
    expect(sniffImageType(HTML)).toBeNull()
    expect(sniffImageType(SVG)).toBeNull()
  })
})

const blank = () =>
  sharp({
    create: { width: 4, height: 4, channels: 3, background: "#ffffff" },
  })

async function metadataOf(file: File) {
  return sharp(Buffer.from(await file.arrayBuffer())).metadata()
}

describe("toSafeImageFile", () => {
  it("rewrites the name and type from the content", async () => {
    const png = await blank().png().toBuffer()
    const file = new File([new Uint8Array(png)], "evil.html", {
      type: "image/png",
    })
    const safe = await toSafeImageFile(file, ["image/png"])
    expect(safe?.type).toBe("image/png")
    expect(safe?.name).toMatch(/^upload-[\da-f-]+\.png$/)
  })

  it("strips EXIF metadata such as location from photos", async () => {
    const jpeg = await blank()
      .jpeg()
      .withExif({ IFD0: { Copyright: "Alice", Artist: "Alice" } })
      .toBuffer()
    expect((await sharp(jpeg).metadata()).exif).toBeDefined()

    const safe = await toSafeImageFile(
      new File([new Uint8Array(jpeg)], "photo.jpg", { type: "image/jpeg" }),
      ["image/jpeg"]
    )
    expect(safe?.type).toBe("image/jpeg")
    expect((await metadataOf(safe!)).exif).toBeUndefined()
  })

  it("rejects a file that looks like an image but can't be decoded", async () => {
    const file = new File([PNG], "x.png", { type: "image/png" })
    expect(await toSafeImageFile(file, ["image/png"])).toBeNull()
  })

  it("rejects HTML disguised as PNG", async () => {
    const file = new File([HTML], "x.png", { type: "image/png" })
    expect(await toSafeImageFile(file, ["image/png"])).toBeNull()
  })

  it("rejects allowed-format images outside the allowlist", async () => {
    const file = new File([GIF], "x.gif", { type: "image/gif" })
    expect(await toSafeImageFile(file, ["image/png"])).toBeNull()
  })
})
