// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CatalogueSearch } from "@/components/ds/CatalogueSearch"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next-intl", () => ({ useTranslations: () => String }))
afterEach(cleanup)
const option = { documentId: "north", name: "North Library Service" }

describe("catalogue search", () => {
  it("loads on demand, supports arrow-key focus, and closes after choosing", async () => {
    const load = vi.fn().mockResolvedValue({ rows: [option], more: false })
    const onSelect = vi.fn()
    render(
      <CatalogueSearch
        label="Library service"
        placeholder="Search services"
        load={load}
        describe={() => "12 libraries"}
        onSelect={onSelect}
      />
    )
    expect(load).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole("button", { name: "Library service Search services" })
    )
    const result = await screen.findByRole("button", {
      name: "North Library Service 12 libraries",
    })
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" })
    expect(document.activeElement).toBe(result)
    fireEvent.keyDown(result, { key: "ArrowUp" })
    expect(document.activeElement).toBe(screen.getByRole("searchbox"))
    fireEvent.click(result)
    expect(onSelect).toHaveBeenCalledWith(option)
    expect(screen.queryByRole("searchbox")).toBeNull()
  })
  it("rejects a stale search result and gives an empty search a recovery hint", async () => {
    let finish:
      | ((value: { rows: (typeof option)[]; more: boolean }) => void)
      | undefined
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValue({ rows: [], more: false })
    render(
      <CatalogueSearch
        label="Library service"
        placeholder="Search services"
        load={load}
        describe={() => ""}
        onSelect={vi.fn()}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Library service Search services" })
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 225))
    })
    expect(load).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Missing" },
    })
    await act(async () => {
      finish!({ rows: [option], more: false })
    })
    expect(
      await screen.findByText(
        "No matches. Try another name or a broader search."
      )
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: /North Library/ })).toBeNull()
    expect((load.mock.calls[0]![2] as AbortSignal).aborted).toBe(true)
  })
  it("offers a retry after a failed request", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValue({ rows: [option], more: false })
    render(
      <CatalogueSearch
        label="Library service"
        placeholder="Search services"
        load={load}
        describe={() => "12 libraries"}
        onSelect={vi.fn()}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Library service Search services" })
    )
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("button", { name: /North Library/ })
    ).toBeTruthy()
  })
})
