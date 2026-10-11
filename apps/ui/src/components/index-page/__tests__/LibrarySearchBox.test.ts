// @vitest-environment happy-dom
import type * as NextIntl from "next-intl"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const nav = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "en",
}))
vi.mock("@/lib/meilisearch", () => ({
  searchLibraries: vi.fn(async () => ({
    hits: [
      {
        id: 1,
        documentId: "lib-1",
        name: "Glasgow Central Library",
        slug: "glasgow-central",
        city: "Glasgow",
        country_name: "Scotland",
      },
    ],
  })),
  buildLibraryPath: (hit: { slug: string }) =>
    `/europe/scotland/glasgow/${hit.slug}`,
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    useRouter: () => nav,
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const { LibrarySearchBox } = await import("../LibrarySearchBox")

afterEach(() => {
  cleanup()
  nav.push.mockReset()
})

function renderBox(props: Partial<Parameters<typeof LibrarySearchBox>[0]>) {
  const handlers = {
    onSubmit: vi.fn(),
    onNearMe: vi.fn(),
    onClear: vi.fn(),
  }
  render(createElement(LibrarySearchBox, { id: "q", ...handlers, ...props }))

  return { ...handlers, input: screen.getByRole("combobox") }
}

describe("LibrarySearchBox", () => {
  it("submits the typed query on Enter while no suggestion is highlighted", async () => {
    const { onSubmit, input } = renderBox({})
    fireEvent.change(input, { target: { value: "  Glasgow " } })
    await screen.findByRole("option", { name: /Glasgow Central Library/ })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSubmit).toHaveBeenCalledWith("Glasgow")
    expect(nav.push).not.toHaveBeenCalled()
  })

  it("opens the highlighted library when arrowed to", async () => {
    const { onSubmit, input } = renderBox({})
    fireEvent.change(input, { target: { value: "Glasgow" } })
    await screen.findByRole("option", { name: /Glasgow Central Library/ })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(nav.push).toHaveBeenCalledWith(
      "/europe/scotland/glasgow/glasgow-central"
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("submits from the Search button", () => {
    const { onSubmit } = renderBox({ defaultQuery: "Cardiff" })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(onSubmit).toHaveBeenCalledWith("Cardiff")
  })

  it("reports an emptied box", async () => {
    const { onClear, input } = renderBox({ defaultQuery: "Cardiff" })
    fireEvent.change(input, { target: { value: "" } })
    await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1))
  })

  it("shows Near me as a toggle when the caller tracks it", () => {
    const { onNearMe } = renderBox({ nearActive: true })
    const button = screen.getByRole("button", { name: /Near you/ })
    expect(button.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(button)
    expect(onNearMe).toHaveBeenCalledTimes(1)
  })

  it("leaves Near me a plain button when the caller doesn't track it", () => {
    renderBox({})
    const button = screen.getByRole("button", { name: /Near me/ })
    expect(button.getAttribute("aria-pressed")).toBeNull()
  })
})
