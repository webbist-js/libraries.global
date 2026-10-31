// @vitest-environment happy-dom
import type { ComponentProps } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { RecordToolbar } from "./RecordToolbar"

const session = vi.hoisted(() => ({
  signedIn: true,
  pending: false,
  error: null as Error | null,
  pathname: "/libraries",
}))
const sharing = vi.hoisted(() => ({ capture: vi.fn(), complete: vi.fn() }))
vi.mock("@/lib/analytics-events", () => ({
  captureAnalyticsEvent: sharing.capture,
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: session.signedIn ? { user: { id: "reader" } } : null,
    isPending: session.pending,
    error: session.error,
  }),
}))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => session.pathname,
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}))
vi.mock("@/components/ds/Breadcrumb", () => ({
  Breadcrumb: () => <nav aria-label="Breadcrumb" />,
}))
vi.mock("@/components/global/SiteSearch", () => ({
  SiteSearchTrigger: () => <button>Site search</button>,
}))
vi.mock("@/components/elementary/LocaleSwitcher", () => ({
  default: ({ locale }: { locale: string }) => (
    <button aria-label="Language">{locale}</button>
  ),
}))

const writeText = vi.fn()
beforeEach(() => {
  session.signedIn = true
  session.pending = false
  session.error = null
  session.pathname = "/libraries"
  writeText.mockReset().mockResolvedValue(undefined)
  sharing.complete.mockReset()
  sharing.capture.mockReset().mockReturnValue(sharing.complete)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
})
afterEach(cleanup)

it("keeps search and breadcrumbs while preferences and account actions live in navigation", () => {
  render(<RecordToolbar />)
  expect(screen.getByRole("button", { name: "Site search" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Feedback" })).toBeTruthy()
  expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Language" })).toBeNull()
  expect(screen.queryByRole("link", { name: "Sign out" })).toBeNull()
  expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull()
})

it.each(["/", "/about"])(
  "omits the entire content toolbar on %s",
  (pathname) => {
    session.pathname = pathname
    const { container } = render(<RecordToolbar items={[{ label: "Home" }]} />)
    expect(container.querySelector(".record-toolbar")).toBeNull()
    expect(screen.queryByRole("button", { name: "Site search" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Language" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Sign out" })).toBeNull()
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull()
  }
)

it("keeps sharing explicitly enabled for article readers and copies the live URL", async () => {
  render(<RecordToolbar share />)
  fireEvent.click(screen.getByRole("button", { name: "Share" }))
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  )
  expect(screen.queryByRole("link", { name: "Sign out" })).toBeNull()
})

it("records an article-header share only after the copy succeeds", async () => {
  render(
    <RecordToolbar
      share
      shareContent={{ contentType: "knowledge", contentId: "public_article" }}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Share" }))
  await waitFor(() => expect(sharing.complete).toHaveBeenCalledTimes(1))
  expect(sharing.capture).toHaveBeenCalledWith("share", {
    interaction_source: "article_share",
    method: "copy",
    content_type: "knowledge",
    content_id: "public_article",
  })
})
it("does not record a failed header share", async () => {
  writeText.mockRejectedValue(new Error("Clipboard unavailable"))
  render(
    <RecordToolbar
      share
      shareContent={{ contentType: "journal", contentId: "public_article" }}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Share" }))
  await screen.findByRole("button", { name: "Couldn’t copy link" })
  expect(sharing.complete).not.toHaveBeenCalled()
})
