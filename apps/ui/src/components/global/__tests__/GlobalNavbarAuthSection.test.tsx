// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { GlobalNavbarAuthSection } from "../GlobalNavbarAuthSection"

const actor = vi.hoisted(() => ({
  data: { user: { id: "a", name: "A" } } as {
    user: { id: string; name: string }
  } | null,
  isPending: false,
  error: null as object | null,
  refresh: vi.fn(),
}))
vi.mock("@/lib/access-client", () => ({ useHydratedSession: () => actor }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
  useRouter: () => ({ refresh: actor.refresh }),
}))
vi.mock("@/components/profile/ProfileDrawerTrigger", () => ({
  ProfileDrawerTrigger: ({ user, profileSnippet }: any) => (
    <div>
      {user.name}
      {profileSnippet?.username ? `:${profileSnippet.username}` : ""}
    </div>
  ),
}))
afterEach(() => {
  cleanup()
  actor.data = { user: { id: "a", name: "A" } }
  actor.isPending = false
  actor.error = null
  actor.refresh.mockClear()
})
it("never carries A's profile snippet into B's profile trigger or keeps SSR A after hydrated sign-out", () => {
  const props = {
    sessionSSR: { user: { id: "a", name: "A" } },
    profileSnippet: { username: "private-a" },
  }
  const view = render(<GlobalNavbarAuthSection {...(props as any)} />)
  expect(screen.getByText("A:private-a")).toBeTruthy()
  actor.isPending = true
  view.rerender(<GlobalNavbarAuthSection {...(props as any)} />)
  expect(screen.queryByText("A:private-a")).toBeNull()
  actor.isPending = false
  actor.data = { user: { id: "b", name: "B" } }
  view.rerender(<GlobalNavbarAuthSection {...(props as any)} />)
  expect(screen.getByText("B")).toBeTruthy()
  expect(screen.queryByText(/private-a/)).toBeNull()
  expect(actor.refresh).toHaveBeenCalledTimes(1)
  actor.data = null
  view.rerender(<GlobalNavbarAuthSection {...(props as any)} />)
  expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy()
  expect(screen.queryByText("A:private-a")).toBeNull()
})
it("hides private SSR menu on auth network failure and does not interpret failure as sign-out", () => {
  actor.error = { message: "offline" }
  render(
    <GlobalNavbarAuthSection
      sessionSSR={{ user: { id: "a", name: "A" } } as any}
      profileSnippet={{ username: "private-a" }}
    />
  )
  expect(screen.queryByText(/private-a/)).toBeNull()
  expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull()
  expect(actor.refresh).not.toHaveBeenCalled()
})
