// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
// FeedRow pulls `Notice` from the `@/components/ds` barrel, which eagerly
// loads every other DS component (PageHero, SearchField, ...) and, through
// them, next-intl's navigation — more than this test's module graph needs
// and prone to resolution issues outside a full Next.js runtime. Stub the
// one export FeedRow actually uses instead of the whole barrel.
vi.mock("@/components/ds", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Notice: ({ title, children }: any) => (
    <div role="status">
      <p>{title}</p>
      {children}
    </div>
  ),
  NOTICE_TONES: {
    ok: { bg: "#E6EFE6", fg: "#2F5D3A" },
    info: { bg: "#ECEBFB", fg: "#3730A3" },
    warn: { bg: "#F5EEDC", fg: "#6B5420" },
  },
}))

import { FeedRow } from "../FeedRow"
import type { FeedView } from "../types"

const BASE: FeedView = {
  documentId: "feed0000000000000000001",
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

describe("FeedRow", () => {
  it("shows Replace details for an active feed with no pending review", () => {
    render(<FeedRow feed={BASE} libraryName="Central Library" />)
    expect(screen.getByText("Replace details")).toBeTruthy()
  })

  it("hides Replace details while a replacement's review is pending", () => {
    const feed: FeedView = {
      ...BASE,
      pendingHints: { apiKey: "••••6789" },
      review: {
        submissionDocumentId: "sub1",
        kind: "replace",
        status: "pending",
        note: null,
      },
    }
    render(<FeedRow feed={feed} libraryName="Central Library" />)
    expect(screen.queryByText("Replace details")).toBeNull()
  })

  it("hides Replace details while a replacement needs changes", () => {
    const feed: FeedView = {
      ...BASE,
      status: "paused",
      pausedReason: "library",
      pendingHints: { apiKey: "••••6789" },
      review: {
        submissionDocumentId: "sub1",
        kind: "replace",
        status: "needs_info",
        note: "Try a different key.",
      },
    }
    render(<FeedRow feed={feed} libraryName="Central Library" />)
    expect(screen.queryByText("Replace details")).toBeNull()
  })
})
