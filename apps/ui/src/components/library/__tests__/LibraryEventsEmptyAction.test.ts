// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

const state = vi.hoisted(() => ({
  ready: true,
  staff: new Set<string>(),
  session: null as { user: { id: string } } | null,
  pending: false,
  affiliated: [] as string[],
}))

vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({
    ready: state.ready,
    libraries: [],
    can: (action: string, id: string) =>
      action === "edit" && state.staff.has(id),
  }),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: state.session, isPending: state.pending }),
  },
}))
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

const { LibraryEventsEmptyAction } = await import("../LibraryEventsEmptyAction")

const ID = "lib000000000000000000001"
const props = {
  documentId: ID,
  librarySlug: "central-library",
  libraryName: "Central Library",
}
const CLAIM =
  "/contribute/claim?librarySlug=central-library&libraryName=Central%20Library&libraryDocumentId=" +
  ID
const placeholder = (container: HTMLElement) =>
  container.querySelector('span[aria-hidden="true"]')

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        libraries: state.affiliated.map((documentId) => ({ documentId })),
      })
    )
  )
})
afterEach(() => {
  cleanup()
  state.ready = true
  state.staff.clear()
  state.session = null
  state.pending = false
  state.affiliated = []
  vi.unstubAllGlobals()
})

describe("LibraryEventsEmptyAction", () => {
  it("holds the line until the session and staff list are known", () => {
    state.ready = false
    const { container, unmount } = render(
      createElement(LibraryEventsEmptyAction, props)
    )
    expect(placeholder(container)).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    unmount()

    state.ready = true
    state.pending = true
    const second = render(createElement(LibraryEventsEmptyAction, props))
    expect(placeholder(second.container)).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("sends this library's staff to connect a feed, without an affiliation lookup", async () => {
    state.session = { user: { id: "u1" } }
    state.staff.add(ID)
    render(createElement(LibraryEventsEmptyAction, props))
    expect(
      screen
        .getByRole("link", { name: "Connect an event feed" })
        .getAttribute("href")
    ).toBe("/staff/central-library/events/connect")
    await waitFor(() => expect(fetch).not.toHaveBeenCalled())
  })

  it("hides the claim link once a claim is already in", async () => {
    state.session = { user: { id: "u1" } }
    state.affiliated = [ID]
    render(createElement(LibraryEventsEmptyAction, props))
    expect(
      await screen.findByText(/Your claim is with a moderator/)
    ).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    expect(fetch).toHaveBeenCalledWith("/api/profile/me/affiliations")
  })

  it("offers the claim to a signed-in visitor with no affiliation", async () => {
    state.session = { user: { id: "u1" } }
    state.affiliated = ["lib000000000000000000002"]
    render(createElement(LibraryEventsEmptyAction, props))
    const link = await screen.findByRole("link", {
      name: "Work here? Claim this library to add events",
    })
    expect(link.getAttribute("href")).toBe(CLAIM)
  })

  it("sends a signed-out visitor through sign-in to the claim", async () => {
    render(createElement(LibraryEventsEmptyAction, props))
    const link = await screen.findByRole("link", { name: /Claim this library/ })
    expect(link.getAttribute("href")).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent(CLAIM)}`
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
