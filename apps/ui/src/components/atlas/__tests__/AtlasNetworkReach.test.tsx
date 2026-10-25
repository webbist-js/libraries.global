// @vitest-environment happy-dom
import {
  emptyAtlasFilters,
  type AtlasNetworkReachResult,
} from "@repo/shared-data"
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  act,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, expect, it, vi } from "vitest"

import { AtlasNetworkReach, useNetworkReach } from "../AtlasNetworkReach"

import messages from "../../../../locales/en.json"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const draft = {
  schemaVersion: 1 as const,
  networkId: "one",
  areaCode: "E06000016",
  mode: "walking" as const,
  scope: {
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" as const },
  },
}

const selection = {
  documentId: "one",
  name: "Wirral Library Service",
  kind: "library_service",
  bounds: { west: -3.2, east: -3, south: 53.3, north: 53.5 },
  areaCodes: ["E08000015"],
  areaName: "Wirral",
  eligibleLibraries: 13,
  excludedLibraries: 11,
  available: true,
  countries: [],
}

it("keeps service controls and Update coverage available when a completed calculation changes", () => {
  const calculate = vi.fn()
  const ready: AtlasNetworkReachResult = {
    schemaVersion: 1,
    state: "ready",
    kind: "network",
    networkId: "one",
    networkName: "Wirral Library Service",
    libraryId: "network-one",
    coordinateHash: "a".repeat(16),
    calculatedAt: "2026-10-25T00:00:00Z",
    method: "network-union",
    snapDistanceMetres: 0,
    areaCode: "E08000015",
    mode: "walking",
    selectionHash: "a".repeat(16),
    selectedLibraries: 13,
    excludedLibraries: 0,
    unavailableLibraries: 0,
    totalResidents: 10000,
    population: {
      year: 2020,
      source: "Population grid",
      sourceUrl: "https://example.test/population",
      release: "test",
      licence: "CC BY 4.0",
    },
    network: {
      source: "OSM",
      sourceUrl: "https://example.test/network",
      release: "network-test",
      licence: "ODbL",
    },
    warnings: [],
    contours: ([5, 10, 15, 30] as const).map((minutes) => ({
      minutes,
      residents: minutes * 100,
      outsideResidents: 10000 - minutes * 100,
      percent: minutes,
      coveredFraction: 1,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-3.2, 53.3],
            [-3, 53.3],
            [-3, 53.5],
            [-3.2, 53.3],
          ],
        ],
      },
    })),
  }
  const view = (response: AtlasNetworkReachResult) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AtlasNetworkReach
        selection={selection}
        retrySelection={vi.fn()}
        networkId="one"
        onNetwork={vi.fn()}
        minutes={15}
        onMinutes={vi.fn()}
        mode="walking"
        onMode={vi.fn()}
        response={response}
        calculate={calculate}
        canExport={false}
        gaps={false}
        onGaps={vi.fn()}
        filterCount={0}
        onClearFilters={vi.fn()}
      />
    </NextIntlClientProvider>
  )
  const rendered = render(view(ready))
  expect(screen.getByRole("radio", { name: "Walking" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Update coverage" })).toBeTruthy()
  rendered.rerender(
    view({
      ...ready,
      selectionHash: "b".repeat(16),
      coordinateHash: "b".repeat(16),
    })
  )
  expect(screen.getByRole("radio", { name: "Cycling" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Update coverage" }))
  expect(calculate).toHaveBeenCalledOnce()
})
it("uses the service area automatically and renders the site Select controls", () => {
  const calculate = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AtlasNetworkReach
        selection={selection}
        retrySelection={vi.fn()}
        networkId="one"
        onNetwork={vi.fn()}
        minutes={15}
        onMinutes={vi.fn()}
        mode="walking"
        onMode={vi.fn()}
        response={null}
        calculate={calculate}
        canExport={false}
        gaps={false}
        onGaps={vi.fn()}
        filterCount={0}
        onClearFilters={vi.fn()}
      />
    </NextIntlClientProvider>
  )
  expect(screen.getByText("Wirral")).toBeTruthy()
  expect(screen.queryByLabelText("Residents assessed")).toBeNull()
  expect(screen.getByRole("radio", { name: "Walking" })).toBeTruthy()
  expect(screen.getByRole("radio", { name: "15 min" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Calculate coverage" }))
  expect(calculate).toHaveBeenCalledOnce()
})

it("shows skeletons only for a calculation in progress, keeping stale selections and failures explicit", () => {
  const fixture = (state: "pending" | "failed", stale = false) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AtlasNetworkReach
        selection={selection}
        retrySelection={vi.fn()}
        networkId="one"
        onNetwork={vi.fn()}
        minutes={15}
        onMinutes={vi.fn()}
        mode="walking"
        onMode={vi.fn()}
        response={{ state }}
        stale={stale}
        calculate={vi.fn()}
        canExport={false}
        gaps={false}
        onGaps={vi.fn()}
        filterCount={0}
        onClearFilters={vi.fn()}
      />
    </NextIntlClientProvider>
  )
  const view = render(fixture("pending"))
  expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true")
  expect(
    view.container.querySelectorAll('[data-slot="skeleton"]').length
  ).toBeGreaterThan(0)
  expect(screen.getByRole("radio", { name: "15 min" })).toBeTruthy()
  view.rerender(fixture("pending", true))
  expect(view.container.querySelector('[data-slot="skeleton"]')).toBeNull()
  expect(screen.getByRole("status").textContent).toContain(
    messages.atlasNetwork.selectionChanged
  )
  view.rerender(fixture("failed"))
  expect(view.container.querySelector('[aria-busy="true"]')).toBeNull()
  expect(screen.getByRole("status").textContent).toContain(
    "Network analysis unavailable"
  )
})

it("clears stale results when the selection changes and does not calculate on each filter change", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      schemaVersion: 1,
      networkId: "one",
      areaCode: "E06000016",
      mode: "walking",
      state: "unsupported",
      message: "Fixture status",
    })
  )
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(({ request }) => useNetworkReach(request, true), {
    initialProps: { request: draft },
  })
  expect(fetcher).not.toHaveBeenCalled()
  act(() => hook.result.current.calculate())
  await waitFor(() =>
    expect(hook.result.current.response?.state).toBe("unsupported")
  )
  hook.rerender({
    request: {
      ...draft,
      scope: {
        ...draft.scope,
        filters: { ...draft.scope.filters, catalogue: true },
      },
    },
  })
  expect(hook.result.current.response).toBeNull()
  expect(fetcher).toHaveBeenCalledOnce()
})

it("allows checking progress again when a queued calculation exceeds the polling window", async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockImplementation(async () =>
    Response.json({
      networkId: draft.networkId,
      areaCode: draft.areaCode,
      mode: draft.mode,
      state: "pending",
    })
  )
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(() => useNetworkReach(draft, true))
  await act(async () => hook.result.current.calculate())
  expect(hook.result.current.response?.state).toBe("pending")
  await act(async () => vi.advanceTimersByTimeAsync(300000))
  expect(hook.result.current.response?.state).toBe("failed")
  const checks = fetcher.mock.calls.length
  await act(async () => hook.result.current.calculate())
  expect(fetcher.mock.calls.length).toBe(checks + 1)
  expect(hook.result.current.response?.state).toBe("pending")
})

