"use client"

import type { WidgetLibrary } from "@repo/shared-data"
import { useState } from "react"

import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"

export function WidgetRowsTable({ rows }: { readonly rows: WidgetLibrary[] }) {
  const [page, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(rows.length / 50)),
    current = Math.min(page, pages)

  return (
    <StaffPanel title="Underlying public rows" compact>
      <p className="mb-3 text-sm text-(--t-ink-dim)">
        {rows.length} libraries. Showing up to 50 rows per page.
      </p>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">Libraries used by this draft</caption>
          <thead>
            <tr>
              {["Library", "Place", "Inclusion", "Mapped", "Hours"].map((h) => (
                <th key={h} scope="col" className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 50, current * 50).map((r) => (
              <tr
                key={r.documentId}
                className="border-t border-(--t-border-line)"
              >
                <th scope="row" className="p-3">
                  {r.name}
                </th>
                <td className="p-3">{r.city ?? "Not recorded"}</td>
                <td className="p-3">{r.why.join(", ")}</td>
                <td className="p-3">
                  {r.location ? "Yes" : "Missing coordinates"}
                </td>
                <td className="p-3">
                  {r.hours.length ? "Recorded" : "Not recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        className="mt-4 flex items-center justify-between gap-3"
        aria-label="Underlying row pages"
      >
        <Button
          variant="surface"
          size="pill"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </Button>
        <span>
          {current} / {pages}
        </span>
        <Button
          variant="surface"
          size="pill"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
      </nav>
    </StaffPanel>
  )
}
