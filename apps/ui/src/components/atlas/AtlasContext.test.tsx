// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import { AtlasContextLegend } from "./AtlasContext"
import { AtlasPopulationDensityControls } from "./AtlasPopulationDensity"

import messages from "../../../locales/en.json"

describe("deprivation classification labels", () => {
  it("shows publisher categories without labelling them deciles", () => {
    const result = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AtlasContextLegend
          theme="deprivation"
          categories={[
            { value: 1, label: "Extremely disadvantaged", color: "#9E3A64" },
            { value: 8, label: "Extremely affluent", color: "#234C79" },
          ]}
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Published deprivation categories")).toBeTruthy()
    expect(screen.getByText("Extremely disadvantaged")).toBeTruthy()
    expect(screen.queryByText("National deprivation deciles")).toBeNull()
    result.unmount()
  })
  it("retains national decile labels for existing releases", () => {
    const result = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AtlasContextLegend theme="deprivation" />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("National deprivation deciles")).toBeTruthy()
    result.unmount()
  })
})

describe("population coverage controls", () => {
  it("offers Ireland's grid without offering unavailable administrative levels", async () => {
    const result = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AtlasPopulationDensityControls
          level="grid"
          onLevel={() => {}}
          opacity={1}
          onOpacity={() => {}}
          country="IE"
          gridAvailable
          administrativeAvailable={false}
        />
      </NextIntlClientProvider>
    )
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" })
    expect(
      (await screen.findByRole("option", { name: "Regions" })).getAttribute(
        "aria-disabled"
      )
    ).toBe("true")
    result.unmount()
  })
})

it("explains an unavailable population level without changing the active layer", async () => {
  const onLevel = vi.fn()
  const onUnavailable = vi.fn()
  const result = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AtlasPopulationDensityControls
        level="grid"
        onLevel={onLevel}
        opacity={1}
        onOpacity={() => {}}
        country="IE"
        gridAvailable
        administrativeAvailable={false}
        onUnavailable={onUnavailable}
      />
    </NextIntlClientProvider>
  )
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" })
  fireEvent.click(await screen.findByRole("option", { name: "Regions" }))
  expect(onUnavailable).toHaveBeenCalledWith("regions")
  expect(onLevel).not.toHaveBeenCalled()
  result.unmount()
})
