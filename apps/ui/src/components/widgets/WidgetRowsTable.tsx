"use client"
import type { WidgetLibrary } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"

export function WidgetRowsTable({ rows }: { readonly rows: WidgetLibrary[] }) {
  const tSettings = useTranslations("widgetSettings")
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const [page, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(rows.length / 50)),
    current = Math.min(page, pages)

  return (
    <StaffPanel title={tStatic("widget.underlying_public_rows")} compact>
      <p className="mb-3 text-sm text-(--t-ink-dim)">
        {tStatic("widget.rowsCount", { count: rows.length })}
      </p>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">
            {tStatic("widget.libraries_used_by_this_draft")}
          </caption>
          <thead>
            <tr>
              {[
                tSettings("library"),
                tSettings("place"),
                tSettings("inclusion"),
                tSettings("mapped"),
                tSettings("hours"),
              ].map((h) => (
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
                <td className="p-3">{r.city ?? tSettings("notRecorded")}</td>
                <td className="p-3">{r.why.join(", ")}</td>
                <td className="p-3">
                  {r.location
                    ? tExisting("ui.yes")
                    : tSettings("missingCoordinates")}
                </td>
                <td className="p-3">
                  {r.hours.length
                    ? tSettings("recorded")
                    : tSettings("notRecorded")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        className="mt-4 flex items-center justify-between gap-3"
        aria-label={tStatic("widget.underlying_row_pages")}
      >
        <Button
          variant="surface"
          size="pill"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          {tExisting("ui.previous")}
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
          {tExisting("ui.next")}
        </Button>
      </nav>
    </StaffPanel>
  )
}