it("requires an explicit calculation after changing service or mode, and refuses calculations while disabled", async () => {
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    const request = JSON.parse(init.body)

    return Response.json({
      networkId: request.networkId,
      areaCode: "E06000016",
      mode: request.mode,
      state: "unsupported",
    })
  })
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(
    ({ request, enabled }) => useNetworkReach(request, enabled),
    { initialProps: { request: draft, enabled: false } }
  )
  act(() => hook.result.current.calculate())
  expect(fetcher).not.toHaveBeenCalled()
  hook.rerender({ request: draft, enabled: true })
  expect(fetcher).not.toHaveBeenCalled()
  act(() => hook.result.current.calculate())
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  hook.rerender({ request: { ...draft, networkId: "two" }, enabled: true })
  expect(fetcher).toHaveBeenCalledOnce()
  act(() => hook.result.current.calculate())
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(JSON.parse(fetcher.mock.calls[1]![1].body).networkId).toBe("two")
})

it("disables coverage at a national scale and offers a local view", () => {
  const calculate = vi.fn(),
    onZoomLocal = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AtlasNetworkReach
        selection={selection}
        retrySelection={vi.fn()}
        networkId="one"
        onNetwork={vi.fn()}
        minutes={15}
        onMinutes={vi.fn()}
        mode="walking"
        onMode={vi.fn()}
        response={null}
        calculate={calculate}
        canExport={false}
        gaps={false}
        onGaps={vi.fn()}
        filterCount={0}
        onClearFilters={vi.fn()}
        calculationLimit="zoom"
        onZoomLocal={onZoomLocal}
      />
    </NextIntlClientProvider>
  )
  const button = screen.getByRole("button", {
    name: "Calculate coverage",
  }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(calculate).not.toHaveBeenCalled()
  expect(screen.getByText("Zoom in to calculate reach")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Zoom to a local view" }))
  expect(onZoomLocal).toHaveBeenCalledOnce()
})

it("aborts polling when leaving the local view", async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockImplementation(async () =>
    Response.json({
      networkId: draft.networkId,
      areaCode: draft.areaCode,
      mode: draft.mode,
      state: "pending",
    })
  )
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(({ enabled }) => useNetworkReach(draft, enabled), {
    initialProps: { enabled: true },
  })
  await act(async () => hook.result.current.calculate())
  const signal = fetcher.mock.calls[0]![1].signal
  hook.rerender({ enabled: false })
  expect(signal.aborted).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(fetcher).toHaveBeenCalledOnce()
  hook.rerender({ enabled: true })
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(fetcher).toHaveBeenCalledOnce()
})
