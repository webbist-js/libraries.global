// @vitest-environment happy-dom
import type { ComponentProps } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { ContributeSectionHeader } from "@/app/[locale]/(dashboard)/contribute/_components/ContributeSectionHeader"
import { cleanup, render, screen } from "@/test/render"

import { DashboardOverlayContext } from "./DashboardOverlayContext"
import { WorkspacePageHeader } from "./WorkspaceHero"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock(
  "@/app/[locale]/(dashboard)/contribute/_components/ContributeNavBar",
  () => ({ ContributeNavBar: () => <nav aria-label="Contribution sections" /> })
)
afterEach(cleanup)
const shell = {
  panel: null,
  trigger: null,
  handleToggle: vi.fn(),
  handleClose: vi.fn(),
}

it("lets a workspace own navigation while preserving literal title, status and actions", () => {
  render(
    <DashboardOverlayContext value={shell}>
      <WorkspacePageHeader
        title="Every *Library* Team"
        context="Team workspace"
        breadcrumb={[{ label: "Staff", href: "/staff" }]}
        tabs={<nav aria-label="Duplicate navigation" />}
        status="Verification pending"
        actions={<button>Invite colleague</button>}
      />
    </DashboardOverlayContext>
  )
  const heading = screen.getByRole("heading", {
    name: "Every *Library* Team",
    level: 1,
  })
  expect(heading.querySelector("em")).toBeNull()
  expect(screen.queryByRole("navigation")).toBeNull()
  expect(screen.getByText("Verification pending")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Invite colleague" })).toBeTruthy()
})
it("keeps a standalone task's back route and translates legacy emphasis to ordinary title text", () => {
  render(
    <ContributeSectionHeader
      title="Add a library *to the index.*"
      section="Index editor"
      compact
      back
      lead="Keep your draft."
    />
  )
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Add a library to the index."
  )
  expect(
    screen.getByRole("link", { name: "Contribute" }).getAttribute("href")
  ).toBe("/contribute")
  expect(
    screen.getByRole("navigation", { name: "Contribution sections" })
  ).toBeTruthy()
  expect(screen.getByText("Keep your draft.")).toBeTruthy()
})
