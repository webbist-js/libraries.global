// @vitest-environment happy-dom
import type { AtlasNetworkReachResult } from "@repo/shared-data"
import { NextIntlClientProvider } from "next-intl"
import { useState, type ReactNode } from "react"
import { afterEach, expect, it } from "vitest"

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@/test/render"

import { atlasAnalysisDrawers } from "../atlas-analysis-panels"
import { AtlasInspect, AtlasInspectTools } from "../AtlasInspect"
import {
  useAtlasDrawerSummaries,
  type AtlasDrawerSummaryInput,
} from "../useAtlasDrawerSummaries"

import messages from "../../../../locales/en.json"

afterEach(cleanup)
const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    {children}
  </NextIntlClientProvider>
)

it("switches between one About or Download panel, with explicit close and focus restoration", async () => {
  render(
    <AtlasInspectTools
      action={<button type="button">Update coverage</button>}
      about={<p>Population and routing sources.</p>}
      downloads={<button type="button">Download CSV</button>}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "About" }))
  expect(screen.getByRole("dialog", { name: "About" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Download" }))
  expect(screen.getAllByRole("dialog")).toHaveLength(1)
  expect(screen.getByRole("dialog", { name: "Download" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Close Download" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Download" })
  )
  expect(screen.getByRole("button", { name: "Update coverage" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "About" }))
  fireEvent.click(screen.getByRole("button", { name: "About" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})
const input = (): AtlasDrawerSummaryInput => ({
  reach: {
    scope: "network",
    mode: "walking",
    minutes: 15,
    result: null,
    state: "ready",
    stale: false,
  },
  network: {
    selection: {
      documentId: "one",
      name: "Cardiff Library Service",
      kind: "library_service",
      areaName: "Cardiff",
      areaCodes: ["W06000015"],
      eligibleLibraries: 19,
      excludedLibraries: 0,
      available: true,
      bounds: null,
      countries: [],
    },
    result: {
      networkId: "one",
      state: "ready",
      totalResidents: 370755,
      population: { year: 2020, sourceUrl: "https://example.test/population" },
      contours: [{ minutes: 15, percent: 4.4, residents: 16220 }],
    } as AtlasNetworkReachResult,
  },
  population: {
    grid: {
      id: "population-gb",
      theme: "population",
      country: "GB",
      name: "United Kingdom",
      edition: "GHS-POP 2020",
      year: 2020,
      sourceUrl: "https://example.test/population",
      source: "JRC",
      licence: "CC BY 4.0",
      attribution: "JRC",
      boundary: "100 m cells",
      bounds: { west: -9, east: 3, south: 49, north: 61 },
      note: "",
    },
    level: "grid",
    country: "GB",
  },
  context: { release: null },
  accessibility: {
    selected: ["Step-free access"],
    coverage: { total: 9, matches: 6, partial: 0, unconfirmed: 3 },
    inView: true,
  },
  libraryAccess: { response: null, selected: null, metric: "per100k" },
})

it("labels the reporting population separately from the current-view accessibility count", () => {
  const hook = renderHook(() => useAtlasDrawerSummaries(input()), { wrapper })
  expect(hook.result.current.population).toEqual({
    detail: "2020 grid · Cardiff",
    metric: "370,755",
  })
  expect(hook.result.current.accessibility).toEqual({
    detail: "Step-free access · Libraries in view",
    metric: "6 of 9",
  })
  expect(hook.result.current.reach.metric).toBe("4.4%")
})

it("withholds a service population when the visible grid has another year or source", () => {
  const value = input()
  const hook = renderHook(({ value }) => useAtlasDrawerSummaries(value), {
    wrapper,
    initialProps: { value },
  })
  hook.rerender({
    value: {
      ...value,
      population: {
        ...value.population,
        grid: { ...value.population.grid!, year: 2024 },
      },
    },
  })
  expect(hook.result.current.population.metric).toBeUndefined()
  hook.rerender({
    value: {
      ...value,
      population: {
        ...value.population,
        grid: {
          ...value.population.grid!,
          sourceUrl: "https://example.test/another-source",
        },
      },
    },
  })
  expect(hook.result.current.population.metric).toBeUndefined()
})

it("keeps missing and stale reach unknown while preserving a sourced zero", () => {
  const value = input()
  value.network.result = {
    ...value.network.result!,
    state: "partial",
    totalResidents: null,
  }
  value.accessibility.coverage = {
    total: 9,
    matches: 0,
    partial: 0,
    unconfirmed: 9,
  }
  const hook = renderHook(({ value }) => useAtlasDrawerSummaries(value), {
    wrapper,
    initialProps: { value },
  })
  expect(hook.result.current.reach.metric).toBe("Incomplete")
  expect(hook.result.current.population.metric).toBeUndefined()
  expect(hook.result.current.accessibility.metric).toBe("0 of 9")
  hook.rerender({ value: { ...value, reach: { ...value.reach, stale: true } } })
  expect(hook.result.current.reach.metric).toBe("Update needed")
})

it("preserves panel state across tabs and minimising, and exposes only the active footer", async () => {
  function Panel({ name }: { name: string }) {
    const [value, setValue] = useState("")

    return (
      <>
        <input
          aria-label={`${name} setting`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <AtlasInspectTools about={<p>{name} method</p>} />
      </>
    )
  }
  function Fixture() {
    const [active, setActive] = useState("reach")
    const [minimised, setMinimised] = useState(false)
    const summaries = useAtlasDrawerSummaries(input())

    return (
      <AtlasInspect
        entries={atlasAnalysisDrawers(["reach", "population", "access"]).map(
          ({ mode, layer }) => ({
            id: mode,
            layer,
            label: mode,
            title: mode,
            detail: summaries[mode].detail,
            metric: summaries[mode].metric,
            content: <Panel name={mode} />,
          })
        )}
        active={active}
        minimised={minimised}
        onSelect={(value) => {
          setActive(value)
          setMinimised(false)
        }}
        onMinimise={() => setMinimised(true)}
        onRemove={() => {}}
      />
    )
  }
  render(<Fixture />)
  fireEvent.change(screen.getByRole("textbox", { name: "reach setting" }), {
    target: { value: "Keep this setting" },
  })
  fireEvent.click(screen.getByRole("tab", { name: "population" }))
  expect(screen.queryByRole("textbox", { name: "reach setting" })).toBeNull()
  expect(screen.getAllByRole("button", { name: "About" })).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Minimise Inspect" }))
  expect(screen.queryByRole("textbox")).toBeNull()
  expect(screen.queryByRole("button", { name: "About" })).toBeNull()
  expect(
    screen.getByRole("navigation", { name: "Minimised Inspect" })
  ).toBeTruthy()
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Open reach" }))
  )
  expect(
    (screen.getByRole("textbox", { name: "reach setting" }) as HTMLInputElement)
      .value
  ).toBe("Keep this setting")
  fireEvent.keyDown(screen.getByRole("tab", { name: "reach" }), { key: "End" })
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "accessibility" })
  )
  expect(
    screen
      .getByRole("tab", { name: "accessibility" })
      .getAttribute("aria-selected")
  ).toBe("true")
})

it("keeps focus in Explore when opening it minimises Inspect", () => {
  function Fixture({ minimised }: { minimised: boolean }) {
    return (
      <>
        <button type="button">Explore layers</button>
        <AtlasInspect
          entries={[
            {
              id: "reach",
              label: "Reach",
              title: "Service reach",
              detail: "Cardiff",
              content: <p>Coverage</p>,
            },
          ]}
          active="reach"
          minimised={minimised}
          onSelect={() => {}}
          onMinimise={() => {}}
          onRemove={() => {}}
        />
      </>
    )
  }
  const view = render(<Fixture minimised={false} />)
  const explore = screen.getByRole("button", { name: "Explore layers" })
  explore.focus()
  view.rerender(<Fixture minimised />)
  expect(document.activeElement).toBe(explore)
})
