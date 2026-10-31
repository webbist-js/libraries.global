// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { closeProfileDrawer, useProfileDrawer } from "@/lib/profile-drawer"
import { cleanup, fireEvent, render, screen } from "@/test/render"

import { AccountAwareLink } from "./AccountAwareLink"

const state = vi.hoisted(() => ({
  signedIn: true,
  navigated: vi.fn(),
  pathname: "/europe",
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: state.signedIn
      ? { user: { id: "reader", username: "reader" } }
      : null,
  }),
}))
vi.mock("@/lib/navigation-core", () => ({
  usePathname: () => state.pathname,
  NavigationLink: ({
    onNavigate,
    transitionTypes,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    onNavigate?: (event: { preventDefault: () => void }) => void
    transitionTypes?: string[]
  }) => (
    <a
      {...props}
      data-transition-types={transitionTypes?.join(",")}
      onClick={(event) => {
        props.onClick?.(event)
        event.preventDefault()
        let prevented = false
        onNavigate?.({
          preventDefault: () => {
            prevented = true
          },
        })
        if (!prevented) state.navigated(props.href)
      }}
    />
  ),
}))
function State() {
  const state = useProfileDrawer()

  return (
    <output>
      {state.open
        ? `${state.actor}:${state.section}:${state.anchor ?? ""}`
        : "closed"}
    </output>
  )
}
afterEach(() => {
  cleanup()
  closeProfileDrawer(true)
  state.signedIn = true
  state.pathname = "/europe"
  state.navigated.mockClear()
  vi.restoreAllMocks()
})

it("opens private account sections over the current page and gives native links a drawer entry URL", () => {
  const dispatch = vi.spyOn(window, "dispatchEvent")
  render(
    <>
      <AccountAwareLink href="/profile/settings#privacy">
        Settings
      </AccountAwareLink>
      <State />
    </>
  )
  const link = screen.getByRole("link")
  expect(link.getAttribute("href")).toBe("/map?account=settings#privacy")
  fireEvent.click(link)
  expect(screen.getByText("reader:settings:privacy")).toBeTruthy()
  expect(state.navigated).not.toHaveBeenCalled()
  expect(
    dispatch.mock.calls.filter(
      ([event]) => event.type === "dashboard-before-navigation"
    )
  ).toHaveLength(0)
})
it("distinguishes own profile actions from an explicit public profile and other people's profiles", () => {
  render(
    <>
      <AccountAwareLink href="/profile/reader">Mine</AccountAwareLink>
      <AccountAwareLink publicProfile href="/profile/reader">
        Public profile
      </AccountAwareLink>
      <AccountAwareLink href="/profile/other">Other</AccountAwareLink>
      <State />
    </>
  )
  fireEvent.click(screen.getByText("Mine"))
  expect(screen.getByText("reader:overview:")).toBeTruthy()
  fireEvent.click(screen.getByText("Public profile"))
  fireEvent.click(screen.getByText("Other"))
  expect(state.navigated.mock.calls).toEqual([
    ["/profile/reader"],
    ["/profile/other"],
  ])
})
it("lets a signed-out account link reach the authenticated drawer entry flow", () => {
  state.signedIn = false
  render(
    <>
      <AccountAwareLink href="/profile/membership">Membership</AccountAwareLink>
      <State />
    </>
  )
  fireEvent.click(screen.getByText("Membership"))
  expect(state.navigated).toHaveBeenCalledWith("/map?account=membership")
  expect(screen.getByText("closed")).toBeTruthy()
})

it("announces accepted route changes for URL-sync cancellation and keeps canceled actions silent", () => {
  const dispatch = vi.spyOn(window, "dispatchEvent")
  render(
    <>
      <AccountAwareLink
        href="/journal"
        onNavigate={(event) => event.preventDefault()}
      >
        Canceled
      </AccountAwareLink>
      <AccountAwareLink href="/journal">Accepted</AccountAwareLink>
    </>
  )
  fireEvent.click(screen.getByText("Canceled"))
  expect(
    dispatch.mock.calls.filter(
      ([event]) => event.type === "dashboard-before-navigation"
    )
  ).toHaveLength(0)
  fireEvent.click(screen.getByText("Accepted"))
  const events = dispatch.mock.calls
    .map(([event]) => event)
    .filter((event) => event.type === "dashboard-before-navigation")
  expect(events).toHaveLength(1)
  expect((events[0] as CustomEvent).detail).toEqual({ href: "/journal" })
})

it("follows visible sidebar order with keyboard and touch intent", () => {
  state.pathname = "/staff/teams/api"
  render(
    <nav>
      <AccountAwareLink href="/staff/teams/billing">Billing</AccountAwareLink>
      <AccountAwareLink href="/staff/teams/api">API</AccountAwareLink>
      <AccountAwareLink href="/staff/teams/members">Members</AccountAwareLink>
    </nav>
  )
  const billing = screen.getByText("Billing"),
    members = screen.getByText("Members")
  fireEvent.focus(billing)
  expect(billing.dataset.transitionTypes).toBe("section-back")
  fireEvent.pointerDown(members)
  expect(members.dataset.transitionTypes).toBe("section-forward")
})
