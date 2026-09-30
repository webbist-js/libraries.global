import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "http://strapi.test",
}))

const { formatStrapiMediaUrlForClient } = await import("../strapi-helpers")

describe("formatStrapiMediaUrlForClient", () => {
  it("routes a local upload through the asset proxy, never STRAPI_URL", () => {
    expect(formatStrapiMediaUrlForClient("/uploads/photo_abc.png")).toBe(
      "/api/asset/uploads/photo_abc.png"
    )
  })

  it("leaves CDN URLs alone", () => {
    expect(
      formatStrapiMediaUrlForClient("https://cdn.example.org/photo.png")
    ).toBe("https://cdn.example.org/photo.png")
  })

  it("returns undefined for nothing", () => {
    expect(formatStrapiMediaUrlForClient(null)).toBeUndefined()
    expect(formatStrapiMediaUrlForClient("")).toBeUndefined()
  })
})
