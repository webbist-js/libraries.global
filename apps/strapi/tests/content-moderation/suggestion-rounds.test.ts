import { afterEach, describe, expect, it, vi } from "vitest"

import { toPublicSuggestion } from "../../src/plugins/content-moderation/server/controllers/option-suggestion"
import {
  createSuggestion,
  decideSuggestion,
  listSuggestions,
  publishSuggestion,
  SUGGESTION,
  toggleVote,
  VOTE,
} from "../../src/plugins/content-moderation/server/utils/option-suggestions"
import { publicComparisons } from "../../src/plugins/content-moderation/server/utils/suggestion-catalogue"
import {
  suggestionCommentCounts,
  suggestionConversationSummaries,
} from "../../src/plugins/content-moderation/server/utils/suggestion-discussions"
import {
  firstTuesday,
  rankSuggestions,
  reviewRoundView,
  ROUND,
  syncReviewRound,
  updateReviewRound,
} from "../../src/plugins/content-moderation/server/utils/suggestion-rounds"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const TYPE = "api::library-type.library-type"
const SERVICE = "api::service.service"
const id = (n: number) => `suggestion${String(n).padStart(14, "0")}`
const idea = (n: number, extra: Record<string, unknown> = {}) => ({
  documentId: id(n),
  name: `Idea ${n}`,
  nameKey: `idea ${n}`,
  optionKey: "services",
  status: "open",
  publicationStatus: "published",
  version: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
})
const round = (extra: Record<string, unknown> = {}) => ({
  documentId: "round0000000000000000001",
  key: "2026-11-03",
  opensAt: "2026-10-06T00:00:00.000Z",
  cutoffAt: "2026-11-03T00:00:00.000Z",
  reviewAt: "2026-11-03T12:00:00.000Z",
  capacity: 5,
  state: "voting",
  version: 0,
  ...extra,
})
function fixture(seed: Record<string, any[]> = {}) {
  return makeFakeStrapi(seed, {
    tables: { cm_option_votes: VOTE },
    uniqueKeys: {
      [VOTE]: [["suggestionDocumentId", "baUserId"]],
      [ROUND]: [["key"]],
    },
    contentTypes: {
      [ROUND]: { attributes: { cutoffAt: { type: "datetime" } } },
      "plugin::discussions.thread": { attributes: {} },
      [SERVICE]: { attributes: { category: { enum: ["Other", "Community"] } } },
    },
  })
}
afterEach(() => vi.useRealTimers())

