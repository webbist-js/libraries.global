// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"
import type {
  LibraryHistoryBatch,
  LibraryHistoryPage,
  LibraryHistoryStats,
} from "@/lib/strapi-api/content/server"
import { cleanup, render, screen } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/access-client", () => ({
  useEntitlements: () => ({ ready: true, can: () => false }),
}))
vi.mock("@/components/library/LibraryCorrection", async () => {
  const { createElement: h } = await import("react")
  const link = ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => h("a", { href: "#suggest", className }, children)

  return { OpenCorrectionLink: link, OpenVerifyLink: link }
})
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    formatHref: (href: string) => href,
    isAppLink: () => true,
  }
})
vi.mock("@/components/library/LibraryHoursTable", () => ({
  LibraryHoursTable: () => null,
}))
vi.mock("@/components/library/LibraryCopyButton", () => ({
  LibraryCopyButton: () => null,
}))

const { LibraryChangesSection } = await import("../LibrarySections")
afterEach(cleanup)

const credit = {
  key: "libraryon",
  name: "LibraryOn",
  publisher: "The British Library",
  sourceUrl: "https://libraryon.org",
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  attribution:
    "Contains information from LibraryOn, published by the British Library under CC BY 4.0.",
} as DatasetRecord
const origin = {
  role: "origin",
  dataset: "libraryon",
  recordId: "LIB-1",
  retrievedAt: "2026-10-04",
  url: "https://libraryon.org/library/1",
}
const library = {
  documentId: "library",
  slug: "library",
  createdAt: "2026-10-04T12:00:00.000Z",
  sourceRecords: [origin],
} as never
const imported: LibraryHistoryBatch = {
  batchId: "initial",
  changedAt: "2026-10-04T12:00:00.000Z",
  action: "create",
  source: "import",
  actor: { kind: "system", username: null },
  fields: [{ field: "*" }],
  submissionDocumentId: null,
}
const edit: LibraryHistoryBatch = {
  batchId: "edit",
  changedAt: "2026-10-10T12:00:00.000Z",
  action: "update",
  source: "submission",
  actor: { kind: "contributor", username: "ada" },
  fields: [{ field: "website" }],
  submissionDocumentId: "submission",
}
const page = (
  data: LibraryHistoryBatch[],
  total = data.length
): LibraryHistoryPage => ({ data, meta: { page: 1, pageSize: 20, total } })
const stats = (counts: number[]): LibraryHistoryStats => ({
  months: counts.map((batches, i) => ({
    month: `2026-${String(i + 8).padStart(2, "0")}`,
    batches,
    fields: batches,
    contributors: 0,
  })),
  byField: [
    { field: "*", count: 1 },
    { field: "website", count: 2 },
  ],
  byAction: [],
  verificationEvents: [],
})

function show(
  history: LibraryHistoryPage | null,
  activity = stats([0, 0, 1]),
  record = library,
  datasets = [credit]
) {
  return render(
    createElement(LibraryChangesSection, {
      library: record,
      history,
      stats: activity,
      datasets,
    })
  )
}

describe("LibraryChangesSection", () => {
  it("shows credits once and keeps import-only records free of a chart, duplicate timeline and Pro upsell", () => {
    const { container } = show(page([imported]))
    expect(screen.getAllByText(credit.attribution!)).toHaveLength(1)
    expect(screen.getAllByText("Imported Oct 4, 2026")).toHaveLength(1)
    expect(screen.getAllByText("Not yet checked")).toHaveLength(1)
    expect(screen.getByText("No changes since import.")).toBeTruthy()
    expect(screen.queryByText("Record created")).toBeNull()
    expect(screen.queryByText("Activity over time")).toBeNull()
    expect(screen.queryByText("Recent changes")).toBeNull()
    expect(
      screen.queryByText(
        "See what changed, field by field, with Supporter or Pro."
      )
    ).toBeNull()
    expect(container.querySelector('svg[role="img"]')).toBeNull()
    expect(screen.getByText("LIB-1").closest("details")?.open).toBe(false)
    expect(
      screen.getByText("CC BY 4.0").closest("a")?.getAttribute("href")
    ).toBe(credit.licenceUrl)
  })

  it("keeps every reference and its supported facts while crediting a shared dataset once", () => {
    const other = {
      ...origin,
      recordId: "LIB-2",
      url: "https://libraryon.org/library/2",
    }
    const reference = {
      role: "reference",
      label: "Library opening hours",
      url: "https://library.example/hours",
      fields: ["openingTimes"],
    }
    show(page([imported]), stats([]), {
      ...(library as object),
      sourceRecords: [reference, origin, other],
    } as never)
    expect(screen.getAllByText(credit.attribution!)).toHaveLength(1)
    expect(
      screen
        .getAllByText("LibraryOn")
        .map((el) => el.closest("a")?.getAttribute("href"))
    ).toEqual([origin.url, other.url])
    expect(
      screen
        .getByText("Library opening hours")
        .closest("a")
        ?.getAttribute("href")
    ).toBe(reference.url)
    expect(screen.getByText("Opening hours")).toBeTruthy()
    expect(screen.getByText("LIB-2")).toBeTruthy()
    expect(
      screen.getByText("Imported Oct 4, 2026").closest("li")?.textContent
    ).toContain("LIB-1")
  })

  it("shows a real change without repeating the creation row, and keeps a quiet chart hidden", () => {
    show(page([edit, imported]), stats([0, 0, 1]))
    expect(screen.getByText("Recent changes")).toBeTruthy()
    expect(screen.getByText("Website updated")).toBeTruthy()
    expect(screen.getByText("@ada")).toBeTruthy()
    expect(screen.queryByText("Record created")).toBeNull()
    expect(screen.queryByText("No changes since import.")).toBeNull()
    expect(screen.queryByText("Activity over time")).toBeNull()
  })

  it("offers the activity chart on demand when there are changes across several months", () => {
    show(page([edit, imported]), stats([1, 0, 2]), {
      ...(library as object),
      lastVerifiedAt: "2026-10-10T12:00:00.000Z",
    } as never)
    expect(
      screen.getByText("Activity over time").closest("details")?.open
    ).toBe(false)
    expect(screen.getByText("Most often updated")).toBeTruthy()
    expect(screen.queryByText("* · 1")).toBeNull()
    expect(screen.getByText("Last checked Oct 10, 2026")).toBeTruthy()
    expect(screen.queryByText("Not yet checked")).toBeNull()
  })

  it("retains source credits if history cannot be loaded", () => {
    show(null)
    expect(screen.getByText(credit.attribution!)).toBeTruthy()
    expect(
      screen.getByText("Change history is temporarily unavailable.")
    ).toBeTruthy()
    expect(screen.queryByText("No changes since import.")).toBeNull()
  })
})
