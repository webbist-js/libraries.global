import { NextRequest, NextResponse } from "next/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["cs", "en"], defaultLocale: "en" },
}))

const { staffPath, staffPathnameRequest, staffIndexingResponse } =
  await import("../staffPathname")

const ID = "central-library"

describe("staffPath", () => {
  it("strips the locale from a staff page's path", () => {
    expect(staffPath(`/en/staff/${ID}/notices`)).toBe(`/staff/${ID}/notices`)
    expect(staffPath(`/cs/staff/${ID}`)).toBe(`/staff/${ID}`)
    expect(staffPath("/en/staff")).toBe("/staff")
  })

  it("keeps a path that has no locale prefix", () => {
    expect(staffPath(`/staff/${ID}/team`)).toBe(`/staff/${ID}/team`)
    expect(staffPath("/staff")).toBe("/staff")
  })

  it("is null for anything outside the staff section", () => {
    expect(staffPath("/en/contribute/moderation")).toBeNull()
    expect(staffPath("/staffing")).toBeNull()
    expect(staffPath("/en/staffing/x")).toBeNull()
    expect(staffPath("/en")).toBeNull()
    expect(staffPath("/")).toBeNull()
    // Only a real locale is a prefix.
    expect(staffPath("/fr/staff")).toBeNull()
  })
})

describe("staffPathnameRequest", () => {
  const request = (path: string, headers?: Record<string, string>) =>
    new NextRequest(`http://localhost${path}`, { headers })

  it("sets x-pathname to the locale-stripped staff path", () => {
    const out = staffPathnameRequest(request(`/en/staff/${ID}/live`))
    expect(out.headers.get("x-pathname")).toBe(`/staff/${ID}/live`)
  })

  it("keeps the query string on a staff deep link", () => {
    const out = staffPathnameRequest(request(`/cs/staff/${ID}/edit?step=hours`))
    expect(out.headers.get("x-pathname")).toBe(`/staff/${ID}/edit?step=hours`)
  })

  it("drops an incoming x-pathname: only the proxy sets it", () => {
    const spoofed = staffPathnameRequest(
      request(`/en/staff/${ID}`, { "x-pathname": `/staff/${ID}/team` })
    )
    expect(spoofed.headers.get("x-pathname")).toBe(`/staff/${ID}`)
    const elsewhere = staffPathnameRequest(
      request("/en/contribute", { "x-pathname": `/staff/${ID}` })
    )
    expect(elsewhere.headers.has("x-pathname")).toBe(false)
  })

  it("leaves a non-staff request untouched", () => {
    const req = request("/en/libraries")
    expect(staffPathnameRequest(req)).toBe(req)
    expect(req.headers.has("x-pathname")).toBe(false)
  })
})

describe("staff indexing responses", () => {
  it.each(["/staff", `/staff/${ID}/edit`, `/cs/staff/${ID}/team`])(
    "adds noindex on normal and denied responses for %s",
    (path) => {
      const req = new NextRequest(`http://localhost${path}`)
      for (const response of [
        NextResponse.next(),
        new NextResponse(null, { status: 404 }),
        NextResponse.redirect(new URL("/auth/signin", req.url)),
      ]) {
        expect(
          staffIndexingResponse(req, response).headers.get("X-Robots-Tag")
        ).toBe("noindex, nofollow")
        expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      }
    }
  )

  it("leaves public and API responses alone", () => {
    for (const path of [
      "/libraries",
      "/staffing",
      "/api/staff/internal-id/overview",
    ]) {
      const response = staffIndexingResponse(
        new NextRequest(`http://localhost${path}`),
        NextResponse.next()
      )
      expect(response.headers.has("X-Robots-Tag")).toBe(false)
    }
  })
})
