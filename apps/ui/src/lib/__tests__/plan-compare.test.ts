import { FEATURES } from "@repo/access"
import { describe, expect, it } from "vitest"

import {
  ATLAS_SHEET_ROW_IDS,
  availableNow,
  COMPARE_PLANS,
  compareRowsById,
  compareGroups,
  type CompareRow,
  shortPrice,
  splitPrice,
  yearlySavingMonths,
} from "../plan-compare"
import { planCard, PRO_FEATURE_COPY } from "../plans"

const rows = () => compareGroups().flatMap((g) => g.rows)
const row = (id: string): CompareRow => {
  const found = rows().find((r) => r.id === id)
  if (!found) throw new Error(`no ${id} row`)

  return found
}

describe("compareGroups", () => {
  it("has a column for every plan, in plan order", () => {
    expect(COMPARE_PLANS).toEqual([
      "public",
      "free",
      "supporter",
      "pro",
      "team",
    ])
  })

  it("lists every Pro feature exactly once", () => {
    const ids = rows().map((r) => r.id)
    for (const f of FEATURES)
      expect(ids.filter((id) => id === f)).toHaveLength(1)
  })

  it("never repeats a row label", () => {
    const labels = rows().map((r) => r.label)
    expect(labels.filter((l, i) => labels.indexOf(l) !== i)).toEqual([])
  })

  it("gives row ids that are unique", () => {
    const ids = rows().map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("shows the live export for Pro and Team only", () => {
    expect(row("atlas.export").cells).toEqual({
      public: "no",
      free: "no",
      supporter: "no",
      pro: "yes",
      team: "yes",
    })
  })

  it("never ticks a feature that isn't built", () => {
    for (const f of FEATURES) {
      if (PRO_FEATURE_COPY[f].status !== "soon") continue
      expect(Object.values(row(f).cells)).not.toContain("yes")
    }
  })

  it("keeps team-only features out of the Pro column", () => {
    expect(row("team.workspace").cells.pro).toBe("no")
    expect(row("team.workspace").cells.team).toBe("soon")
  })

  it("carries free-tier includes forward to every paid plan", () => {
    expect(row("follow-libraries-and-save-events").cells).toEqual({
      public: "no",
      free: "yes",
      supporter: "yes",
      pro: "yes",
      team: "yes",
    })
  })

  it("marks coming-soon includes as soon, without the suffix", () => {
    const downloads = row("open-data-downloads")
    expect(downloads.label).toBe("Open-data downloads")
    expect(Object.values(downloads.cells)).toEqual(
      Array.from({ length: 5 }, () => "soon")
    )
  })

  it("leaves out pointer lines like 'Everything in Public'", () => {
    expect(rows().some((r) => r.label.startsWith("Everything in"))).toBe(false)
    expect(rows().some((r) => r.label === "Pro for every seat")).toBe(false)
  })
})

describe("availableNow", () => {
  it("drops rows no plan has yet, and empty groups", () => {
    const groups = availableNow(compareGroups())
    const ids = groups.flatMap((g) => g.rows.map((r) => r.id))
    expect(ids).toContain("atlas.export")
    expect(ids).not.toContain("open-data-downloads")
    expect(ids).not.toContain("team.workspace")
    for (const g of groups) expect(g.rows.length).toBeGreaterThan(0)
  })
})

describe("compareRowsById", () => {
  it("finds every row the Atlas sheet asks for, in its order", () => {
    expect(compareRowsById(ATLAS_SHEET_ROW_IDS).map((r) => r.id)).toEqual([
      ...ATLAS_SHEET_ROW_IDS,
    ])
  })
})

describe("shortPrice", () => {
  it("shortens each plan's headline price", () => {
    expect(shortPrice(planCard("public").price)).toBe("Free")
    expect(shortPrice(planCard("supporter").price)).toBe("£3/mo")
    expect(shortPrice(planCard("pro").price)).toBe("£5/mo")
    expect(shortPrice(planCard("team").price)).toBe("£480/yr")
  })
})

describe("yearlySavingMonths", () => {
  it("counts the months a yearly price saves", () => {
    expect(
      yearlySavingMonths({ monthly: "£3/month", yearly: "£30/year" })
    ).toBe(2)
    expect(yearlySavingMonths(planCard("pro").price)).toBe(2)
  })

  it("is null without a monthly and yearly pair, or without a saving", () => {
    expect(yearlySavingMonths("free")).toBeNull()
    expect(yearlySavingMonths(planCard("team").price)).toBeNull()
    expect(
      yearlySavingMonths({ monthly: "£5/month", yearly: "£60/year" })
    ).toBeNull()
  })
})

describe("splitPrice", () => {
  it("splits an amount from its period and any suffix", () => {
    expect(splitPrice("£3/month")).toEqual({
      amount: "£3",
      period: "month",
      suffix: "",
    })
    expect(splitPrice("£480/year ex VAT")).toEqual({
      amount: "£480",
      period: "year",
      suffix: " ex VAT",
    })
  })

  it("is null for text it can't read", () => {
    expect(splitPrice(undefined)).toBeNull()
    expect(splitPrice("Free")).toBeNull()
  })
})
