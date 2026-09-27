// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AtlasLibrary } from "../atlas.logic"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

let features: string[] = []
vi.mock("@/lib/access-client", () => ({
  useEntitlements: () => ({
    plan: features.length > 0 ? "pro" : "free",
    can: (f: string) => features.includes(f),
    ready: true,
  }),
}))

const { AtlasExportButton, useAtlasExport } =
  await import("../AtlasExportButton")

const fetchMock = vi.fn()
const downloads: { href: string; download: string }[] = []

const csvResponse = () =>
  new Response("name\r\n", {
    headers: {
      "Content-Disposition":
        'attachment; filename="libraries-global-atlas-2026-09-27.csv"',
    },
  })

beforeEach(() => {
  features = []
  downloads.length = 0
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push({ href: this.href, download: this.download })
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("useAtlasExport", () => {
  it("posts the format and ids, then saves the file under the server's name", async () => {
    fetchMock.mockResolvedValue(csvResponse())
    const { result } = renderHook(() => useAtlasExport(vi.fn()))

    await act(() => result.current.run("csv", ["a", "b"]))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/export/atlas",
      expect.objectContaining({ method: "POST" })
    )
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      format: "csv",
      ids: ["a", "b"],
    })
    expect(downloads).toEqual([
      {
        href: "blob:export",
        download: "libraries-global-atlas-2026-09-27.csv",
      },
    ])
    expect(result.current.busy).toBe(false)
    expect(result.current.outcome?.tone).toBe("ok")
  })

  it("is busy while the request runs", async () => {
    let finish!: (r: Response) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve
      })
    )
    const { result } = renderHook(() => useAtlasExport(vi.fn()))

    let running: Promise<void> = Promise.resolve()
    act(() => {
      running = result.current.run("geojson", ["a"])
    })
    expect(result.current.busy).toBe(true)

    await act(async () => {
      finish(csvResponse())
      await running
    })
    expect(result.current.busy).toBe(false)
  })

  it("opens the plans sheet when the server says Pro is needed", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 402 }))
    const onUpgrade = vi.fn()
    const { result } = renderHook(() => useAtlasExport(onUpgrade))

    await act(() => result.current.run("csv", ["a"]))

    expect(onUpgrade).toHaveBeenCalledTimes(1)
    expect(downloads).toHaveLength(0)
  })

  it("explains the plan's row cap", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ limit: 10_000 }, { status: 413 })
    )
    const { result } = renderHook(() => useAtlasExport(vi.fn()))

    await act(() => result.current.run("csv", ["a"]))

    expect(result.current.outcome?.tone).toBe("error")
    expect(result.current.outcome?.text).toContain("10,000")
  })

  it("doesn't send more ids than one export can hold", async () => {
    const { result } = renderHook(() => useAtlasExport(vi.fn()))

    await act(() =>
      result.current.run(
        "csv",
        Array.from({ length: 10_001 }, (_, i) => `${i}`)
      )
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.outcome?.tone).toBe("error")
  })

  it("reports a failed request", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"))
    const { result } = renderHook(() => useAtlasExport(vi.fn()))

    await act(() => result.current.run("csv", ["a"]))

    expect(result.current.busy).toBe(false)
    expect(result.current.outcome?.tone).toBe("error")
  })
})

describe("AtlasExportButton", () => {
  const libs = [{ id: "a" }, { id: "b" }] as AtlasLibrary[]

  it("without Pro, shows a Pro chip and opens the plans sheet", () => {
    const onSeePlans = vi.fn()
    render(createElement(AtlasExportButton, { libraries: libs, onSeePlans }))

    const button = screen.getByRole("button", { name: /export/i })
    expect(button.textContent).toContain("Pro")
    expect(screen.getByText("Export is a Pro feature.")).toBeTruthy()
    fireEvent.click(button)

    expect(onSeePlans).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("with Pro, is a menu button, disabled when nothing is listed", () => {
    features = ["atlas.export"]
    const { rerender } = render(
      createElement(AtlasExportButton, { libraries: libs, onSeePlans: vi.fn() })
    )

    const button = screen.getByRole("button", { name: /export/i })
    expect(button.getAttribute("aria-haspopup")).toBe("menu")
    expect(button.textContent).not.toContain("Pro")
    expect(button.hasAttribute("disabled")).toBe(false)

    rerender(
      createElement(AtlasExportButton, { libraries: [], onSeePlans: vi.fn() })
    )
    expect(button.hasAttribute("disabled")).toBe(true)
  })
})
