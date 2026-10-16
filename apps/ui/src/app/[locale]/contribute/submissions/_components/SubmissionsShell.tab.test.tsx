// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

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
  fireEvent.click(screen.getByRole("tab", { name: "Articles and stories" }))
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/contribute/submissions?status=pending",
    { scroll: false }
  )
  navigation.query = "status=pending"
  view.rerender(tree())
  expect(screen.queryByText("Conversation work panel")).toBeNull()
  expect(screen.getByText("No submissions yet")).toBeTruthy()
  fireEvent.click(screen.getByRole("tab", { name: "Discussion contributions" }))
  expect(navigation.replace).toHaveBeenLastCalledWith(
    "/contribute/submissions?status=pending&tab=discussions",
    { scroll: false }
  )
  navigation.query = "tab=discussions"
  view.rerender(tree())
  expect(screen.getByText("Conversation work panel")).toBeTruthy()
})
