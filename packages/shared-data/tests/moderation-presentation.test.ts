import { describe, expect, it } from "vitest"

import * as admin from "../../../apps/strapi/src/plugins/content-moderation/admin/src/components/submissionMeta"
import * as community from "../../../apps/ui/src/components/moderation/submissionMeta"
import {
  moderationDetailOf,
  moderationDriveProposalTitle,
  moderationExtractText,
  moderationFormatDate,
  moderationFormatDateTime,
  moderationHumanise,
  moderationIsHttpUrl,
  moderationRenderValue,
  moderationRoleApplicationSummary,
  moderationSummaryOf,
} from "../moderation-presentation"

import baseline from "./fixtures/moderation-presentation.json"

// Captured from both adapters before extraction. Existing differences are deliberate
// golden values, so normalising either surface cannot make a parity failure disappear.
describe("moderation presentation adapter parity", () => {
  it.each(baseline.cases.map((sample, index) => [index, sample] as const))(
    "preserves both original surfaces for submission %i",
    (_index, sample) => {
      const row = sample.submission as Parameters<typeof admin.summaryOf>[0]
      expect([community.summaryOf(row), community.detailOf(row)]).toEqual(
        sample.ui
      )
      expect([admin.summaryOf(row), admin.detailOf(row)]).toEqual(sample.admin)
      expect([moderationSummaryOf(row), moderationDetailOf(row)]).toEqual(
        sample.ui
      )
    }
  )

  it.each(baseline.values)("preserves value rendering for $value", (sample) => {
    expect(community.renderValue(sample.value)).toEqual(sample.ui)
    expect(admin.renderValue(sample.value)).toEqual(sample.admin)
    expect(moderationRenderValue(sample.value)).toEqual(sample.ui)
  })

  it.each(baseline.keys)("preserves humanisation for $key", (sample) => {
    expect(community.humanise(sample.key)).toBe(sample.ui)
    expect(admin.humanise(sample.key)).toBe(sample.admin)
    expect(moderationHumanise(sample.key)).toBe(sample.ui)
  })

  it("preserves event-feed library-name redaction at the community adapter", () => {
    const row = baseline.cases.find(
      (sample) => sample.submission.submissionType === "event_feed"
    )!.submission as Parameters<typeof admin.summaryOf>[0]
    expect(community.summaryOf(row)).not.toContain("Private library name")
    expect(community.detailOf(row)).not.toContain("Private library name")
    expect(admin.summaryOf(row)).toContain("Private library name")
    expect(admin.detailOf(row)).toContain("Private library name")
    for (const sample of baseline.cases) {
      expect(
        JSON.stringify([
          community.summaryOf(sample.submission),
          community.detailOf(sample.submission),
        ])
      ).not.toContain("private@example.invalid")
    }
  })

  it("keeps admin locale normalisation separate from community copy", () => {
    const fields = {
      role: "wiki_editor",
      locales: ["fr", " fr ", "fr", null, ""],
    }
    expect(moderationRoleApplicationSummary(fields)).toBe(
      "Knowledge editor application (fr,  fr )"
    )
    expect(
      moderationRoleApplicationSummary(fields, { trimLocales: true })
    ).toBe("Knowledge editor application (fr)")
  })

  it("shares safe link detection without broadening accepted schemes", () => {
    for (const value of [
      null,
      42,
      "data:text/plain,hello",
      "//example.invalid",
      "/local-path",
      "https://example.invalid with spaces",
    ])
      expect([
        community.isHttpUrl(value),
        admin.isHttpUrl(value),
        moderationIsHttpUrl(value),
      ]).toEqual([false, false, false])
    expect([
      community.isHttpUrl(" https://example.invalid "),
      admin.isHttpUrl(" https://example.invalid "),
      moderationIsHttpUrl(" https://example.invalid "),
    ]).toEqual([true, true, true])
  })

  it("retains article review text, truncation and legacy text precedence", () => {
    const body = [
      null,
      {
        __component: "content.rich-text",
        body: [
          { type: "heading", level: 2, children: [{ text: "Heading" }] },
          {
            type: "paragraph",
            children: [
              { type: "link", children: [{ text: "Linked" }] },
              { text: " paragraph" },
            ],
          },
          {
            type: "list",
            format: "ordered",
            children: [{ children: [{ text: "First" }] }],
          },
          { type: "quote", children: [{ text: "Quoted" }] },
          { type: "image" },
        ],
      },
      {
        __component: "content.rich-text",
        text: "Legacy text",
        body: [{ children: [{ text: "Ignored" }] }],
      },
      {
        __component: "content.quote-block",
        quote: "Read",
        attribution: "Writer",
      },
      {
        __component: "content.callout",
        type: "warning",
        title: "Careful",
        body: "Plain text",
      },
      { __component: "content.code-block", code: "x".repeat(201) },
      { __component: "content.image-block", caption: "Caption" },
      { __component: "unknown" },
    ]
    const expected = `## Heading\nLinked paragraph\n1. First\n> Quoted\n[image]\n\nLegacy text\n\n"Read" — Writer\n\n[warning: Careful] Plain text\n\n[code] ${"x".repeat(200)}…\n\n[image: Caption]`
    expect(moderationExtractText(body)).toBe(expected)
    expect(community.extractText(body)).toBe(expected)
    expect(moderationExtractText(null)).toBe("")
    expect(
      moderationDriveProposalTitle({ drive: { title: " *A drive* " } })
    ).toBe("A drive")
  })

  it("preserves date fallbacks and adapter timezone behaviour", () => {
    expect(moderationFormatDate(null)).toBe("—")
    expect(moderationFormatDateTime(undefined)).toBe("—")
    expect(moderationFormatDateTime("invalid")).toBe(
      "Invalid Date · Invalid Date"
    )
    const iso = "2026-10-16T12:34:00Z"
    expect(community.formatDateTime(iso)).toBe(admin.formatDateTime(iso))
    expect(moderationFormatDateTime(iso)).toBe(community.formatDateTime(iso))
  })
})

