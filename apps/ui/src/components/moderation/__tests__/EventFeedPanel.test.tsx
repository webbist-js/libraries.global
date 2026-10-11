// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"

import { render, screen } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { EventFeedPanel } = await import("../EventFeedPanel")

const review = {
  credentialDocumentId: "cred00000000000000000001",
  exists: true,
  status: "pending",
  kind: "connect",
  provider: "ical",
  library: { documentId: "lib1", name: "Central Library", slug: "central" },
  currentHints: {},
  newHints: { feedUrl: "https://cal.example.org/…" },
  submittedTest: { result: "ok", testedAt: "2026-10-06T09:00:00Z" },
  latestTest: { result: "auth_failed", testedAt: "2026-10-06T11:00:00Z" },
  submitterHoldsClaim: false,
}

describe("EventFeedPanel", () => {
  it("shows both test results as text, the hints and a lost-claim warning", () => {
    render(
      createElement(EventFeedPanel, {
        documentId: "sub1",
        status: "pending",
        review: review as any,
      })
    )
    expect(screen.getByText(/Passed/)).toBeTruthy()
    expect(screen.getByText(/Sign-in refused/)).toBeTruthy()
    expect(screen.getByText("https://cal.example.org/…")).toBeTruthy()
    expect(screen.getByText(/no longer holds a claim/)).toBeTruthy()
  })

  it("shows a fallback when the review couldn't be loaded", () => {
    render(
      createElement(EventFeedPanel, {
        documentId: "sub1",
        status: "pending",
        review: null,
      })
    )
    expect(screen.getByText(/could not be loaded/)).toBeTruthy()
  })
})
