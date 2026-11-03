// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import type { AtlasCountryOption } from "@/lib/atlas-countries"
import { cleanup, fireEvent, render, screen } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AtlasCountryPanel } from "../AtlasCountryPanel"

const finland: AtlasCountryOption = {
  documentId: "fin",
  name: "Finland",
  slug: "finland",
  iso2: "FI",
  iso3: "FIN",
  boundary: "FIN",
  continent: "europe",
  libraries: 962,
}
const nation = (slug: string, name: string, libraries: number) => ({
  ...finland,
  documentId: slug,
  slug,
  name,
  iso2: null,
  iso3: null,
  boundary: "GBR",
  libraries,
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("shows a country's numbers, breakdown and sources, and filters on request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        data: {
          ...finland,
          summary: null,
          continent: { name: "Europe", slug: "europe" },
          population: {
            count: 5_622_045,
            year: 2025,
            source: "Statistics Finland",
            sourceUrl: null,
            licence: "CC BY 4.0",
          },
          libraryCount: 962,
          libraryTypeCounts: [
            { type: "Public", count: 712 },
            { type: "Mobile", count: 101 },
          ],
          regionCount: 22,
          regions: [{ name: "Uusimaa", slug: "uusimaa", libraryCount: 196 }],
          sources: [
            {
              key: "kirjastot-fi",
              name: "Kirkanta",
              publisher: "Kirjastot.fi",
              licence: "CC BY 4.0",
              licenceUrl: null,
              sourceUrl: null,
              count: 861,
            },
          ],
          community: 101,
          gaps: { hours: 40 },
        },
      })
    )
  )
  const onShow = vi.fn()
  render(
    <AtlasCountryPanel
      country={finland}
      choices={[]}
      filtered={false}
      onShow={onShow}
      onClearFilter={vi.fn()}
      onPick={vi.fn()}
    />
  )
  expect(await screen.findByText("Kirkanta")).toBeTruthy()
  expect(screen.getByText("17.1")).toBeTruthy()
  expect(
    screen.getByRole("link", { name: "Uusimaa" }).getAttribute("href")
  ).toBe("/europe/finland/uusimaa")
  expect(screen.getByText("Added by contributors")).toBeTruthy()
  expect(screen.getByText("Missing opening hours")).toBeTruthy()
  fireEvent.click(
    screen.getByRole("button", { name: "Show only these libraries" })
  )
  expect(onShow).toHaveBeenCalled()
})

it("asks which country a shared boundary means", () => {
  const onPick = vi.fn()
  render(
    <AtlasCountryPanel
      country={null}
      choices={[
        nation("england", "England", 2964),
        nation("wales", "Wales", 260),
      ]}
      filtered={false}
      onShow={vi.fn()}
      onClearFilter={vi.fn()}
      onPick={onPick}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: /Wales/ }))
  expect(onPick).toHaveBeenCalledWith("wales")
})
