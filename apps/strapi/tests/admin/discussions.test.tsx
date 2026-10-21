// @vitest-environment happy-dom
import {
  DesignSystemProvider,
  darkTheme,
  lightTheme,
} from "@strapi/design-system"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  review: true,
}))
vi.mock("@strapi/strapi/admin", () => ({
  useAuth: (_name: string, selector: (value: unknown) => unknown) =>
    selector({ isLoading: false, user: { id: 1 }, permissions: [] }),
  useFetchClient: () => mocks,
  useRBAC: () => ({
    isLoading: false,
    allowedActions: {
      canRead: true,
      canReview: mocks.review,
      canManage: false,
      canSanction: false,
    },
  }),
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
    Loading: () => <p>Loading</p>,
    Error: () => <p>Unavailable</p>,
    NoPermissions: () => <p>No permission</p>,
  },
}))
import Review from "../../../../packages/strapi-plugin-discussions/admin/Review"

beforeEach(() => {
  mocks.review = true
  mocks.get.mockImplementation(async (url: string) => ({
    data: {
      data: url.startsWith("/discussions/revisions?")
        ? [
            {
              id: "revision-1",
              recordId: "post-1",
              recordType: "post",
              threadId: "thread-1",
              threadTitle: "Synthetic proposal",
              threadVersion: 1,
              body: "Proposed revision body",
              previousBody: "Original body",
              baseVersion: 1,
              currentVersion: 1,
              author: { name: "Fixture contributor" },
            },
          ]
        : url.startsWith("/discussions/reports?")
          ? [
              {
                id: "report-1",
                recordId: "post-2",
                recordType: "post",
                reason: "Synthetic report",
                version: 1,
                recordVersion: 1,
                currentVersion: 1,
                reportedBody: "Reported fixture body",
                currentBody: "Current fixture body",
              },
            ]
          : [],
      nextOffset: null,
    },
  }))
})
afterEach(cleanup)
it.each([lightTheme, darkTheme])(
  "keeps review notes scoped to each record when changing tabs in either theme",
  async (theme) => {
    render(
      <DesignSystemProvider theme={theme}>
        <Review />
      </DesignSystemProvider>
    )
    await screen.findByText("Proposed revision body")
    fireEvent.change(screen.getByLabelText("Private review note"), {
      target: { value: "Note for proposal only" },
    })
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: "Reports", exact: true }),
      { button: 0, ctrlKey: false }
    )
    await screen.findByText("Reported fixture body")
    expect(
      (screen.getByLabelText("Private review note") as HTMLTextAreaElement)
        .value
    ).toBe("")
    fireEvent.change(screen.getByLabelText("Private review note"), {
      target: { value: "Note for report only" },
    })
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: "Revisions", exact: true }),
      { button: 0, ctrlKey: false }
    )
    expect(
      (screen.getByLabelText("Private review note") as HTMLTextAreaElement)
        .value
    ).toBe("Note for proposal only")
  }
)
it("does not offer review actions to a read-only admin", async () => {
  mocks.review = false
  render(
    <DesignSystemProvider theme={lightTheme}>
      <Review />
    </DesignSystemProvider>
  )
  await screen.findByText("Proposed revision body")
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
  expect(screen.queryByLabelText("Private review note")).toBeNull()
})
