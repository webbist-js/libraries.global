// @vitest-environment happy-dom
import {
  DesignSystemProvider,
  lightTheme,
  darkTheme,
} from "@strapi/design-system"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock("@strapi/strapi/admin", () => ({
  useAuth: (_name: string, selector: (state: unknown) => unknown) =>
    selector({ isLoading: false, user: { id: 1 }, permissions: [] }),
  useRBAC: () => ({
    allowedActions: { canRead: true, canAward: true },
    isLoading: false,
  }),
  useFetchClient: () => mocks,
  Layouts: {
    Root: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Header: ({ title }: { title: string }) => <h1>{title}</h1>,
    Content: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
  Page: {
    Main: ({ children }: { children: React.ReactNode }) => (
      <main id="main-content">{children}</main>
    ),
    Loading: () => <p>Checking permissions</p>,
    NoPermissions: () => <p>No permission</p>,
    Error: () => <p>Permission error</p>,
  },
}))
import { RewardsDashboard } from "../../src/plugins/rewards/admin/src/pages/RewardsDashboard"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockImplementation(async (path: string) => {
    if (path.includes("/events?"))
      return {
        data: {
          data: [
            {
              id: 1,
              baUserId: "reader-1",
              action: "manual_award",
              points: 5,
              awardedAt: "2026-10-20T10:00:00Z",
              metadata: null,
            },
          ],
          meta: { total: 121, page: 1, limit: 50 },
        },
      }
    if (path.endsWith("/stats"))
      return { data: { data: { totalContributors: 2, pointsThisMonth: 40 } } }

    return { data: { data: { dailyPoints: [], actionBreakdown: [] } } }
  })
})
afterEach(cleanup)
it.each([lightTheme, darkTheme])(
  "retains history totals and loads later pages in either theme",
  async (theme) => {
    render(
      <DesignSystemProvider theme={theme}>
        <RewardsDashboard />
      </DesignSystemProvider>
    )
    await screen.findByText("121 point events")
    expect(screen.getByText("Page 1 of 3")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/rewards/events?page=2",
        expect.anything()
      )
    )
  }
)
it("shows unavailable history with retry instead of claiming no events", async () => {
  mocks.get.mockRejectedValue(new Error("offline"))
  render(
    <DesignSystemProvider theme={lightTheme}>
      <RewardsDashboard />
    </DesignSystemProvider>
  )
  await screen.findAllByRole("alert")
  expect(screen.queryByText("No points have been awarded yet.")).toBeNull()
  expect(
    screen.getAllByRole("button", { name: "Try again" }).length
  ).toBeGreaterThan(0)
})
