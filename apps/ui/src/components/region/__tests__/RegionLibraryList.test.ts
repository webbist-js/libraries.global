// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

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
        .getByRole("link", { name: "See all 1,083 libraries in New York" })
        .getAttribute("href")
    ).toBe("/libraries?region=new-york")
  })
})
