import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  API_REACH_PER_DAY,
  API_REACH_PER_HOUR,
  API_REACH_SERVICE_LIBRARIES,
  CONTRIBUTOR_REACH_PER_WEEK,
  EXPLORER_LIMITS,
} from "../../../packages/access/src/entitlements"
import {
  CONTRIBUTION_ACTIVITY_DAYS,
  CONTRIBUTOR_MIN_ACCEPTED,
  SUPPORTER_MIN_ACCEPTED,
} from "../../../packages/access/src/recognition"
import {
  ACCESS,
  KNOWLEDGE_ARTICLES,
  LOCALES,
  SCRUB_SLUGS,
  accessValues,
  articleCopy,
  localeCopy,
  markdownComponents,
  nodeText,
  plannedArticle,
  renamedUrl,
  slugsFor,
  retiredCopy,
  scrubBlocks,
  scrubbedBody,
} from "../scripts/sponsored-access-content.mjs"
import {
  API_OFFER_TERMS_VERSION,
  REVIEW_HEADING,
  legalDraftData,
  legalDraftMarkdown,
  legalDrafts,
  nextMajorVersion,
} from "../scripts/sponsored-access-legal-content.mjs"

import pricing from "../../ui/src/lib/membership-pricing.json"

const rich = (...texts: string[]) => ({
  __component: "content.rich-text",
  body: texts.map((text) => ({
    type: "paragraph",
    children: [{ type: "text", text }],
  })),
})
const headed = (heading: string, ...texts: string[]) => ({
  __component: "content.rich-text",
  body: [
    { type: "heading", level: 2, children: [{ type: "text", text: heading }] },
    ...rich(...texts).body,
  ],
})

describe("sponsored-access access figures", () => {
  it("agree with @repo/access and the pricing catalogue", () => {
    expect(ACCESS.savedViews).toBe(EXPLORER_LIMITS.savedViews)
    expect(ACCESS.exportRows).toBe(EXPLORER_LIMITS.exportRows)
    expect(ACCESS.exportsPerDay).toBe(EXPLORER_LIMITS.exportsPerDay)
    expect(ACCESS.contributorReach).toBe(CONTRIBUTOR_REACH_PER_WEEK)
    expect(ACCESS.apiReachPerHour).toBe(API_REACH_PER_HOUR)
    expect(ACCESS.apiReachPerDay).toBe(API_REACH_PER_DAY)
    expect(ACCESS.serviceLibraries).toBe(API_REACH_SERVICE_LIBRARIES)
    expect(ACCESS.contributorThreshold).toBe(CONTRIBUTOR_MIN_ACCEPTED)
    expect(ACCESS.supporterThreshold).toBe(SUPPORTER_MIN_ACCEPTED)
    expect(ACCESS.activityDays).toBe(CONTRIBUTION_ACTIVITY_DAYS)
    expect(ACCESS.price).toBe(pricing.api.month)
    expect(ACCESS.bytes).toBe(262_144_000)
    const en = accessValues("en")
    expect([en.price, en.requests, en.mib, en.credits]).toEqual([
      "£100",
      "10,000",
      "250 MiB",
      "100",
    ])
    expect([en.requestRate, en.mibRate, en.creditRate]).toEqual([
      "1p",
      "10p",
      "50p",
    ])
    expect([en.capMin, en.capMax, en.capStep, en.capDefault]).toEqual([
      "£10",
      "£500",
      "£10",
      "£100",
    ])
    expect(accessValues("fr").price).toBe("100 £")
  })
})

