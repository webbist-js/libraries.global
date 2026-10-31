// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { EMPTY_FORM } from "@/components/library-editor/wizard.types"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

const mocks = vi.hoisted(() => ({
  user: "account-a" as string | null,
  rows: [] as Record<string, unknown>[],
  fetch: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: mocks.user ? { user: { id: mocks.user } } : null,
    isPending: false,
  }),
}))
vi.mock("@/hooks/useSubmissions", () => ({
  useMySubmissions: () => ({
    data: mocks.rows,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}))
vi.mock("@/components/library-editor/IndexRecordWizard", () => ({
  IndexRecordWizard: () => <p>Shared record editor</p>,
}))
vi.mock("@/components/library/LibraryContributionReview", () => ({
  LibraryContributionReview: () => null,
}))
const { LibraryContributionEditor } =
  await import("../LibraryContributionEditor")
const row = {
  documentId: "my-submission",
  targetSlug: "library",
  submissionType: "correction",
  locale: "en",
  status: "needs_info",
  editSummary: "My proposal",
  reviewNote: "Private reviewer feedback",
  updatedAt: "2026-10-30T12:00:00Z",
  fields: { name: "Proposal" },
  draftData: { name: "Proposal" },
}
const bootstrap = {
  target: { name: "Library" },
  initialData: EMPTY_FORM,
  locale: { code: "en", defaultCode: "en", languageName: "English" },
  staffHref: null,
}
beforeEach(() => {
  mocks.user = "account-a"
  mocks.rows = [row]
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockImplementation(async (url: string) =>
    Response.json({ data: url.includes("/editor") ? bootstrap : [row] })
  )
})
afterEach(cleanup)
function setup() {
  const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
    close = vi.fn(),
    state = vi.fn()
  const ui = () => (
    <QueryClientProvider client={client}>
      <LibraryContributionEditor
        slug="library"
        path="/library"
        onState={state}
        onClose={close}
      />
    </QueryClientProvider>
  )

  return { ui, client, close, ...render(ui()) }
}
it("destroys a previous account's selected contribution on account changes", async () => {
  const view = setup()
  fireEvent.click(
    await screen.findByRole("button", { name: /Needs changes My proposal/ })
  )
  expect(await screen.findByText("Private reviewer feedback")).toBeTruthy()
  mocks.user = "account-b"
  mocks.rows = []
  view.rerender(view.ui())
  await waitFor(() =>
    expect(screen.queryByText("Private reviewer feedback")).toBeNull()
  )
  expect(await screen.findByText("Shared record editor")).toBeTruthy()
  view.client.clear()
})
it("shows submitted outcomes read-only and refreshes the public record on return after acceptance", async () => {
  mocks.rows = [{ ...row, status: "pending" }]
  let status = "pending"
  mocks.fetch.mockImplementation(async (url: string) =>
    Response.json({
      data: url.includes("/editor")
        ? bootstrap
        : [{ ...row, status, updatedAt: "2026-10-30T14:00:00Z" }],
    })
  )
  const view = setup()
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Submitted for review My proposal/,
    })
  )
  await screen.findByRole("button", { name: "Refresh status" })
  expect(screen.queryByText("Continue your changes")).toBeNull()
  status = "approved"
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("Accepted")
  fireEvent.click(screen.getByRole("button", { name: "Back to library" }))
  expect(mocks.refresh).toHaveBeenCalled()
  expect(view.close).toHaveBeenCalled()
  view.client.clear()
})
