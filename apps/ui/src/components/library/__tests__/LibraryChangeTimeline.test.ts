// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  LibraryHistoryBatch,
  LibraryHistoryPage,
} from "@/lib/strapi-api/content/server"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const features = vi.hoisted(() => ({ list: [] as string[], ready: true }))

vi.mock("@/lib/access-client", () => ({
  useEntitlements: () => ({
    plan: features.list.length ? "pro" : "free",
    can: (f: string) => features.list.includes(f),
    ready: features.ready,
  }),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
  }
})

const { LibraryChangeTimeline } = await import("../LibraryChangeTimeline")
const { actorLabel, batchVerb } = await import("../change-history.helpers")

const DOC = "abcdefghijklmnopqrstuvwx"

function batch(over: Partial<LibraryHistoryBatch> = {}): LibraryHistoryBatch {
  return {
    batchId: "b1",
    changedAt: "2026-09-20T10:00:00.000Z",
    action: "update",
    source: "submission",
    actor: { kind: "contributor", username: "ada" },
    fields: [{ field: "website" }, { field: "phone" }],
    submissionDocumentId: null,
    ...over,
  }
}

const page = (
  data: LibraryHistoryBatch[],
  total = data.length
): LibraryHistoryPage => ({
  data,
  meta: { page: 1, pageSize: 20, total },
})

const fetchMock = vi.fn()

beforeEach(() => {
  features.list = []
  features.ready = true
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("LibraryChangeTimeline", () => {
  it("names the change, its fields, the contributor and the date", () => {
    const { container, getByText } = render(
      createElement(LibraryChangeTimeline, {
        documentId: DOC,
        initial: page([batch()]),
      })
    )
    expect(getByText("Changed")).toBeTruthy()
    expect(container.textContent).toContain("2 fields")
    expect(container.textContent).toContain("Website")
    expect(container.textContent).toContain("Phone")
    const link = getByText("@ada").closest("a")!
    expect(link.getAttribute("href")).toBe("/profile/ada")
    expect(container.querySelector("time")!.getAttribute("dateTime")).toBe(
      "2026-09-20T10:00:00.000Z"
    )
  })

  it("shows previous → next when the values came back", () => {
    features.list = ["library.history"]
    const { container, queryByText } = render(
      createElement(LibraryChangeTimeline, {
        documentId: DOC,
        initial: page([
          batch({
            fields: [
              {
                field: "website",
                previous: "http://old.example",
                next: "https://new.example",
              },
            ],
          }),
        ]),
      })
    )
    expect(container.textContent).toContain("http://old.example")
    expect(container.textContent).toContain("https://new.example")
    expect(container.querySelector("[data-previous]")!.textContent).toBe(
      "http://old.example"
    )
    expect(queryByText("See what changed, field by field, with Pro.")).toBe(
      null
    )
  })

  it("offers Pro, once, when values are absent and the viewer lacks the feature", () => {
    const { getAllByText, container } = render(
      createElement(LibraryChangeTimeline, {
        documentId: DOC,
        initial: page([batch(), batch({ batchId: "b2" })]),
      })
    )
    const lines = getAllByText("See what changed, field by field, with Pro.")
    expect(lines).toHaveLength(1)
    expect(lines[0]!.closest("a")!.getAttribute("href")).toBe(
      "/contribute/membership"
    )
    expect(container.querySelector("[data-previous]")).toBe(null)
  })

  it("reloads with values for a Pro viewer on a page rendered without them", async () => {
    features.list = ["library.history"]
    fetchMock.mockResolvedValue(
      Response.json(
        page([
          batch({ fields: [{ field: "website", previous: "a", next: "b" }] }),
        ])
      )
    )
    const { container } = render(
      createElement(LibraryChangeTimeline, {
        documentId: DOC,
        initial: page([batch({ fields: [{ field: "website" }] })]),
      })
    )
    await waitFor(() =>
      expect(container.querySelector("[data-next]")?.textContent).toBe("b")
    )
    expect(container.querySelector("[data-previous]")!.textContent).toBe("a")
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/libraries/${DOC}/history?page=1`
    )
  })

  it("loads older changes from the history route", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: [batch({ batchId: "b2", fields: [{ field: "email" }] })],
        meta: { page: 2, pageSize: 20, total: 21 },
      })
    )
    const { getByRole, container } = render(
      createElement(LibraryChangeTimeline, {
        documentId: DOC,
        initial: page([batch()], 21),
      })
    )
    fireEvent.click(getByRole("button", { name: /older changes/i }))
    await waitFor(() => expect(container.textContent).toContain("Email"))
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `/api/libraries/${DOC}/history?page=2`
    )
  })

  it("says so honestly when nothing has been recorded", () => {
    const { getByText } = render(
      createElement(LibraryChangeTimeline, {
        documentId: DOC,
        initial: page([]),
      })
    )
    expect(getByText("No changes recorded yet.")).toBeTruthy()
  })
})

describe("actorLabel", () => {
  const b = (kind: string, username: string | null, source = "submission") =>
    batch({ actor: { kind, username }, source })

  it("links a public contributor and anonymises the rest", () => {
    expect(actorLabel(b("contributor", "ada"))).toEqual({
      text: "@ada",
      href: "/profile/ada",
    })
    expect(actorLabel(b("contributor", null))).toEqual({
      text: "A contributor",
    })
  })

  it("names staff and imports by kind", () => {
    expect(actorLabel(b("admin", null, "admin"))).toEqual({
      text: "Libraries Global staff",
    })
    expect(actorLabel(b("token", null, "import"))).toEqual({
      text: "Data import",
    })
    expect(actorLabel(b("system", null, "import"))).toEqual({
      text: "Data import",
    })
  })
})

describe("batchVerb", () => {
  it.each([
    ["create", "submission", "Added"],
    ["update", "submission", "Changed"],
    ["publish", "admin", "Published"],
    ["update", "import", "Imported"],
    ["create", "import", "Imported"],
  ])("%s from %s reads %s", (action, source, verb) => {
    expect(batchVerb(batch({ action, source })).verb).toBe(verb)
  })
})
