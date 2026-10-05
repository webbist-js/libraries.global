import { describe, expect, it } from "vitest"

import {
  decisionErrorMessage,
  describeScopes,
  detailOf,
  extractText,
  humanise,
  moderationRowLabel,
  renderValue,
  summaryOf,
} from "../submissionMeta"

const base = {
  documentId: "abcdefghijklmnopqrstuvwx",
  status: "pending",
  createdAt: "2026-09-30T10:00:00.000Z",
}

const SAMPLES = [
  {
    ...base,
    submissionType: "new_library",
    fields: {
      name: "  Bodleian Annexe ",
      libraryType: "Academic",
      city: "Oxford",
    },
  },
  { ...base, submissionType: "new_library", fields: {} },
  {
    ...base,
    submissionType: "library_claim",
    targetSlug: "british-library",
    fields: { role: "head_librarian" },
  },
  {
    ...base,
    submissionType: "wiki_edit",
    targetSlug: "how-to-cite",
    draftData: { proposedTitle: "How to cite", proposedBody: [] },
  },
  {
    ...base,
    submissionType: "blog_submission",
    draftData: { kind: "new_article", title: "Field notes" },
  },
  {
    ...base,
    submissionType: "wiki_edit",
    targetSlug: "faq",
    draftData: { isTranslation: true, locale: "fr", body: [] },
  },
  {
    ...base,
    submissionType: "correction",
    targetSlug: "british-library",
    fields: { kind: "record", website: "x", phone: "y", previous: {} },
  },
  {
    ...base,
    submissionType: "correction",
    targetSlug: "british-library",
    fields: { kind: "facilities", answers: { "Wi-Fi": "yes" } },
  },
  {
    ...base,
    submissionType: "library_edit",
    targetSlug: "british-library",
    fields: { website: "x" },
  },
  { ...base, submissionType: "topic_suggestion", fields: { name: "Maps" } },
  {
    ...base,
    submissionType: "correction",
    targetSlug: "british-library",
    fields: { kind: "verify", sections: ["hours"], libraryName: "BL" },
  },
]

// Expected values are the Strapi admin helpers' own outputs for these rows
// (content-moderation admin/src/components/submissionMeta.ts), copied here
// as literals so the UI's tests don't depend on apps/strapi.
const EXPECTED: [summary: string, detail: string | null][] = [
  ["Bodleian Annexe", "Academic · Oxford"],
  ["Unnamed library", null],
  ["british-library", "head librarian"],
  ["How to cite", "Suggested edit"],
  ["Field notes", "New article"],
  ["Edit: faq", "Translation (fr)"],
  ["british-library", "2 fields changed"],
  ["british-library", "Facility answers"],
  ["british-library", "1 field changed"],
  ["Maps", null],
  ["british-library", "Still right?"],
]

describe("submissionMeta port", () => {
  it.each(SAMPLES.map((s, i) => [s.submissionType, s, EXPECTED[i]] as const))(
    "summaryOf and detailOf match the admin for a %s",
    (_type, sample, expected) => {
      expect([summaryOf(sample), detailOf(sample)]).toEqual(expected)
    }
  )

  it("humanise and renderValue match the admin", () => {
    expect(
      ["streetAddress", "regionDocumentId", "iiifEndpoint"].map(humanise)
    ).toEqual(["Street address", "Region", "Iiif endpoint"])
    expect(
      [
        null,
        "",
        [],
        ["a", "b"],
        "https://x.org",
        12,
        { days: [{ enabled: true }] },
      ].map(renderValue)
    ).toEqual([
      { text: "—", isUrl: false },
      { text: "—", isUrl: false },
      { text: "—", isUrl: false },
      { text: "a, b", isUrl: false },
      { text: "https://x.org", isUrl: true },
      { text: "12", isUrl: false },
      { text: "1 day(s) with hours", isUrl: false },
    ])
  })
})

describe("moderationRowLabel", () => {
  it("names each submission type", () => {
    expect(moderationRowLabel({ submissionType: "wiki_edit" })).toBe(
      "Knowledge"
    )
    expect(moderationRowLabel({ submissionType: "blog_submission" })).toBe(
      "Journal"
    )
    expect(moderationRowLabel({ submissionType: "new_library" })).toBe(
      "New library"
    )
    expect(moderationRowLabel({ submissionType: "role_application" })).toBe(
      "Role application"
    )
    expect(moderationRowLabel({ submissionType: "something_new" })).toBe(
      "Something new"
    )
  })
})

describe("describeScopes", () => {
  const names = { fr: "French", en: "English" }
  it("names queues and languages", () => {
    expect(
      describeScopes(
        [
          { queue: "knowledge", locale: "fr" },
          { queue: "index", locale: null },
        ],
        names
      )
    ).toBe("Knowledge in French, and the Index")
    expect(describeScopes([{ queue: "all", locale: null }], names)).toBe(
      "every queue"
    )
    expect(describeScopes([{ queue: "journal", locale: "de" }], names)).toBe(
      "the Journal in DE"
    )
  })
})

describe("decisionErrorMessage", () => {
  it("maps Strapi's refusals to the review copy", () => {
    expect(
      decisionErrorMessage(409, {
        error: { name: "apply_refused", reason: "no_hierarchy" },
      })
    ).toMatch(/continent, country and region/)
    expect(
      decisionErrorMessage(409, {
        error: { name: "apply_refused", reason: "not_published" },
      })
    ).toMatch(/no published version/)
    expect(decisionErrorMessage(409, { error: { name: "conflict" } })).toMatch(
      /already decided or changed/
    )
    expect(decisionErrorMessage(422, { error: { name: "tampered" } })).toMatch(
      /changed after it was submitted/
    )
    expect(
      decisionErrorMessage(403, { error: { name: "self_review" } })
    ).toMatch(/your own/)
    expect(
      decisionErrorMessage(500, { error: { name: "apply_failed" } })
    ).toMatch(/back in review/)
    expect(
      decisionErrorMessage(500, { error: { name: "apply_failed_unreverted" } })
    ).toMatch(/admin needs to fix it/)
    expect(
      decisionErrorMessage(400, {
        error: { message: "Say what needs to change: a note is required." },
      })
    ).toBe("Say what needs to change: a note is required.")
  })
})

describe("extractText", () => {
  it("reads rich-text blocks and quotes", () => {
    expect(
      extractText([
        {
          __component: "content.rich-text",
          body: [
            { type: "heading", level: 2, children: [{ text: "Intro" }] },
            { type: "paragraph", children: [{ text: "Hello" }] },
          ],
        },
        { __component: "content.quote-block", quote: "Read", attribution: "A" },
      ])
    ).toBe('## Intro\nHello\n\n"Read" — A')
  })
})
