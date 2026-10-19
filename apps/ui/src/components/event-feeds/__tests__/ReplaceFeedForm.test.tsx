// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fireEvent, render, screen, waitFor } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
// GlobalLink reads next-intl's navigation, which needs the app's routing.
vi.mock("@/lib/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children?: React.ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  formatHref: (href: string) => href,
  isAppLink: () => true,
  routing: { locales: ["cs", "en"], defaultLocale: "en" },
}))

import { ReplaceFeedForm } from "../ReplaceFeedForm"
import type { FeedView } from "../types"

const LIBRARY_ID = "lib00000000000000000001"
const FEED_ID = "feed0000000000000000001"

const FEED: FeedView = {
  documentId: FEED_ID,
  provider: "ticketsource",
  label: "TicketSource",
  scope: "library",
  status: "active",
  pausedReason: null,
  managedBy: "library",
  hints: {},
  pendingHints: null,
  review: null,
  lastTestedAt: null,
  lastTestResult: null,
  lastSyncAt: null,
  lastSyncStatus: null,
  lastErrorCode: null,
  upcomingEvents: 0,
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) =>
    url.endsWith("/test")
      ? Response.json({ data: { result: "ok" } }, { status: 200 })
      : Response.json({ data: { ok: true } }, { status: 200 })
  )
  vi.stubGlobal("fetch", fetchMock)
})

describe("ReplaceFeedForm", () => {
  it("tests with the library's documentId, not the feed's, and enables Send on a pass", async () => {
    render(
      <ReplaceFeedForm
        feed={FEED}
        libraryName="Central Library"
        libraryDocumentId={LIBRARY_ID}
        librarySlug="central-library"
      />
    )

    fireEvent.change(screen.getByLabelText(/API key/, { selector: "input" }), {
      target: { value: "ts_live_ABCDEFGHIJ" },
    })

    const sendButton = () =>
      screen.getByRole("button", {
        name: "Send for review",
      }) as HTMLButtonElement
    expect(sendButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() => expect(sendButton().disabled).toBe(false))

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("/api/contribute/event-feeds/test")
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.libraryDocumentId).toBe(LIBRARY_ID)
    expect(body.libraryDocumentId).not.toBe(FEED_ID)
  })

  it("clears the entered values after a successful send", async () => {
    render(
      <ReplaceFeedForm
        feed={FEED}
        libraryName="Central Library"
        libraryDocumentId={LIBRARY_ID}
        librarySlug="central-library"
      />
    )

    const input = screen.getByLabelText(/API key/, {
      selector: "input",
    }) as HTMLInputElement
    fireEvent.change(input, { target: { value: "ts_live_ABCDEFGHIJ" } })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Send for review",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    )

    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await waitFor(() =>
      expect(screen.getByText("New details sent for review")).toBeTruthy()
    )

    const putCall = fetchMock.mock.calls.find(([u]) =>
      (u as string).endsWith("/values")
    )
    expect(putCall).toBeTruthy()
    const [, putInit] = putCall!
    expect(JSON.parse((putInit as RequestInit).body as string)).toEqual({
      values: { apiKey: "ts_live_ABCDEFGHIJ" },
    })
  })
})