describe("sponsored-access Knowledge copy", () => {
  it.each(LOCALES)(
    "covers every article in %s without retired claims",
    (locale) => {
      const copy = localeCopy(locale)
      expect(Object.keys(copy.articles).sort()).toEqual(
        KNOWLEDGE_ARTICLES.map((a) => a.slug).sort()
      )
      for (const { slug } of KNOWLEDGE_ARTICLES) {
        const { data } = plannedArticle(slug, locale, null)
        expect(data.title.length).toBeGreaterThan(5)
        expect(data.summary.length).toBeGreaterThan(20)
        expect(retiredCopy(data, locale)).toEqual([])
        expect(JSON.stringify(data)).not.toMatch(/\$\{|undefined|NaN/)
      }
    }
  )

  it("keeps placeholders, links and code identical across translations", () => {
    for (const { slug } of KNOWLEDGE_ARTICLES) {
      const shape = (locale: string) => {
        const body = articleCopy(slug, locale).body as string

        return {
          links: [...body.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]),
          code: [...body.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]),
        }
      }
      for (const locale of LOCALES) expect(shape(locale)).toEqual(shape("en"))
    }
  })

  it("states the agreed offer in English", () => {
    const all = KNOWLEDGE_ARTICLES.map(
      ({ slug }) => articleCopy(slug, "en").body
    ).join("\n")
    for (const fact of [
      "£100 a month",
      "10,000 successful requests",
      "250 MiB",
      "100 analysis credits",
      "1p per request",
      "between £10 and £500",
      "before tax",
      "2 new one-library Reach calculations",
      "100 accepted contributions",
      "not a charitable donation",
      "`submissions:write`",
      "quota_requests",
    ])
      expect(all).toContain(fact)
  })

  it("converts the Markdown subset into rich text and code blocks", () => {
    const components = markdownComponents(
      "## Title\n\nRead [the guide](/knowledge/x) and `code` **now**.\n\n- one\n- two\n\n```bash\necho hi\n```\n\nAfter."
    )
    expect(components.map((c) => c.__component)).toEqual([
      "content.rich-text",
      "content.code-block",
      "content.rich-text",
    ])
    const [heading, paragraph, list] = components[0].body
    expect(heading).toMatchObject({ type: "heading", level: 2 })
    expect(paragraph.children).toEqual([
      { type: "text", text: "Read " },
      {
        type: "link",
        url: "/knowledge/x",
        children: [{ type: "text", text: "the guide" }],
      },
      { type: "text", text: " and " },
      { type: "text", text: "code", code: true },
      { type: "text", text: " " },
      { type: "text", text: "now", bold: true },
      { type: "text", text: "." },
    ])
    expect(list).toMatchObject({ type: "list", format: "unordered" })
    expect(components[1]).toMatchObject({ language: "bash", code: "echo hi" })
  })

  it("rewrites owned guides but keeps clean editorial media", () => {
    const image = {
      id: 9,
      __component: "content.image-block",
      image: { id: 44, url: "/x.webp" },
      caption: "Reading room",
    }
    const staleCallout = {
      __component: "content.callout",
      type: "info",
      body: "Pro costs £5/month.",
    }
    const { data, dropped } = plannedArticle("plans-and-pricing", "en", {
      body: [rich("Supporter costs £3/month."), image, staleCallout],
    })
    expect(Object.keys(data)).toEqual(["title", "summary", "body"])
    expect(data.body.at(-1)).toEqual({
      __component: "content.image-block",
      image: 44,
      caption: "Reading room",
    })
    expect(JSON.stringify(data)).not.toContain("£3")
    expect(dropped.map((d) => d.component)).toEqual([
      "content.rich-text",
      "content.callout",
    ])
  })
})

describe("renamed guides", () => {
  it("finds a guide by its old slug and rewrites only Knowledge links to it", () => {
    expect(slugsFor("plans-and-pricing")).toEqual([
      "plans-and-pricing",
      "plans-and-pro",
    ])
    expect(slugsFor("the-public-api")).toEqual(["the-public-api"])
    for (const [from, to] of [
      [
        "/knowledge/governance/plans-and-pro",
        "/knowledge/governance/plans-and-pricing",
      ],
      [
        "/fr/knowledge/governance/plans-and-pro#api",
        "/fr/knowledge/governance/plans-and-pricing#api",
      ],
      [
        "/knowledge/governance/plans-and-pro-extra",
        "/knowledge/governance/plans-and-pro-extra",
      ],
      ["/plans-and-pro", "/plans-and-pro"],
      ["https://example.org/knowledge/x", "https://example.org/knowledge/x"],
    ])
      expect(renamedUrl(from)).toBe(to)
  })
})

