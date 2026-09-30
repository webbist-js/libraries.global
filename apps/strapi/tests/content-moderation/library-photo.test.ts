import { describe, expect, it, vi } from "vitest"

import {
  applyLibraryPhoto,
  isPhotoCorrection,
  photoCaption,
} from "../../src/plugins/content-moderation/server/utils/library-photo"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const ID = "lib00000000000000000001"

function harness(library: Record<string, unknown>) {
  const made = makeFakeStrapi({
    [LIBRARY]: [
      { documentId: ID, slug: "abronhill-library", locale: "en", ...library },
    ],
  })
  const perUid = new Map<string, any>()
  const fresh = made.strapi.documents
  made.strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })
  const updateFileInfo = vi.fn(async () => ({}))
  ;(made.strapi as any).plugin = vi.fn(() => ({
    service: () => ({ updateFileInfo }),
  }))

  return { ...made, updateFileInfo }
}

const photo = (photoId: unknown) => ({
  documentId: "s1",
  targetSlug: "abronhill-library",
  fields: {
    kind: "photo",
    photoId,
    photoUrl: "/uploads/x.jpg",
    credit: "Janet B",
    licence: "CC BY-SA 4.0",
  },
})

describe("applyLibraryPhoto", () => {
  it("makes the photo the main image when the library has none", async () => {
    const { strapi, updateFileInfo } = harness({ heroImage: null })
    expect(await applyLibraryPhoto(strapi, photo(18), new Set([18]))).toBe(
      "applied"
    )
    const call = strapi.documents(LIBRARY).update.mock.calls[0]?.[0]
    expect(call.data.heroImage).toEqual({ set: [{ id: 18 }] })
    expect(call.status).toBe("published")
    expect(updateFileInfo).toHaveBeenCalledWith(18, {
      caption: "Photo: Janet B · CC BY-SA 4.0",
    })
  })

  it("adds it to the gallery when there's already a main image", async () => {
    const { strapi } = harness({ heroImage: { id: 3 } })
    await applyLibraryPhoto(strapi, photo(18), new Set([18]))
    const call = strapi.documents(LIBRARY).update.mock.calls[0]?.[0]
    expect(call.data.gallery).toEqual({ connect: [{ id: 18 }] })
    expect(call.data.heroImage).toBeUndefined()
  })

  it("ignores a file the submitter didn't upload", async () => {
    const { strapi } = harness({ heroImage: null })
    expect(await applyLibraryPhoto(strapi, photo(99), new Set([18]))).toBe(
      "noop"
    )
    expect(await applyLibraryPhoto(strapi, photo("x"), new Set([18]))).toBe(
      "noop"
    )
    expect(strapi.documents(LIBRARY).update).not.toHaveBeenCalled()
  })
})

describe("photo helpers", () => {
  it("recognises photo corrections and builds the caption", () => {
    expect(isPhotoCorrection({ kind: "photo" })).toBe(true)
    expect(isPhotoCorrection({ kind: "record" })).toBe(false)
    expect(photoCaption({ licence: "CC BY-SA 4.0" })).toBe("CC BY-SA 4.0")
    expect(photoCaption({})).toBeNull()
  })
})