describe("suggestion review rounds", () => {
  it("uses UTC month boundaries and stable vote ties", () => {
    expect(firstTuesday(2026, 10).toISOString()).toBe(
      "2026-11-03T00:00:00.000Z"
    )
    expect(
      rankSuggestions([
        { documentId: "b", votes: 2, createdAt: "2026-10-02" },
        { documentId: "z", votes: 3 },
        { documentId: "a", votes: 2, createdAt: "2026-10-01" },
      ]).map((s) => s.documentId)
    ).toEqual(["z", "a", "b"])
  })
  it("saves the cutoff once, excluding late publication and private intake", async () => {
    const { strapi, store } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [
        idea(1),
        idea(2, { publicationAt: "2026-11-03T00:00:01Z" }),
        idea(3, { publicationStatus: "pending" }),
      ],
      [VOTE]: [{ suggestionDocumentId: id(1), baUserId: "member" }],
    })
    const saved = await syncReviewRound(
      strapi,
      new Date("2026-11-03T00:00:00Z")
    )
    expect(saved.shortlist.map((s: any) => s.documentId)).toEqual([id(1)])
    store[VOTE]!.push({ suggestionDocumentId: id(1), baUserId: "late" })
    const again = await syncReviewRound(
      strapi,
      new Date("2026-11-04T00:00:00Z")
    )
    expect(again.shortlist[0].votes).toBe(1)
  })
  it("hides removed snapshot names publicly while retaining the board audit", async () => {
    const { strapi } = fixture({
      [ROUND]: [
        round({
          state: "review",
          shortlist: [
            { documentId: id(1), name: "Removed text", votes: 10, rank: 1 },
          ],
        }),
      ],
      [SUGGESTION]: [idea(1, { status: "removed" })],
    })
    expect((await reviewRoundView(strapi)).shortlist).toEqual([])
    expect((await reviewRoundView(strapi, false)).shortlist[0].name).toBe(
      "Removed text"
    )
  })
  it("rejects stale schedule changes and closing an undecided shortlist", async () => {
    const { strapi } = fixture({
      [ROUND]: [
        round({
          state: "review",
          version: 3,
          shortlist: [{ documentId: id(1), rank: 1 }],
        }),
      ],
      [SUGGESTION]: [idea(1)],
    })
    expect(
      await updateReviewRound(strapi, { action: "close", version: 2 })
    ).toMatchObject({ ok: false, status: 409 })
    expect(
      await updateReviewRound(strapi, { action: "close", version: 3 })
    ).toMatchObject({ ok: false, status: 400 })
  })
  it("freezes selected votes while other ideas can still receive support", async () => {
    const { strapi } = fixture({
      [ROUND]: [
        round({
          state: "review",
          shortlist: [{ documentId: id(1), votes: 1, rank: 1 }],
        }),
      ],
      [SUGGESTION]: [idea(1), idea(2)],
    })
    expect(await toggleVote(strapi, id(1), "member")).toBeNull()
    expect(await toggleVote(strapi, id(2), "member")).toMatchObject({
      voted: true,
      votes: 1,
    })
  })
  it("keeps pending submissions private, including across different owners", async () => {
    const { strapi } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [
        idea(1),
        idea(2, { publicationStatus: "pending", suggestedBy: "alice" }),
        idea(3, { publicationStatus: "pending", suggestedBy: "bob" }),
      ],
    })
    expect(
      (await listSuggestions(strapi, { publicOnly: true })).map(
        (s) => s.documentId
      )
    ).toEqual([id(1)])
    expect(
      (
        await listSuggestions(strapi, {
          publicOnly: true,
          includeOwnPending: true,
          viewer: "alice",
        })
      ).map((s) => s.documentId)
    ).toEqual([id(1), id(2)])
    expect(await toggleVote(strapi, id(2), "alice")).toBeNull()
    expect(await publishSuggestion(strapi, id(2), 99)).toMatchObject({
      ok: false,
    })
    expect(await publishSuggestion(strapi, id(2), 0)).toMatchObject({
      ok: true,
    })
    expect(
      (await listSuggestions(strapi, { publicOnly: true })).map(
        (s) => s.documentId
      )
    ).toContain(id(2))
  })
  it("rejects publication privately and returns the reason only to its owner", async () => {
    const { strapi } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [
        idea(1, { publicationStatus: "pending", suggestedBy: "alice" }),
      ],
    })
    await publishSuggestion(
      strapi,
      id(1),
      0,
      "This duplicates an existing feature."
    )
    expect(await listSuggestions(strapi, { publicOnly: true })).toEqual([])
    const [own] = await listSuggestions(strapi, {
      publicOnly: true,
      includeOwnPending: true,
      viewer: "alice",
    })
    expect(toPublicSuggestion(own!).decisionNote).toBe(
      "This duplicates an existing feature."
    )
  })
  it("lets an owner revise rejected intake without duplicating votes or records", async () => {
    const { strapi, store } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [
        idea(1, {
          name: "Seed library",
          nameKey: "seed library",
          publicationStatus: "rejected",
          status: "declined",
          suggestedBy: "alice",
          publicationHistory: [{ outcome: "rejected" }],
        }),
      ],
      [VOTE]: [{ suggestionDocumentId: id(1), baUserId: "alice" }],
    })
    const result = await createSuggestion(strapi, {
      optionKey: "services",
      name: "Seed library",
      description: "A revised, clearer description.",
      baUserId: "alice",
    })
    expect(result).toMatchObject({
      ok: true,
      suggestion: { publicationStatus: "pending", votes: 1 },
    })
    expect(store[SUGGESTION]).toHaveLength(1)
    expect(store[SUGGESTION]![0].publicationHistory).toHaveLength(1)
    expect(store[VOTE]).toHaveLength(1)
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "Seed library",
        baUserId: "bob",
      })
    ).toEqual({
      ok: false,
      status: 409,
      message: "This name is unavailable. Choose another name.",
    })
  })
  it("creates new library types without changing existing library values", async () => {
    const { strapi, store } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [
        idea(1, {
          optionKey: "library_types",
          name: "Hospital",
          nameKey: "hospital",
          libraries: [],
        }),
      ],
      [TYPE]: [{ documentId: "type00000000000000000001", name: "Public" }],
    })
    const result = await decideSuggestion(strapi, {
      documentId: id(1),
      decision: "accept",
      decidedBy: "Board",
      decisionKind: "add",
      feature: { summary: "A library serving a hospital." },
      version: 0,
      note: "A distinct category.",
    })
    expect(result.ok).toBe(true)
    expect(store[TYPE]!.map((s) => s.name)).toEqual(["Public", "Hospital"])
  })
  it("appends a clarification without deleting the existing published description", async () => {
    const previous = {
      type: "paragraph",
      children: [{ type: "text", text: "Existing service information." }],
    }
    const optionId = "service000000000000000001"
    const { strapi, store } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [idea(1, { libraries: [] })],
      [SERVICE]: [
        { documentId: optionId, name: "Wi-Fi", description: [previous] },
      ],
    })
    const result = await decideSuggestion(strapi, {
      documentId: id(1),
      decision: "accept",
      decisionKind: "update",
      existingOptionDocumentId: optionId,
      feature: { description: "Connection speeds vary." },
      decidedBy: "Board",
      version: 0,
      note: "Clarify rather than create a duplicate.",
    })
    expect(result.ok).toBe(true)
    expect(store[SERVICE]![0].__published.description).toHaveLength(2)
    expect(store[SERVICE]![0].__published.description[0]).toEqual(previous)
  })
  it("counts only current votes cast this UTC month for popularity", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-17T12:00:00Z"))
    const { strapi } = fixture({
      [SUGGESTION]: [idea(1)],
      [VOTE]: [
        {
          suggestionDocumentId: id(1),
          baUserId: "old",
          createdAt: "2026-09-30T23:59:59Z",
        },
        {
          suggestionDocumentId: id(1),
          baUserId: "new",
          createdAt: "2026-10-01T00:00:00Z",
        },
      ],
    })
    expect((await listSuggestions(strapi))[0]).toMatchObject({
      votes: 2,
      votesThisMonth: 1,
    })
  })
  it("withdraws unpublished comparison names from public proposals and blocks their approval", async () => {
    const optionId = "service000000000000000001"
    const { strapi } = fixture({
      [ROUND]: [round()],
      [SUGGESTION]: [
        idea(1, {
          publicationStatus: "pending",
          comparison: {
            documentId: optionId,
            name: "Private text",
            explanation: "A different service.",
          },
        }),
      ],
    })
    expect(
      await publicComparisons(strapi, [
        {
          optionKey: "services",
          comparison: {
            documentId: optionId,
            name: "Private text",
            explanation: "Different.",
          },
        },
      ])
    ).toEqual([{ optionKey: "services", comparison: null }])
    expect(await publishSuggestion(strapi, id(1), 0)).toMatchObject({
      ok: false,
    })
  })
  it("counts only visible discussion messages in public subjects", async () => {
    const target = { uid: SUGGESTION, documentId: id(1) }
    const { strapi } = fixture({
      "plugin::discussions.subject": [
        { documentId: "public", visibility: "public" },
        { documentId: "private", visibility: "members" },
      ],
      "plugin::discussions.thread": [
        {
          documentId: "visible",
          targetKey: `${SUGGESTION}:${id(1)}`,
          target,
          state: "visible",
          subjectId: "public",
        },
        {
          documentId: "pending",
          targetKey: `${SUGGESTION}:${id(1)}`,
          target,
          state: "pending",
          subjectId: "public",
        },
        {
          documentId: "secret",
          targetKey: `${SUGGESTION}:${id(1)}`,
          target,
          state: "visible",
          subjectId: "private",
        },
      ],
      "plugin::discussions.reply": [
        { documentId: "reply1", threadId: "visible", state: "visible" },
        {
          documentId: "orphan",
          threadId: "visible",
          state: "visible",
          parentId: "removed",
        },
        { threadId: "visible", state: "pending" },
        { threadId: "secret", state: "visible" },
      ],
    })
    expect((await suggestionCommentCounts(strapi, [id(1)])).get(id(1))).toBe(2)
  })
  it("keeps proposer attribution specific to each suggestion when an author participates in both", async () => {
    const { strapi } = fixture({
      [SUGGESTION]: [
        idea(1, { suggestedBy: "writer" }),
        idea(2, { suggestedBy: "other" }),
      ],
      "plugin::discussions.subject": [
        { documentId: "public", visibility: "public" },
      ],
      "plugin::discussions.thread": [1, 2].map((n) => ({
        documentId: `thread-${n}`,
        state: "visible",
        subjectId: "public",
        targetKey: `${SUGGESTION}:${id(n)}`,
        target: { uid: SUGGESTION, documentId: id(n) },
        authorKey: "ba:writer",
        createdAt: "2026-10-01T09:00:00Z",
      })),
      "api::user-profile.user-profile": [
        {
          documentId: "profile",
          baUserId: "writer",
          username: "writer",
          profileVisibility: "public",
        },
      ],
      "api::role-grant.role-grant": [
        {
          documentId: "grant",
          baUserId: "writer",
          role: "moderator",
          queue: "discussions",
          expiresAt: null,
        },
      ],
    })
    const summaries = await suggestionConversationSummaries(strapi, [
      id(1),
      id(2),
    ])
    expect(summaries.get(id(1))?.latestAuthor?.badges).toEqual([
      "moderator",
      "suggested_this",
    ])
    expect(summaries.get(id(2))?.latestAuthor?.badges).toEqual(["moderator"])
    expect(summaries.get(id(2))?.participants[0]?.badges).toEqual(["moderator"])
  })
  it("projects inline summaries from approved messages and respects profile privacy", async () => {
    const target = { uid: SUGGESTION, documentId: id(1) }
    const { strapi } = fixture({
      "plugin::discussions.subject": [
        { documentId: "public", visibility: "public" },
      ],
      "plugin::discussions.thread": [
        {
          documentId: "opening",
          state: "visible",
          subjectId: "public",
          targetKey: `${SUGGESTION}:${id(1)}`,
          target,
          authorKey: "ba:public-user",
          createdAt: "2026-10-01T09:00:00Z",
        },
      ],
      "plugin::discussions.reply": [
        {
          documentId: "approved",
          threadId: "opening",
          state: "visible",
          authorKey: "ba:hidden-user",
          createdAt: "2026-10-02T09:00:00Z",
        },
        {
          documentId: "pending",
          threadId: "opening",
          state: "pending",
          authorKey: "ba:public-user",
          createdAt: "2026-10-04T09:00:00Z",
        },
        {
          documentId: "orphan",
          threadId: "opening",
          parentId: "removed",
          state: "visible",
          authorKey: "ba:public-user",
          createdAt: "2026-10-05T09:00:00Z",
        },
      ],
      "api::user-profile.user-profile": [
        {
          documentId: "public-profile",
          baUserId: "public-user",
          username: "writer",
          profileVisibility: "public",
          email: "never-public@example.test",
        },
        {
          documentId: "secret-profile",
          baUserId: "hidden-user",
          username: "hidden",
          profileVisibility: "private",
          avatar: { url: "/secret.webp" },
        },
      ],
    })
    const summary = (
      await suggestionConversationSummaries(strapi, [id(1)])
    ).get(id(1))!
    expect(summary.count).toBe(2)
    expect(summary.latestAt).toBe("2026-10-02T09:00:00Z")
    expect(summary.latestAuthor).toEqual({ name: "Community member" })
    expect(summary.participants).toContainEqual({
      name: "@writer",
      slug: "writer",
      url: "/profile/writer",
    })
    expect(JSON.stringify(summary)).not.toMatch(
      /authorKey|baUserId|never-public|secret-profile|secret.webp|hidden-user/
    )
  })
})
