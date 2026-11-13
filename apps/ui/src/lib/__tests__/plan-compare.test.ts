import { describe, expect, it } from "vitest"

import cs from "../../../locales/cs"
import en from "../../../locales/en"
import es from "../../../locales/es"
import fr from "../../../locales/fr"
import {
  ATLAS_SHEET_ROW_IDS,
  availableNow,
  columnHas,
  COMPARE_COLUMNS,
  compareGroups,
  compareRowIds,
  compareRowsById,
  rowMessageKey,
} from "../plan-compare"

const row = (id: string) => compareRowsById([id])[0]!

describe("compareGroups", () => {
  it("compares the five ways to use Libraries Global", () => {
    expect(COMPARE_COLUMNS).toEqual([
      "public",
      "explorer",
      "contributor",
      "staff",
      "api",
    ])
  })

  it("follows the resolver: Explorer tools free when signed in, Reach earned or bought", () => {
    expect(row("atlas.contextLayers").cells).toEqual({
      public: "no",
      explorer: "yes",
      contributor: "yes",
      staff: "yes",
      api: "yes",
    })
    expect(row("atlas.reach").cells).toMatchObject({
      explorer: "no",
      staff: "no",
      contributor: "yes",
      api: "yes",
    })
    expect(row("atlas.reach").cellValues).toEqual({
      contributor: "reachWeek",
      api: "reachHour",
    })
    expect(row("atlas.serviceReach").cells).toMatchObject({
      contributor: "no",
      api: "yes",
    })
    expect(columnHas("staff", "atlas.reach")).toBe(false)
  })

  it("keeps staff tools in the staff column only", () => {
    for (const id of ["staffWorkspace", "staffEditing", "staffWidgets"])
      expect(row(id).cells).toEqual({
        public: "no",
        explorer: "no",
        contributor: "no",
        staff: "yes",
        api: "no",
      })
    expect(row("staffTraffic").cells.staff).toBe("soon")
  })

  it("never ticks a planned feature and links listed roadmap items", () => {
    expect(row("index.alerts").cells.explorer).toBe("soon")
    expect(row("index.alerts").roadmapKey).toBe("search-alerts")
    const now = availableNow(compareGroups()).flatMap((g) => g.rows)
    expect(now.some((r) => r.id === "index.alerts")).toBe(false)
    expect(now.some((r) => r.id === "library.history")).toBe(true)
  })

  it("finds every Atlas sheet row", () => {
    expect(compareRowsById(ATLAS_SHEET_ROW_IDS)).toHaveLength(
      ATLAS_SHEET_ROW_IDS.length
    )
  })

  it.each(Object.entries({ en, fr, cs, es }))(
    "%s has a label for every row, cell value and group",
    (_, messages) => {
      const content = messages.membershipContent as unknown as {
        rows: Record<string, string>
        cells: Record<string, string>
        groups: Record<string, string>
      }
      for (const id of compareRowIds())
        expect(content.rows[rowMessageKey(id)], id).toBeTypeOf("string")
      for (const group of compareGroups()) {
        expect(content.groups[group.id], group.id).toBeTypeOf("string")
        for (const r of group.rows)
          for (const value of Object.values(r.cellValues ?? {}))
            expect(content.cells[value!], value).toBeTypeOf("string")
      }
    }
  )
})