describe("article decision refusal additions", () => {
  it.each(["stale_article", "invalid_media"])(
    "explains %s on both surfaces",
    (reason) => {
      const body = {
        error: {
          name: "apply_refused",
          reason,
          message: "Old generic refusal",
        },
      }
      const communityMessage = community.decisionErrorMessage(409, body)
      expect(admin.articleDecisionErrorMessage(body)).toBe(communityMessage)
      expect(communityMessage).toContain("Request changes")
      if (reason === "stale_article")
        expect(communityMessage).toMatch(
          /compare the current publication before resubmitting/
        )
      else expect(communityMessage).toMatch(/ask the writer to replace it/)
    }
  )
  it("leaves older admin refusal and fallback handling unchanged", () => {
    expect(
      admin.articleDecisionErrorMessage({
        error: {
          name: "apply_refused",
          reason: "not_published",
          message: "Original server copy",
        },
      })
    ).toBeNull()
    expect(
      admin.articleDecisionErrorMessage({
        error: { name: "conflict", reason: "stale_article" },
      })
    ).toBeNull()
    expect(admin.articleDecisionErrorMessage(null)).toBeNull()
  })
})

describe("malformed moderation input hardening", () => {
  it.each([
    [-1, "#"],
    [1000000000, "######"],
    [Number.POSITIVE_INFINITY, "##"],
    ["bad", "##"],
  ])("bounds heading level %s", (level, prefix) => {
    expect(
      moderationExtractText([
        {
          __component: "content.rich-text",
          body: [
            { type: "heading", level, children: [{ text: "Safe preview" }] },
          ],
        },
      ])
    ).toBe(`${prefix} Safe preview`)
  })
  it.each(["constructor", "toString", "__proto__"])(
    "treats inherited key %s as an unknown value",
    (key) => {
      expect(moderationRoleApplicationSummary({ role: key, locales: [] })).toBe(
        "Editor application (all languages)"
      )
      expect(
        moderationRoleApplicationSummary({
          role: "moderator",
          queue: key,
          locales: [],
        })
      ).toBe("Moderator application: Queue (all languages)")
      expect(
        moderationDetailOf({
          submissionType: "correction",
          fields: { kind: key, category: "needs checking" },
        })
      ).toBe("needs checking")
      expect(community.moderationRowLabel({ submissionType: key })).toBe(
        moderationHumanise(key.replaceAll("_", " "))
      )
      expect(
        typeof community.decisionErrorMessage(409, {
          error: { name: "apply_refused", reason: key },
        })
      ).toBe("string")
      expect(typeof community.statusMeta(key)?.label).toBe("string")
    }
  )
})
