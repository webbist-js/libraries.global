import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/about/countries/[slug]/route"

const read = vi.hoisted(() => vi.fn())
vi.mock("@/lib/about-server", () => ({ fetchAboutGlobeRecord: read }))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fr"] },
}))
const request = (slug = "germany", locale = "en") =>
  GET(
    new NextRequest(
      `http://localhost/api/about/countries/${slug}?locale=${locale}`
    ),
    { params: Promise.resolve({ slug }) }
  )
beforeEach(() => vi.clearAllMocks())

describe("About published country endpoint", () => {
  it("rejects malformed slugs and unsupported locales before calling the CMS", async () => {
    expect((await request("../secret")).status).toBe(400)
    expect((await request("germany", "zz")).status).toBe(400)
    expect(read).not.toHaveBeenCalled()
  })
  it("returns the compact country record", async () => {
    read.mockResolvedValue({ libraryCount: 120 })
    const response = await request()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { libraryCount: 120 } })
    expect(read).toHaveBeenCalledWith("germany", "en")
  })
  it("distinguishes missing records from temporarily failed CMS reads", async () => {
    read.mockResolvedValue(null)
    expect((await request()).status).toBe(404)
    read.mockRejectedValue(new Error("private server details"))
    const response = await request()
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain(
      "private server details"
    )
  })
})