describe("scrubbing related guides", () => {
  const doc = {
    slug: "library-conversations",
    body: [
      { id: 3, __component: "content.image-block", image: 7 },
      headed(
        "Points for accepted contributions",
        "An accepted new discussion thread earns 2 points; an accepted reply or edit earns 1. Each qualifying acceptance renews the 30-day earned-Pro activity window. Drafts do not earn these points."
      ),
      headed(
        "Earn Pro through contributions",
        "Earned Pro is available while your current points total is at least 5,000."
      ),
      {
        __component: "content.rich-text",
        body: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Read " },
              {
                type: "link",
                url: "/knowledge/governance/plans-and-pro",
                children: [{ type: "text", text: "Plans and Pro" }],
              },
              { type: "text", text: "." },
            ],
          },
        ],
      },
    ],
  }

  it("removes retired sections and sentences and relabels plan links", () => {
    const result = scrubbedBody(doc, "en")!
    const text = JSON.stringify(result.body)
    expect(text).not.toMatch(/earned-Pro|Earn Pro|5,000/)
    expect(text).toContain("earns 2 points")
    expect(text).toContain("Drafts do not earn these points.")
    expect(text).toContain('"text":"Plans and pricing"')
    expect(text).toContain('"url":"/knowledge/governance/plans-and-pricing"')
    expect(text).not.toContain('plans-and-pro"')
    expect(result.body[0]).toEqual({
      __component: "content.image-block",
      image: 7,
    })
    expect(result.removed).toContainEqual({
      section: "Earn Pro through contributions",
    })
    expect(scrubbedBody({ ...doc, body: result.body }, "en")).toBeNull()
  })

  it("handles translated retired copy and adds the recognition note once", () => {
    const fr = {
      slug: "points-streaks-and-tiers",
      body: [
        rich(
          "Les rôles donnent des responsabilités. Supporter, Pro et Team n’accordent ni rôle communautaire, ni points."
        ),
        headed("Obtenir Pro grâce aux contributions", "…"),
      ],
    }
    const result = scrubbedBody(fr, "fr")!
    const text = nodeText(result.body.map((c: { body: unknown }) => c.body))
    expect(text).toContain("Les rôles donnent des responsabilités.")
    expect(text).not.toMatch(/Supporter, Pro|Obtenir Pro/)
    expect(text).toContain(localeCopy("fr").relatedNote.heading)
    expect(scrubbedBody({ ...fr, body: result.body }, "fr")).toBeNull()
    const cs = rich("Pro každou roli může být otevřena jedna žádost.")
    expect(
      scrubbedBody({ slug: "becoming-an-editor", body: [cs] }, "cs")
    ).toBeNull()
  })

  it("does not overlap the guides it rewrites", () => {
    const owned = new Set(KNOWLEDGE_ARTICLES.map((a) => a.slug))
    expect(SCRUB_SLUGS.filter((slug) => owned.has(slug))).toEqual([])
  })
})

