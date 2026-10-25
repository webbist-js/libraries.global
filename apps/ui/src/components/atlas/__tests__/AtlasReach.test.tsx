// @vitest-environment happy-dom
import type { AtlasReachResult } from "@repo/shared-data"
import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, within } from "@/test/render"

import type { AtlasLibrary } from "../atlas.logic"
import { AtlasReachAnalysis, useAtlasReach } from "../AtlasReach"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("retains known zero, explains partial counts and switches mode without treating cumulative bands as separate populations", () => {
  const onMode = vi.fn()
  render(
    <AtlasReachAnalysis
      library={{ id: "one", name: "One" } as AtlasLibrary}
      response={
        {
          state: "partial",
          population: { year: 2020, release: "population-test" },
          network: { release: "network-test" },
          calculatedAt: "2026-10-24T00:00:00Z",
          contours: [
            { minutes: 5, residents: 0 },
            { minutes: 10, residents: null, coveredFraction: 0.5 },
            { minutes: 15, residents: 120 },
            { minutes: 30, residents: 300 },
          ],
        } as AtlasReachResult
      }
      error={null}
      retry={vi.fn()}
      mode="walking"
      onMode={onMode}
      minutes={15}
      onMinutes={vi.fn()}
      opacity={0.7}
      onOpacity={vi.fn()}
      onClose={vi.fn()}
      canExport={false}
      collapsed={false}
      onCollapse={vi.fn()}
    />
  )
  expect(
    within(screen.getByRole("table")).getByText("0", { exact: true })
  ).toBeTruthy()
  expect(
    within(screen.getByRole("table")).getByText("Unavailable")
  ).toBeTruthy()
  expect(screen.getByText(/Don't add the rows together/)).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Download" })).toBeNull()
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Travel mode" }), {
    key: "ArrowDown",
  })
  fireEvent.click(screen.getByRole("option", { name: "Cycling" }))
  expect(onMode).toHaveBeenCalledWith("cycling")
})
it("aborts stale work and scopes manual retries to the selected library", async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const request = JSON.parse(init.body as string)

    return Response.json({ ...request, state: "failed", message: "Retry" })
  })
  vi.stubGlobal("fetch", fetcher)
  const hook = renderHook(({ id }) => useAtlasReach(true, id, "walking"), {
    initialProps: { id: "one" },
  })
  await act(async () => {
    await Promise.resolve()
  })
  await act(async () => {
    hook.result.current.retry()
    await Promise.resolve()
  })
  expect(JSON.parse(fetcher.mock.calls[1]![1].body as string).retry).toBe(true)
  const firstSignal = fetcher.mock.calls[0]![1].signal!
  await act(async () => {
    hook.rerender({ id: "two" })
    await Promise.resolve()
  })
  expect(firstSignal.aborted).toBe(true)
  expect(
    JSON.parse(fetcher.mock.calls.at(-1)![1].body as string).retry
  ).toBeUndefined()
  expect(hook.result.current.response?.libraryId).toBe("two")
})
