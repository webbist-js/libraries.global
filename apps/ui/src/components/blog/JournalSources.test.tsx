// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { JournalSources } from "./JournalSources"

afterEach(cleanup)
describe("managed Journal sources", () => {
  it("renders curated citations in order with optional print-only references", () => {
    render(
      <JournalSources
        sources={[
          {
            title: "Annual report",
            url: "https://example.org/report",
            publisher: "Library",
            accessedAt: "2026-10-28",
            notes: "Tables 2–4",
          },
          { title: "Printed catalogue", notes: "Page 42" },
        ]}
      />
    )
    expect(screen.getByRole("region", { name: "Sources" })).toBeTruthy()
    const link = screen.getByRole("link", { name: "Annual report ↗" })
    expect(link.getAttribute("href")).toBe("https://example.org/report")
    expect(link.getAttribute("rel")).toContain("noopener")
    expect(screen.getByText("Printed catalogue")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Printed catalogue" })).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })
  it("does not scrape body links, render an empty panel, or link unsafe legacy URLs", () => {
    const empty = render(<JournalSources sources={[]} />)
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
    empty.unmount()
    render(
      <JournalSources
        // eslint-disable-next-line sonarjs/code-eval -- Deliberately unsafe fixture must never become a link.
        sources={[{ title: "Legacy reference", url: "javascript:alert(1)" }]}
      />
    )
    expect(screen.getByText("Legacy reference")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
