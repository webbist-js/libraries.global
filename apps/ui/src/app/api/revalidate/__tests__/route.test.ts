import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const revalidateTag = vi.fn()
vi.mock("next/cache", () => ({ revalidateTag }))

const { POST } = await import("../route")

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

const SECRET = { "X-Revalidate-Secret": "hook-secret" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("REVALIDATE_SECRET", "hook-secret")
})

afterEach(() => vi.unstubAllEnvs())

describe("POST /api/revalidate", () => {
  it("returns 401 without the secret and revalidates nothing", async () => {
    const res = await post({ model: "library", entry: { slug: "x" } })

    expect(res.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("returns 401 for a wrong secret", async () => {
    const res = await post(
      { model: "library", entry: { slug: "x" } },
      { "X-Revalidate-Secret": "nope" }
    )

    expect(res.status).toBe(401)
  })

  it("returns 503 when no secret is configured, whatever is sent", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "")

    const res = await post({ model: "library" }, { "X-Revalidate-Secret": "" })

    expect(res.status).toBe(503)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("purges the model tag and the entry tag from a Strapi webhook body", async () => {
    const res = await post(
      {
        event: "entry.update",
        model: "library",
        uid: "api::library.library",
        entry: { id: 1, slug: "british-library", name: "British Library" },
      },
      SECRET
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      revalidated: [
        "library",
        "blog-article",
        "wiki-article",
        "library:british-library",
      ],
    })
    expect(revalidateTag).toHaveBeenCalledWith("library", "max")
    expect(revalidateTag).toHaveBeenCalledWith("library:british-library", "max")
  })

  it("purges only the model tag when the entry has no slug", async () => {
    const res = await post({ model: "homepage", entry: { id: 1 } }, SECRET)

    expect(await res.json()).toEqual({ revalidated: ["homepage"] })
  })

  it("ignores a slug that isn't a slug", async () => {
    const res = await post(
      { model: "library", entry: { slug: "../x y" } },
      SECRET
    )

    expect(await res.json()).toEqual({
      revalidated: ["library", "blog-article", "wiki-article"],
    })
  })

  it("returns 400 for an unknown model or a body that isn't JSON", async () => {
    expect((await post({ model: "unknown-model" }, SECRET)).status).toBe(400)
    expect((await post({ entry: {} }, SECRET)).status).toBe(400)
    expect((await post("nope", SECRET)).status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it("expires article attribution immediately after a profile visibility change", async () => {
    const response = await post({ model: "user-profile" }, SECRET)
    expect(response.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith("blog-article", { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith("wiki-article", { expire: 0 })
  })
})
