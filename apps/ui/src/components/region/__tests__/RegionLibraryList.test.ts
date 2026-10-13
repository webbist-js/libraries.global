// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en"] },
  usePathname: () => "/north-america/united-states/new-york",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", props, children),
}))

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href }, children),
  }
})
vi.mock("@/components/location/LocationLibraryCard", async () => {
  const { createElement: h } = await import("react")

  return {
    LocationLibraryCard: ({ library }: { library: { name: string } }) =>
      h("span", null, library.name),
  }
})

const { REGION_LIST_LIMIT, RegionLibraryList } =
  await import("../RegionLibraryList")

afterEach(cleanup)

const libraries = Array.from({ length: 100 }, (_, i) => ({
  documentId: `d${i}`,
  slug: `lib-${i}`,
  name: `Library ${i}`,
}))

describe("RegionLibraryList", () => {
  it("renders the first 24 and links to the rest", () => {
    render(
      createElement(RegionLibraryList, {
        regionName: "New York",
        basePath: "/north-america/united-states/new-york",
        libraries: libraries as never,
        gapsBySlug: {},
        total: 1083,
        findHref: "/libraries?region=new-york",
      })
    )

    expect(REGION_LIST_LIMIT).toBe(24)
    expect(screen.getAllByRole("listitem")).toHaveLength(24)
    expect(
      screen
        .getByRole("link", { name: "Open in the full library index" })
        .getAttribute("href")
    ).toBe("/libraries?region=new-york")
  })
})
