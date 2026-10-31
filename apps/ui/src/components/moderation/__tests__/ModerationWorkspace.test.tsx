// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen, within } from "@/test/render"

import { ModerationWorkspace } from "../ModerationWorkspace"
import { ModerationWorkspaceNav } from "../ModerationWorkspaceNav"
import type { WorkspaceView } from "../workspace"

const location = vi.hoisted(() => ({ path: "/moderation", search: "" }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(location.search),
}))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => location.path,
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@/components/dashboard/DashboardPage", () => ({
  DashboardPage: ({
    title,
    navigation,
    navigationFooter,
    overview,
  }: {
    title: string
    navigation: ReactNode
    navigationFooter: ReactNode
    overview: ReactNode
  }) => (
    <>
      <aside aria-label={title}>
        {navigation}
        {navigationFooter}
      </aside>
      <main>{overview}</main>
    </>
  ),
}))
vi.mock("@/components/dashboard/RecordToolbar", () => ({
  RecordToolbar: () => null,
}))

const views: WorkspaceView[] = [
  { id: "libraries", href: "/moderation?category=libraries", pending: null },
  { id: "claims", href: "/moderation?category=claims", pending: null },
  { id: "discussions", href: "/moderation?tab=discussions", pending: null },
]
afterEach(() => {
  cleanup()
  location.path = "/moderation"
  location.search = ""
})

it("owns a moderation sidebar with its guidance pinned separately from page content", () => {
  render(
    <ModerationWorkspace views={views}>
      <p>Review content</p>
    </ModerationWorkspace>
  )
  const rail = screen.getByRole("complementary", { name: "Moderation" })
  expect(
    within(rail).getByRole("navigation", { name: "Review queues" })
  ).toBeTruthy()
  expect(
    within(rail).getByRole("link", { name: "Overview" }).getAttribute("href")
  ).toBe("/moderation")
  expect(
    within(rail).getByRole("link", { name: "Read the reviewer guidance" })
  ).toBeTruthy()
  expect(screen.queryByRole("link", { name: "Index editor" })).toBeNull()
  expect(
    within(screen.getByRole("main")).getByText("Review content")
  ).toBeTruthy()
})

it("selects the only allowed queue without adding unauthorized categories", () => {
  render(
    <ModerationWorkspace views={[views[2]!]}>
      <p>Discussions</p>
    </ModerationWorkspace>
  )
  const rail = screen.getByRole("navigation", { name: "Review queues" })
  expect(
    within(rail)
      .getByRole("link", { name: "Discussions" })
      .getAttribute("aria-current")
  ).toBe("page")
  expect(
    within(rail).queryByRole("link", { name: "Library changes" })
  ).toBeNull()
  expect(
    within(rail).queryByRole("link", { name: "Suggested additions" })
  ).toBeNull()
})

it("moves page-supplied counts and filtered queue links into one navigation", () => {
  const filtered = views.map((view) =>
    view.id === "claims"
      ? {
          ...view,
          pending: 3,
          href: "/moderation?category=claims&status=needs_info&locale=fr",
        }
      : view
  )
  render(
    <ModerationWorkspace views={views}>
      <ModerationWorkspaceNav active="claims" views={filtered} />
    </ModerationWorkspace>
  )
  expect(
    screen.getAllByRole("navigation", { name: "Review queues" })
  ).toHaveLength(1)
  const claims = screen.getByRole("link", { name: "Claims 3" })
  expect(claims.getAttribute("href")).toBe(filtered[1]!.href)
  expect(claims.getAttribute("aria-current")).toBe("page")
})

it("clears a departing page's counts and uses a safe queue return on submission details", () => {
  const filtered = views.map((view) => ({ ...view, pending: 7 }))
  const view = render(
    <ModerationWorkspace views={views}>
      <ModerationWorkspaceNav active="libraries" views={filtered} />
    </ModerationWorkspace>
  )
  location.path = "/moderation/submission-1"
  location.search = `returnTo=${encodeURIComponent("/moderation?category=claims&locale=fr")}`
  view.rerender(
    <ModerationWorkspace views={views}>
      <p>Submission details</p>
    </ModerationWorkspace>
  )
  const claims = screen.getByRole("link", { name: "Claims" })
  expect(claims.getAttribute("aria-current")).toBe("page")
  expect(screen.queryByRole("link", { name: "Claims 7" })).toBeNull()
})
