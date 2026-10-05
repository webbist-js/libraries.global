// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
  },
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const suggestion = (n: number) => ({
  documentId: `s${n}`,
  name: `Option ${n}`,
  optionKey: "services",
  requests: 1,
  votes: n,
  voted: false,
  libraryCount: 2,
  libraries: [],
})

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { data: [1, 2, 3, 4, 5, 6].map(suggestion) },
        { status: 200 }
      )
    )
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { SuggestedAdditions } = await import("../SuggestedAdditions")

describe("SuggestedAdditions", () => {
  it("shows four as a card and links to the full list", async () => {
    render(createElement(SuggestedAdditions, { signInReturnTo: "/contribute" }))
    expect(await screen.findByText("Option 4")).toBeTruthy()
    expect(screen.queryByText("Option 5")).toBeNull()
    const all = screen.getByRole("link", { name: "See all 6 suggestions" })
    expect(all.getAttribute("href")).toBe("/community/suggestions")
  })

  it("shows every suggestion as a page", async () => {
    render(
      createElement(SuggestedAdditions, {
        variant: "page",
        signInReturnTo: "/community/suggestions",
      })
    )
    expect(await screen.findByText("Option 6")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /See all/ })).toBeNull()
  })
})
