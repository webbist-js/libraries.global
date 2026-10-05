// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

const session = vi.hoisted(() => ({
  value: { data: { user: { id: "u1" } }, isPending: false } as {
    data: { user: { id: string } } | null
    isPending: boolean
  },
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => session.value,
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
  status: "open",
  requests: 1,
  votes: n,
  voted: false,
  libraryCount: 2,
  libraries: [],
})

beforeEach(() => {
  session.value = { data: { user: { id: "u1" } }, isPending: false }
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

  it("shows a sign-in link when signed out", async () => {
    session.value = { data: null, isPending: false }
    render(
      createElement(SuggestedAdditions, {
        signInReturnTo: "/community#suggested-additions",
      })
    )
    expect(await screen.findByText("Option 1")).toBeTruthy()
    const signIn = screen.getByRole("link", { name: "Sign in to vote" })

    expect(signIn.getAttribute("href")).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community#suggested-additions")}`
    )
  })

  it("shows all suggestions with no See all link when there are only three", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ data: [1, 2, 3].map(suggestion) }, { status: 200 })
      )
    )
    render(createElement(SuggestedAdditions, { signInReturnTo: "/contribute" }))
    expect(await screen.findByText("Option 1")).toBeTruthy()
    expect(screen.getByText("Option 2")).toBeTruthy()
    expect(screen.getByText("Option 3")).toBeTruthy()
    expect(screen.queryByRole("link", { name: /See all/ })).toBeNull()
  })
})