describe("legal revision drafts", () => {
  const published = {
    slug: "terms",
    sections: [
      {
        id: 1,
        heading: "Who we are",
        inShort: "Us",
        body: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                text: "Libraries Global is operated by Alexander Bennett.",
              },
            ],
          },
        ],
      },
      {
        heading: "Donations and paid features",
        inShort: "Old",
        body: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                text: "Supporter and Pro are optional recurring digital memberships.",
              },
            ],
          },
        ],
      },
      {
        heading: "Points, tiers and badges",
        inShort: "Old",
        body: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                text: "Points reward work. Earned Pro is available while your current points total is at least 5,000.",
              },
            ],
          },
        ],
      },
    ],
    revisions: [
      {
        id: 5,
        version: "1.1",
        date: "2026-10-01",
        summary: "One",
        changesUrl: null,
      },
      { version: "1.2", date: "2026-11-01", summary: "Two", changesUrl: null },
    ],
  }
  const terms = legalDrafts().find((d) => d.slug === "terms")!

  it("appends a new major revision and never edits history", () => {
    const { data, report } = legalDraftData(published, terms, "2026-11-06")
    expect(data.revisions.slice(0, 2)).toEqual([
      { version: "1.1", date: "2026-10-01", summary: "One", changesUrl: null },
      { version: "1.2", date: "2026-11-01", summary: "Two", changesUrl: null },
    ])
    expect(data.revisions[2]).toMatchObject({
      version: "2.0",
      date: "2026-11-06",
    })
    expect(data.revisions[2].summary).toMatch(
      /^Describes free Explorer accounts/
    )
    expect(report.replaced.every((r: { found: boolean }) => r.found)).toBe(true)
    expect(data.sections[0].heading).toBe(REVIEW_HEADING)
    expect(data.sections[1].heading).toBe("Who we are")
    const text = JSON.stringify(data.sections)
    expect(text).not.toMatch(/Supporter and Pro|Earned Pro|5,000/)
    expect(text).toContain("Free access and paid services")
    // A rerun over its own staged draft keeps the same version and date.
    const staged = { ...published, revisions: data.revisions }
    const again = legalDraftData(staged, terms, "2026-12-01")
    expect(again.data.revisions).toHaveLength(3)
    expect(again.data.revisions[2].version).toBe("2.0")
  })

  it("moves past a version recorded by another revision", () => {
    const clash = {
      ...published,
      revisions: [
        ...published.revisions,
        { version: "2.0", date: "2026-11-05", summary: "Someone else" },
      ],
    }
    expect(nextMajorVersion(clash.revisions)).toBe("3.0")
    expect(
      legalDraftData(clash, terms, "2026-11-06").data.revisions[3].version
    ).toBe("3.0")
  })

  it("drafts the API terms with the agreed figures and review markers", () => {
    const drafts = legalDrafts()
    expect(drafts.map((d) => d.slug)).toEqual([
      "membership",
      "cancellation-refunds",
      "terms",
      "privacy",
      "data-licence",
    ])
    const api = drafts[0]!
    const text = JSON.stringify(legalDraftData(null, api, "2026-11-06").data)
    for (const fact of [
      `offer version ${API_OFFER_TERMS_VERSION}`,
      "£100 a month",
      "10,000 successful requests",
      "262,144,000 bytes",
      "1p per request",
      "10p per MiB",
      "50p per analysis credit",
      "from £10 to £500",
      "before tax",
      "not a charitable donation",
      "England and Wales",
      REVIEW_HEADING,
    ])
      expect(text).toContain(fact)
    for (const draft of drafts)
      expect(legalDraftMarkdown(draft, "2026-11-06")).toContain(
        "Do not publish until legal review"
      )
  })

  it("matches the committed review copies", () => {
    for (const draft of legalDrafts()) {
      const file = new URL(
        `../../docs/docs/proposals/legal-drafts/${draft.slug}.md`,
        import.meta.url
      )
      const committed = readFileSync(file, "utf8")
      const date = /prepared (\d{4}-\d{2}-\d{2})/.exec(committed)![1]
      expect(committed).toBe(legalDraftMarkdown(draft, date).trimEnd() + "\n")
    }
  })
})

describe("staging runner", () => {
  const source = readFileSync(
    new URL("../scripts/update-sponsored-access-content.mjs", import.meta.url),
    "utf8"
  )
  it("has no publication path and guards production writes", () => {
    expect(source).not.toMatch(/actions\/publish|publish_/)
    expect(source).toContain("--confirm-production")
    expect(source).toContain("--digest")
    expect(source).not.toMatch(
      /PRODUCTION_MCP_TOKEN\s*\|\|\s*(?:process\.)?env\.STRAPI_MCP_TOKEN/
    )
  })
})

describe("scrubBlocks", () => {
  it("drops a heading whose whole text was retired copy, keeping the section", () => {
    const { blocks, removed } = scrubBlocks(
      [
        {
          type: "heading",
          level: 2,
          children: [{ type: "text", text: "Claims and Pro" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", text: "A claim covers one library." }],
        },
      ],
      "en"
    )
    expect(removed.length).toBeGreaterThan(0)
    expect(
      blocks.some((node: { type: string }) => node.type === "heading")
    ).toBe(false)
    expect(blocks).toHaveLength(1)
  })
})
