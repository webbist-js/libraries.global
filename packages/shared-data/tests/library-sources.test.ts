import { describe, expect, it } from "vitest"

import {
  appendSourceRecords,
  librarySourceKey,
  submittedSourceRecords,
} from "../library-sources"

describe("library provenance", () => {
  it("accepts multiple public references, drops unsafe URLs and importer identity", () => {
    expect(
      submittedSourceRecords([
        {
          url: "https://library.example/hours",
          label: " Hours ",
          role: "origin",
          dataset: "imls-pls",
          recordId: "stolen",
          submissionDocumentId: "forged",
          fields: ["openingTimes", "<script>"],
        },
        { url: "https://library.example/contact" },
        // eslint-disable-next-line sonarjs/code-eval -- Test rejects executable URL schemes.
        { url: "javascript:alert(1)" },
        { url: "https://user:secret@example.com/private" },
      ])
    ).toEqual([
      {
        url: "https://library.example/hours",
        label: "Hours",
        role: "reference",
        fields: ["openingTimes"],
      },
      { url: "https://library.example/contact", role: "reference" },
    ])
  })
  it("preserves dataset IDs and derives Drive scope from origins only", () => {
    const original = {
      dataset: "imls-pls",
      recordId: "123",
      role: "origin" as const,
      url: "https://imls.gov",
      retrievedAt: "2026-01-01",
    }
    const reference = {
      url: "https://library.example",
      role: "reference" as const,
    }
    const merged = appendSourceRecords([original], [reference, reference])
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject(original)
    expect(librarySourceKey(merged)).toBe("imls-pls")
    expect(
      librarySourceKey([{ dataset: "imls-pls", role: "reference" }])
    ).toBeNull()
  })
})
