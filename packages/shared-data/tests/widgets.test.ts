import { describe, expect, it } from "vitest"

import {
  defaultWidgetConfig,
  emptyWidgetSelection,
  parseWidgetConfig,
  parseWidgetOrigins,
  parseWidgetSelection,
  widgetMetric,
  type WidgetLibrary,
} from "../widgets"

describe("widget contracts", () => {
  it("allows exact normalised origins and rejects wildcard, credential, path and script injection", () => {
    expect(
      parseWidgetOrigins([
        "example.org",
        "https://EXAMPLE.org",
        "https://www.example.org",
      ])
    ).toEqual(["https://example.org", "https://www.example.org"])
    for (const value of [
      "https://*.example.org",
      "http://example.org",
      "https://user@example.org",
      "https://example.org/path",
      "https://example.org/?q=x",
      "https://example.org/#x",
      "https://example.org; https://evil.org",
      // eslint-disable-next-line sonarjs/code-eval -- rejected protocol fixture; this string is never executed.
      "javascript:alert(1)",
      "https://example.org\nhttps://evil.org",
    ]) {
      expect(() => parseWidgetOrigins([value])).toThrow()
    }
    expect(() => parseWidgetOrigins(["http://localhost:3000"])).toThrow()
    expect(parseWidgetOrigins(["http://localhost:3000"], true)).toEqual([
      "http://localhost:3000",
    ])
  })
  it("bounds filters, record identities, sources, groups and presentation inputs", () => {
    expect(parseWidgetConfig(defaultWidgetConfig())).toEqual(
      defaultWidgetConfig()
    )
    expect(() =>
      parseWidgetConfig({ ...defaultWidgetConfig(), accent: "url(evil)" })
    ).toThrow()
    expect(() =>
      parseWidgetConfig({ ...defaultWidgetConfig(), pageSize: Infinity })
    ).toThrow()
    expect(() =>
      parseWidgetConfig({ ...defaultWidgetConfig(), hidePowered: "yes" })
    ).toThrow()
    expect(() =>
      parseWidgetSelection({
        ...emptyWidgetSelection(),
        includeLibraryIds: Array.from({ length: 2001 }).fill(
          "library00000000000000001"
        ),
      })
    ).toThrow()
    expect(() =>
      parseWidgetSelection({
        ...emptyWidgetSelection(),
        sources: [{ kind: "catalogue_filter", filter: {} }],
      })
    ).toThrow()
    expect(() =>
      parseWidgetSelection({
        ...emptyWidgetSelection(),
        filters: { $where: "raw query" },
      })
    ).toThrow()
    expect(() =>
      parseWidgetSelection({
        ...emptyWidgetSelection(),
        sources: [{ kind: "access", userId: "someone" }],
      })
    ).toThrow()
  })
  it("uses recorded yes/no as the denominator and keeps unknowns separate", () => {
    const rows = ["yes", "no", "unknown"].map((answer, i) => ({
      documentId: String(i),
      facilities: [answer],
    })) as WidgetLibrary[]
    const config = {
      ...defaultWidgetConfig(),
      metric: "facility" as const,
      chartMode: "percentage" as const,
    }
    expect(widgetMetric(rows, emptyWidgetSelection(), config)[0]).toMatchObject(
      { total: 3, yes: 1, no: 1, unknown: 1, recorded: 2, percentage: 50 }
    )
    expect(
      widgetMetric(rows.slice(2), emptyWidgetSelection(), config)[0]!.percentage
    ).toBeNull()
  })
})
