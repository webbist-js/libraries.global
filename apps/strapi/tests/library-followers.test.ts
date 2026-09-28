import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import controller from "../src/api/library/controllers/library-followers"

const PROFILE = "api::user-profile.user-profile"
const LIBRARY = "api::library.library"
const DOC_ID = "li3iupdwjpxlpq6pg6pgk4b3"

function ctx(documentId: string) {
  const c: any = {
    params: { documentId },
    headers: {} as Record<string, string>,
    set: (k: string, v: string) => (c.headers[k] = v),
    send: (b: unknown) => (c.body = b),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
    notFound: (m: string) => ((c.status = 404), (c.body = m)),
  }

  return c
}

describe("library followers", () => {
  let count: ReturnType<typeof vi.fn>
  let findOne: ReturnType<typeof vi.fn>

  beforeEach(() => {
    count = vi.fn(async () => 3)
    findOne = vi.fn(async ({ documentId }: { documentId: string }) =>
      documentId === DOC_ID ? { documentId } : null
    )
    ;(globalThis as any).strapi = {
      documents: vi.fn((uid: string) =>
        uid === PROFILE ? { count } : uid === LIBRARY ? { findOne } : {}
      ),
    }
  })

  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("counts the profiles that follow the library, by documentId", async () => {
    const c = ctx(DOC_ID)
    await controller.count(c)

    expect(c.body).toEqual({ data: { documentId: DOC_ID, followers: 3 } })
    expect(count).toHaveBeenCalledWith({
      filters: { followedLibraries: { documentId: { $eq: DOC_ID } } },
    })
    expect(c.headers["Cache-Control"]).toMatch(/max-age=\d+/)
  })

  it("rejects ids that aren't documentIds", async () => {
    const c = ctx("1 OR 1=1")
    await controller.count(c)

    expect(c.status).toBe(400)
    expect(count).not.toHaveBeenCalled()
  })

  it("is not found for an unpublished or missing library", async () => {
    const c = ctx("zzzzzzzzzzzzzzzzzzzzzzzz")
    await controller.count(c)

    expect(c.status).toBe(404)
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" })
    )
    expect(count).not.toHaveBeenCalled()
  })
})
