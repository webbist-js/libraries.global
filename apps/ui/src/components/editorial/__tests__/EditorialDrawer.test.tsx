// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ModerationSummaryRow } from "@/hooks/useModerationSummary"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })
const state = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  rows: null as ModerationSummaryRow[] | null,
  pending: false,
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: { user: state.user } }),
}))
vi.mock("@/hooks/useModerationSummary", () => ({
  useModerationSummary: () => ({ data: state.rows, isPending: state.pending }),
}))
vi.mock("@/hooks/useContributeMenu", () => ({
  useFeaturedDrive: () => ({ data: { title: "Hours in Kent", slug: "hours" } }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { EditorialDrawer } = await import("../EditorialDrawer")
const { openEditorialDrawer, useEditorialDrawer, closeEditorialDrawer } =
  await import("@/lib/editorial/drawer")

function Probe() {
  return <span data-testid="drawer-open">{String(useEditorialDrawer())}</span>
}

beforeEach(() => {
  state.user = {
    id: "board",
    capabilities: [
      "moderate.queue",
      "docs.directEdit",
      "journal.directEdit",
      "drives.manage",
    ],
    moderationScopes: [{ queue: "all", locale: null }],
    editorLocales: { docs: "all", journal: "all" },
  }
  state.rows = [
    "libraries",
    "articles",
    "claims",
    "drives",
    "applications",
    "discussions",
  ].map((id) => ({
    id,
    pending: id === "discussions" ? 2 : 0,
  })) as ModerationSummaryRow[]
  state.pending = false
})
afterEach(() => {
  cleanup()
  closeEditorialDrawer()
})

describe("Editorial drawer", () => {
  it("makes discussion work visible alongside distinct submission categories", () => {
    render(<EditorialDrawer />)
    expect(screen.getByText("2 contributions waiting for review")).toBeTruthy()
    expect(screen.queryByText("Nothing waiting for review")).toBeNull()
    const queues = screen.getByRole("navigation", { name: "Review queues" })
    expect(
      within(queues)
        .getByRole("link", { name: "Discussions 2" })
        .getAttribute("href")
    ).toBe("/contribute/moderation?tab=discussions")
    expect(
      within(queues)
        .getByRole("link", { name: "Claims 0" })
        .getAttribute("href")
    ).toBe("/contribute/moderation?category=claims")
    expect(
      screen.getByRole("region", { name: "Publish and edit" })
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Checklist ideas" })).toBeTruthy()
  })

  it("shows only a discussion moderator’s permitted tools and closes on navigation", () => {
    state.user = {
      id: "moderator",
      capabilities: ["moderate.queue"],
      moderationScopes: [{ queue: "discussions", locale: "fr" }],
    }
    state.rows = [{ id: "discussions", pending: 2 }]
    openEditorialDrawer()
    render(
      <>
        <EditorialDrawer />
        <Probe />
      </>
    )
    const queues = screen.getByRole("navigation", { name: "Review queues" })
    expect(within(queues).getAllByRole("link")).toHaveLength(1)
    expect(
      screen.queryByRole("region", { name: "Publish and edit" })
    ).toBeNull()
    expect(screen.queryByRole("link", { name: "Checklist ideas" })).toBeNull()
    expect(screen.queryByRole("link", { name: "New drive" })).toBeNull()
    fireEvent.click(within(queues).getByRole("link", { name: "Discussions 2" }))
    expect(screen.getByTestId("drawer-open").textContent).toBe("false")
  })

  it("does not claim the queues are empty while loading or after a partial failure", () => {
    state.rows = null
    state.pending = true
    const view = render(<EditorialDrawer />)
    expect(screen.getByText("Checking the queues…")).toBeTruthy()
    state.pending = false
    view.rerender(<EditorialDrawer />)
    expect(screen.getByText("Review counts unavailable")).toBeTruthy()
    expect(screen.queryByText("Nothing waiting for review")).toBeNull()
    state.rows = [{ id: "discussions", pending: 2 }]
    view.rerender(<EditorialDrawer />)
    expect(screen.getByText("2 contributions waiting for review")).toBeTruthy()
    expect(
      screen.getByText("Some counts are unavailable. Open a queue to check.")
    ).toBeTruthy()
  })

  it("keeps a Journal editor’s footer and publishing tools in the Journal", () => {
    state.user = {
      id: "writer",
      capabilities: ["journal.directEdit"],
      editorLocales: { journal: ["fr"] },
    }
    render(<EditorialDrawer />)
    expect(
      screen.queryByRole("navigation", { name: "Review queues" })
    ).toBeNull()
    expect(
      screen.getByRole("link", { name: "Open the editor" }).getAttribute("href")
    ).toBe("/contribute/knowledge?type=journal")
    expect(
      screen
        .getByRole("link", { name: "Write an article" })
        .getAttribute("href")
    ).toBe("/contribute/knowledge/new?type=journal")
    expect(screen.getByText("In French")).toBeTruthy()
  })
})
