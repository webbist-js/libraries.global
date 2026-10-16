import { NextRequest } from "next/server"
import createMiddleware from "next-intl/middleware"
import { expect, it, vi } from "vitest"

import { getPathname, routing } from "@/lib/navigation"

vi.mock("@/lib/env-vars", () => ({ getEnvVar: vi.fn() }))

const middleware = createMiddleware(routing)
const request = (path: string, locale: string) =>
  new NextRequest(`https://libraries.global${path}`, {
    headers: { cookie: `NEXT_LOCALE=${locale}`, "accept-language": "fr" },
  })

it.each(["cs", "fr"])(
  "replaces a saved %s preference before returning to unprefixed English",
  (previousLocale) => {
    const target = getPathname({ href: "/", locale: "en", forcePrefix: true })
    const switched = middleware(request(target, previousLocale))
    expect(switched.cookies.get("NEXT_LOCALE")?.value).toBe("en")
    expect(switched.headers.get("location")).toBe("https://libraries.global/")

    for (const path of ["/", "/journal", "/knowledge"]) {
      const response = middleware(request(path, "en"))
      expect(response.headers.get("location")).toBeNull()
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        `https://libraries.global/en${path === "/" ? "" : path}`
      )
    }
  }
)

it.each(["cs", "fr"] as const)(
  "establishes the selected %s preference on a filtered page",
  (locale) => {
    const target = getPathname({
      href: "/journal?view=list&section=data",
      locale,
      forcePrefix: true,
    })
    const response = middleware(request(target, "en"))
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe(locale)
    expect(response.headers.get("location")).toBeNull()
    expect(
      response.headers.get("x-middleware-request-x-next-intl-locale")
    ).toBe(locale)
  }
)
