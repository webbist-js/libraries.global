// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})

const { ModerationFilters } = await import("../ModerationFilters")

const props = (q: string) => ({
  value: {
    segment: "pending" as const,
    queue: "" as const,
    locale: "",
    q,
    drive: "",
  },
  queues: ["index" as const],
  locales: [],
  counts: {},
  onChange: vi.fn(),
})

afterEach(cleanup)

describe("ModerationFilters search", () => {
  it("doesn't overwrite what the user is typing when the URL catches up", () => {
    const { rerender } = render(createElement(ModerationFilters, props("")))
    const box = screen.getByLabelText("Search submissions") as HTMLInputElement
    box.focus()
    fireEvent.change(box, { target: { value: "abc" } })
    // An earlier debounced "ab" lands in the URL while "abc" is in the box.
    rerender(createElement(ModerationFilters, props("ab")))
    expect(box.value).toBe("abc")
  })

  it("follows the URL when the box isn't being edited (back/forward)", () => {
    const { rerender } = render(createElement(ModerationFilters, props("ab")))
    const box = screen.getByLabelText("Search submissions") as HTMLInputElement
    rerender(createElement(ModerationFilters, props("maps")))
    expect(box.value).toBe("maps")
  })
})
