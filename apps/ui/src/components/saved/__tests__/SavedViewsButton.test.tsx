// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, within } from "@/test/render"

const state = vi.hoisted(() => ({
  session: null as {
    user: { id: string; limits: Record<string, number> }
  } | null,
}))

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: state.session }) },
}))

import { SavedViewsButton } from "../SavedViewsButton"

const saved = {
  documentId: "a1",
  kind: "search",
  name: "Open late in Leeds",
  query: "q=leeds&open=late",
  createdAt: "2026-11-01T10:00:00.000Z",
}

beforeEach(() => {
  state.session = { user: { id: "ba-1", limits: { savedSearches: 3 } } }
  window.history.replaceState(null, "", "/libraries?q=york&type=public")
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("saves the current search by name and lists it", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? Response.json(
          {
            data: {
              ...saved,
              documentId: "b2",
              name: "York public",
              query: "q=york&type=public",
            },
          },
          { status: 201 }
        )
      : Response.json({ data: [saved] })
  )
  vi.stubGlobal("fetch", fetchMock)
  render(<SavedViewsButton kind="search" />)

  fireEvent.click(screen.getByRole("button", { name: "Saved searches" }))
  const drawer = await screen.findByRole("dialog", { name: "Saved searches" })
  expect(
    (
      await within(drawer).findByRole("link", { name: /Open late in Leeds/ })
    ).getAttribute("href")
  ).toBe("/libraries?q=leeds&open=late")
  expect(within(drawer).getByText("1 of 3 used")).toBeTruthy()

  fireEvent.change(within(drawer).getByLabelText("Name this search"), {
    target: { value: "York public" },
  })
  fireEvent.click(within(drawer).getByRole("button", { name: "Save" }))
  expect(await within(drawer).findByText("Saved “York public”.")).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/saved-views",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        kind: "search",
        name: "York public",
        query: "q=york&type=public",
      }),
    })
  )
})

it("explains the limit instead of offering to save", async () => {
  state.session = { user: { id: "ba-1", limits: { savedSearches: 1 } } }
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: [saved] }))
  )
  render(<SavedViewsButton kind="search" />)
  fireEvent.click(screen.getByRole("button", { name: "Saved searches" }))
  const drawer = await screen.findByRole("dialog", { name: "Saved searches" })
  expect(
    await within(drawer).findByText(/the most an account keeps/)
  ).toBeTruthy()
  expect(within(drawer).queryByLabelText("Name this search")).toBeNull()
  // The cap is the same for every account: nothing to buy.
  expect(within(drawer).queryByRole("link", { name: /plan/i })).toBeNull()
  expect(within(drawer).queryByText(/upgrade/i)).toBeNull()
})

it("asks a signed-out visitor to sign in", async () => {
  state.session = null
  render(<SavedViewsButton kind="view" />)
  fireEvent.click(screen.getByRole("button", { name: "Saved views" }))
  const drawer = await screen.findByRole("dialog", { name: "Saved views" })
  expect(
    within(drawer).getByRole("link", { name: "Sign in" }).getAttribute("href")
  ).toContain("/auth/signin?callbackUrl=")
})
