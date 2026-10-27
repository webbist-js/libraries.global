// @vitest-environment happy-dom
import { defaultWidgetConfig, type TeamWidget } from "@repo/shared-data"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useWidgetDraft } from "@/components/widgets/useWidgetDraft"
import type * as WidgetClient from "@/lib/widgets/client"
import { widgetRequest } from "@/lib/widgets/client"

vi.mock("@/lib/widgets/client", async (importOriginal) => {
  const real = await importOriginal<typeof WidgetClient>()

  return { ...real, widgetRequest: vi.fn() }
})
const request = vi.mocked(widgetRequest)
const initial = {
  documentId: "widget00000000000000001",
  name: "Finder",
  type: "finder",
  config: defaultWidgetConfig(),
  selection: { documentId: "selection000000000000001" },
  draftVersion: 1,
} as TeamWidget
beforeEach(() => {
  vi.useFakeTimers()
  request.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("widget autosave", () => {
  it("serialises edits made during an in-flight save with the next server version", async () => {
    let finish: ((value: TeamWidget) => void) | undefined
    request
      .mockImplementationOnce(
        () =>
          new Promise<TeamWidget>((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValueOnce({ ...initial, draftVersion: 3 })
    const { result } = renderHook(() => useWidgetDraft("team", initial, true))
    act(() => result.current.edit({ name: "Changed name" }))
    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(request).toHaveBeenCalledTimes(1)
    act(() =>
      result.current.edit({
        config: { ...initial.config, introduction: "Changed while saving" },
      })
    )
    await act(async () => {
      finish!({ ...initial, name: "Changed name", draftVersion: 2 })
    })
    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1]![3]).toMatchObject({
      name: "Changed name",
      version: 2,
      config: { introduction: "Changed while saving" },
    })
    expect(result.current.phase).toBe("saved")
  })
  it("retains edits after a conflict and only retries after explicit reconciliation", async () => {
    request
      .mockRejectedValueOnce(
        Object.assign(new Error("Conflict"), { code: "version_conflict" })
      )
      .mockResolvedValueOnce({ ...initial, draftVersion: 5 })
      .mockResolvedValueOnce({ ...initial, draftVersion: 6 })
    const { result } = renderHook(() => useWidgetDraft("team", initial, true))
    act(() => result.current.edit({ name: "My draft" }))
    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(result.current.phase).toBe("conflict")
    expect(result.current.draft.name).toBe("My draft")
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(request).toHaveBeenCalledTimes(1)
    await act(() => result.current.load(true))
    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(request.mock.calls[2]![3]).toMatchObject({
      version: 5,
      name: "My draft",
    })
  })
  it("does not write drafts for inactive Teams", async () => {
    const { result } = renderHook(() => useWidgetDraft("team", initial, false))
    act(() => result.current.edit({ name: "Cannot save" }))
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(request).not.toHaveBeenCalled()
  })
})
