// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"

import { act, cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { SubmissionsShell } from "./SubmissionsShell"

const navigation = vi.hoisted(() => ({
  query: "tab=discussions&status=pending",
  replace: vi.fn(),
  refetch: vi.fn(),
}))
// Iconify loads remote SVGs; this interaction test exercises tabs, not the icon CDN.
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  usePathname: () => "/contribute/submissions",
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
  formatHref: (href: string) => href,
  isAppLink: () => true,
  usePathname: () => "/contribute/submissions",
  useRouter: () => ({ replace: navigation.replace }),
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: "author" } },
    isPending: false,
  }),
  useCapabilities: () => ({ ready: true, has: () => false }),
}))
vi.mock("@/hooks/useSubmissions", () => ({
  useMySubmissions: () => ({
    data: [],
    isLoading: false,
    refetch: navigation.refetch,
  }),
}))
vi.mock("./DiscussionWork", () => ({
  DiscussionWork: () => <p>Conversation work panel</p>,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  navigation.query = "tab=discussions&status=pending"
})
it("opens linked discussion work, changes only the tab query, and follows browser navigation", () => {
  const client = new QueryClient()
  const tree = () => (
    <QueryClientProvider client={client}>
      <SubmissionsShell username={null} />
    </QueryClientProvider>
  )
  const view = render(tree())
  expect(screen.getByText("Conversation work panel")).toBeTruthy()
  fireEvent.mouseDown(
    screen.getByRole("tab", { name: "Articles and stories" }),
    { button: 0, ctrlKey: false }
  )
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/contribute/submissions?status=pending",
    { scroll: false }
  )
  navigation.query = "status=pending"
  view.rerender(tree())
  expect(screen.queryByText("Conversation work panel")).toBeNull()
  expect(screen.getByText("No submissions yet")).toBeTruthy()
  fireEvent.mouseDown(
    screen.getByRole("tab", { name: "Discussion contributions" }),
    { button: 0, ctrlKey: false }
  )
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/contribute/submissions?status=pending&tab=discussions",
    { scroll: false }
  )
  navigation.query = "tab=discussions"
  view.rerender(tree())
  expect(screen.getByText("Conversation work panel")).toBeTruthy()
})

it("uses roving keyboard focus and labelled panels, unmounting the inactive private content", async () => {
  const client = new QueryClient()
  const tree = () => (
    <QueryClientProvider client={client}>
      <SubmissionsShell username={null} />
    </QueryClientProvider>
  )
  const view = render(tree())
  const articles = screen.getByRole("tab", { name: "Articles and stories" })
  const discussions = screen.getByRole("tab", {
    name: "Discussion contributions",
  })
  const discussionPanel = screen.getByRole("tabpanel", {
    name: "Discussion contributions",
  })
  expect(discussions.getAttribute("aria-controls")).toBe(discussionPanel.id)
  expect(discussionPanel.getAttribute("aria-labelledby")).toBe(discussions.id)
  expect(
    screen.queryByRole("tabpanel", { name: "Articles and stories" })
  ).toBeNull()
  expect(screen.queryByText("No submissions yet")).toBeNull()
  act(() => discussions.focus())
  expect(discussions.tabIndex).toBe(0)
  expect(articles.tabIndex).toBe(-1)
  fireEvent.keyDown(discussions, { key: "ArrowLeft" })
  await waitFor(() => expect(document.activeElement).toBe(articles))
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/contribute/submissions?status=pending",
    { scroll: false }
  )
  navigation.query = "status=pending"
  view.rerender(tree())
  const articlePanel = screen.getByRole("tabpanel", {
    name: "Articles and stories",
  })
  expect(articles.getAttribute("aria-selected")).toBe("true")
  expect(articles.getAttribute("aria-controls")).toBe(articlePanel.id)
  expect(articlePanel.getAttribute("aria-labelledby")).toBe(articles.id)
  expect(screen.queryByText("Conversation work panel")).toBeNull()
  expect(articles.tabIndex).toBe(0)
  expect(discussions.tabIndex).toBe(-1)
  fireEvent.keyDown(articles, { key: "End" })
  await waitFor(() => expect(document.activeElement).toBe(discussions))
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/contribute/submissions?status=pending&tab=discussions",
    { scroll: false }
  )
})
