import { LANGUAGE_MESSAGE } from "@repo/shared-data"
import { describe, expect, it, vi } from "vitest"

import { toPublicSuggestion } from "../../src/plugins/content-moderation/server/controllers/option-suggestion"
import {
  createSuggestion,
  decideSuggestion,
  listSuggestions,
  NON_REMOVED_STATUSES,
  recordSuggestion,
  setSuggestionStatus,
  SUGGESTION,
  toggleVote,
  VOTE,
} from "../../src/plugins/content-moderation/server/utils/option-suggestions"
import { makeFakeStrapi, type FakeStrapiOptions } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const SERVICE = "api::service.service"
const PROFILE = "api::user-profile.user-profile"
const L1 = { documentId: "lib00000000000000000001", name: "Nailsea Library" }
const L2 = { documentId: "lib00000000000000000002", name: "Clevedon Library" }

function memoised(
  seed: Record<string, any[]> = {},
  extra: FakeStrapiOptions = {}
) {
  const made = makeFakeStrapi(seed, {
    tables: { cm_option_votes: VOTE },
    uniqueKeys: { [VOTE]: [["suggestionDocumentId", "baUserId"]] },
    ...extra,
  })
  const perUid = new Map<string, any>()
  const fresh = made.strapi.documents
  made.strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })

  return made
}

describe("recordSuggestion", () => {
  it("creates one suggestion per name and counts each request once", async () => {
    const { strapi, store } = memoised()
    const base = { optionKey: "services" as const, library: L1 }
    expect(
      await recordSuggestion(strapi, {
        ...base,
        name: "Seed  library",
        submissionId: "s1",
      })
    ).toBe("created")
    expect(
      await recordSuggestion(strapi, {
        ...base,
        name: "seed library",
        submissionId: "s1",
      })
    ).toBe("counted")
    await recordSuggestion(strapi, {
      ...base,
      library: L2,
      name: "SEED LIBRARY",
      submissionId: "s2",
    })
    expect(store[SUGGESTION]).toHaveLength(1)
    expect(store[SUGGESTION]![0]).toMatchObject({
      name: "Seed library",
      requests: 2,
      libraries: [L1, L2],
      submissionIds: ["s1", "s2"],
    })
  })

  it("keeps a declined name declined", async () => {
    const { strapi, store } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "Ghost tours",
          nameKey: "ghost tours",
          optionKey: "services",
          status: "declined",
          requests: 1,
        },
      ],
    })
    expect(
      await recordSuggestion(strapi, {
        optionKey: "services",
        name: "Ghost tours",
        library: L1,
        submissionId: "s9",
      })
    ).toBe("declined")
    expect(store[SUGGESTION]![0]!.requests).toBe(1)
  })
})

describe("votes", () => {
  const open = {
    documentId: "sug00000000000000000001",
    name: "Seed library",
    nameKey: "seed library",
    optionKey: "services",
    status: "open",
    requests: 2,
    libraries: [L1, L2],
  }

  it("toggles one vote per contributor and ranks by votes and requests", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        open,
        {
          ...open,
          documentId: "sug00000000000000000002",
          name: "Makerspace",
          nameKey: "makerspace",
          requests: 1,
        },
      ],
    })
    expect(await toggleVote(strapi, open.documentId, "u1")).toEqual({
      voted: true,
      votes: 1,
    })
    expect(await toggleVote(strapi, open.documentId, "u2")).toEqual({
      voted: true,
      votes: 2,
    })
    expect(await toggleVote(strapi, open.documentId, "u1")).toEqual({
      voted: false,
      votes: 1,
    })

    const list = await listSuggestions(strapi, { status: "open", viewer: "u2" })
    expect(list.map((s) => [s.name, s.votes, s.voted])).toEqual([
      ["Seed library", 1, true],
      ["Makerspace", 0, false],
    ])
  })

  it("two concurrent votes from one contributor leave exactly one vote", async () => {
    const { strapi, store } = memoised({ [SUGGESTION]: [open] })
    const results = await Promise.all([
      toggleVote(strapi, open.documentId, "u1"),
      toggleVote(strapi, open.documentId, "u1"),
    ])
    expect(store[VOTE]).toHaveLength(1)
    expect(results.map((r) => r?.voted)).toEqual([true, true])
    expect(results.map((r) => r?.votes)).toEqual([1, 1])
  })

  it("counts votes in the database, not by loading every vote row", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [open],
      [VOTE]: [
        {
          documentId: "v1",
          suggestionDocumentId: open.documentId,
          baUserId: "u1",
        },
        {
          documentId: "v2",
          suggestionDocumentId: open.documentId,
          baUserId: "u2",
        },
        { documentId: "v3", suggestionDocumentId: "other", baUserId: "u2" },
      ],
    })
    const list = await listSuggestions(strapi, { status: "open", viewer: "u2" })
    expect(list.map((s) => [s.votes, s.voted])).toEqual([[2, true]])
    expect(strapi.db.connection).toHaveBeenCalledWith("cm_option_votes")
    const voteReads = strapi
      .documents(VOTE)
      .findMany.mock.calls.map((c: any[]) => c[0])
    expect(voteReads).toHaveLength(1)
    expect(voteReads[0].filters).toMatchObject({ baUserId: { $eq: "u2" } })
  })

  it("refuses votes on decided suggestions", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [{ ...open, status: "accepted" }],
    })
    expect(await toggleVote(strapi, open.documentId, "u1")).toBeNull()
  })
})

describe("decideSuggestion", () => {
  const open = {
    documentId: "sug00000000000000000001",
    name: "seed library",
    nameKey: "seed library",
    optionKey: "services",
    status: "open",
    requests: 2,
    libraries: [L1, L2],
  }

  it("accepting creates the option, links it to every library that asked, and closes it", async () => {
    const { strapi, store } = memoised({
      [SUGGESTION]: [open],
      [LIBRARY]: [
        { documentId: L1.documentId, name: L1.name, locale: "en" },
        { documentId: L2.documentId, name: L2.name, locale: "en" },
      ],
    })
    const done = await decideSuggestion(strapi, {
      documentId: open.documentId,
      decision: "accept",
      decidedBy: "Board",
      name: "Seed library",
    })
    const option = store[SERVICE]![0]!
    expect(option.name).toBe("Seed library")
    const updates = strapi
      .documents(LIBRARY)
      .update.mock.calls.map((c: any[]) => c[0])
    expect(updates.map((u: any) => u.documentId)).toEqual([
      L1.documentId,
      L2.documentId,
    ])
    expect(updates[0].data.services).toEqual({
      connect: [{ documentId: option.documentId }],
    })
    expect(updates[0].status).toBe("published")
    expect(done).toMatchObject({
      ok: true,
      data: {
        status: "accepted",
        acceptedOptionDocumentId: option.documentId,
        decidedBy: "Board",
      },
    })
    // Decided once only.
    expect(
      await decideSuggestion(strapi, {
        documentId: open.documentId,
        decision: "decline",
        decidedBy: "Board",
        note: "Already decided",
      })
    ).toMatchObject({ ok: false, status: 404 })
  })

  it("accepting records the libraries it could not link, and still closes the suggestion", async () => {
    const L3 = { documentId: "lib00000000000000000003", name: "Gone Library" }
    const { strapi, store } = memoised({
      [SUGGESTION]: [{ ...open, libraries: [L1, L2, L3] }],
      [LIBRARY]: [
        { documentId: L1.documentId, name: L1.name, locale: "en" },
        // Never published: the publish guard refuses to apply to it.
        {
          documentId: L2.documentId,
          name: L2.name,
          locale: "en",
          publishedAt: null,
        },
      ],
    })
    const done = await decideSuggestion(strapi, {
      documentId: open.documentId,
      decision: "accept",
      decidedBy: "Board",
    })
    const option = store[SERVICE]![0]!
    const updates = strapi
      .documents(LIBRARY)
      .update.mock.calls.map((c: any[]) => c[0])
    expect(updates.map((u: any) => [u.documentId, u.status])).toEqual([
      [L1.documentId, "published"],
    ])
    expect(done).toMatchObject({
      ok: true,
      data: {
        status: "accepted",
        acceptedOptionDocumentId: option.documentId,
        unlinkedLibraries: [
          { ...L2, reason: "not_published" },
          { ...L3, reason: "not_found" },
        ],
      },
    })
    expect(store[SUGGESTION]![0]!.unlinkedLibraries).toHaveLength(2)
    const [view] = await listSuggestions(strapi, { status: "accepted" })
    expect(view!.unlinkedLibraries).toEqual(
      done.ok ? done.data.unlinkedLibraries : undefined
    )
  })

  it("accepting reuses an option that already has the name", async () => {
    const { strapi, store } = memoised({
      [SUGGESTION]: [{ ...open, libraries: [] }],
      [SERVICE]: [
        { documentId: "svc00000000000000000001", name: "Seed Library" },
      ],
    })
    await decideSuggestion(strapi, {
      documentId: open.documentId,
      decision: "accept",
      decidedBy: "Board",
    })
    expect(store[SERVICE]).toHaveLength(1)
    expect(store[SUGGESTION]![0]!.acceptedOptionDocumentId).toBe(
      "svc00000000000000000001"
    )
  })

  it("declining records the note and changes nothing else", async () => {
    const { strapi, store } = memoised({ [SUGGESTION]: [open] })
    await decideSuggestion(strapi, {
      documentId: open.documentId,
      decision: "decline",
      decidedBy: "Board",
      note: " Covered by Community space ",
    })
    expect(store[SUGGESTION]![0]).toMatchObject({
      status: "declined",
      decisionNote: "Covered by Community space",
    })
    expect(store[SERVICE]).toBeUndefined()
  })
})

describe("recordSuggestion: new statuses", () => {
  it("stores the submitter on create", async () => {
    const { strapi, store } = memoised()
    await recordSuggestion(strapi, {
      optionKey: "services",
      name: "Study pods",
      library: L1,
      submissionId: "s1",
      submittedBy: "u1",
    })
    expect(store[SUGGESTION]![0]).toMatchObject({ suggestedBy: "u1" })
  })

  it("treats a removed name like declined", async () => {
    const { strapi, store } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "Ghost tours",
          nameKey: "ghost tours",
          optionKey: "services",
          status: "removed",
          requests: 1,
        },
      ],
    })
    expect(
      await recordSuggestion(strapi, {
        optionKey: "services",
        name: "Ghost tours",
        library: L1,
        submissionId: "s9",
      })
    ).toBe("declined")
    expect(store[SUGGESTION]![0]!.requests).toBe(1)
  })

  it.each(["reviewing", "planned"] as const)(
    "counts a request on a %s suggestion",
    async (status) => {
      const { strapi, store } = memoised({
        [SUGGESTION]: [
          {
            documentId: "sug00000000000000000001",
            name: "Study pods",
            nameKey: "study pods",
            optionKey: "services",
            status,
            requests: 1,
            submissionIds: ["s1"],
            libraries: [L1],
          },
        ],
      })
      expect(
        await recordSuggestion(strapi, {
          optionKey: "services",
          name: "Study pods",
          library: L2,
          submissionId: "s2",
        })
      ).toBe("counted")
      expect(store[SUGGESTION]![0]!.requests).toBe(2)
    }
  )
})

describe("createSuggestion", () => {
  const base = { optionKey: "services" as const, baUserId: "u1" }

  it("creates an open suggestion with the creator's vote", async () => {
    const { strapi, store } = memoised()
    const result = await createSuggestion(strapi, {
      ...base,
      name: "Seed  library ",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok")
    expect(result.suggestion.votes).toBe(1)
    expect(result.suggestion.voted).toBe(true)
    expect(result.suggestion.status).toBe("open")
    // `requests` counts correction requests for the same name; the
    // creator's vote (not requests) already counts a direct post.
    expect(result.suggestion.requests).toBe(0)
    expect(store[SUGGESTION]![0]).toMatchObject({
      name: "Seed library",
      suggestedBy: "u1",
      requests: 0,
    })
  })

  it("refuses a name shorter than 2 characters after trimming", async () => {
    const { strapi } = memoised()
    expect(
      await createSuggestion(strapi, { ...base, name: " a " })
    ).toMatchObject({ ok: false, status: 400 })
  })

  it("refuses a name longer than 80 characters", async () => {
    const { strapi } = memoised()
    expect(
      await createSuggestion(strapi, { ...base, name: "x".repeat(81) })
    ).toMatchObject({ ok: false, status: 400 })
  })

  it("refuses a description longer than 400 characters", async () => {
    const { strapi } = memoised()
    expect(
      await createSuggestion(strapi, {
        ...base,
        name: "Study pods",
        description: "x".repeat(401),
      })
    ).toMatchObject({ ok: false, status: 400 })
  })

  it("refuses unsafe text in the name", async () => {
    const { strapi } = memoised()
    const result = await createSuggestion(strapi, {
      ...base,
      name: "Fucking great service",
    })
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      message: LANGUAGE_MESSAGE,
    })
  })

  it("refuses unsafe text in the description", async () => {
    const { strapi } = memoised()
    const result = await createSuggestion(strapi, {
      ...base,
      name: "Study pods",
      description: "Fucking great service",
    })
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      message: LANGUAGE_MESSAGE,
    })
  })
})

describe("createSuggestion: suggester name", () => {
  it("carries the creator's own suggestedByName when their activity is public", async () => {
    const { strapi } = memoised({
      [PROFILE]: [
        {
          documentId: "p00000000000000000000001",
          baUserId: "u1",
          firstName: "Alex",
          lastName: "Bennett",
          username: "alexb",
          profileVisibility: "public",
          publicPrefs: {},
        },
      ],
    })
    const result = await createSuggestion(strapi, {
      optionKey: "services",
      name: "Study pods",
      baUserId: "u1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok")
    expect(result.suggestion.suggestedByName).toBe("Alex B.")
  })

  it("is null when the creator's activity isn't public", async () => {
    const { strapi } = memoised({
      [PROFILE]: [
        {
          documentId: "p00000000000000000000001",
          baUserId: "u1",
          firstName: "Alex",
          lastName: "Bennett",
          username: "alexb",
          profileVisibility: "private",
          publicPrefs: {},
        },
      ],
    })
    const result = await createSuggestion(strapi, {
      optionKey: "services",
      name: "Study pods",
      baUserId: "u1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("expected ok")
    expect(result.suggestion.suggestedByName).toBeNull()
  })
})

describe("createSuggestion: duplicates and limits", () => {
  it("refuses a name that matches a published option in that list", async () => {
    const { strapi } = memoised({
      [SERVICE]: [{ documentId: "svc00000000000000000001", name: "Printing" }],
    })
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "printing",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 409,
      message: "That option is already in the lists.",
    })
  })

  it("refuses a library_types name that matches the libraryType enum", async () => {
    const { strapi } = memoised(
      {},
      {
        contentTypes: {
          [LIBRARY]: {
            attributes: {
              libraryType: { enum: ["National", "Public", "Academic"] },
            },
          },
        },
      }
    )
    expect(
      await createSuggestion(strapi, {
        optionKey: "library_types",
        name: "public",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 409,
      message: "That option is already in the lists.",
    })
  })

  it("refuses a duplicate active suggestion, naming it for voting", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "Study pods",
          nameKey: "study pods",
          optionKey: "services",
          status: "reviewing",
          requests: 1,
        },
      ],
    })
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "Study Pods",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 409,
      message: "Someone has already suggested this. Vote for it instead.",
      existingDocumentId: "sug00000000000000000001",
    })
  })

  it("refuses when the match was accepted", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "Study pods",
          nameKey: "study pods",
          optionKey: "services",
          status: "accepted",
          requests: 1,
        },
      ],
    })
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "Study Pods",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 409,
      message: "Someone has already suggested this. Vote for it instead.",
      existingDocumentId: "sug00000000000000000001",
    })
  })

  it("refuses when the match was declined", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "Ghost tours",
          nameKey: "ghost tours",
          optionKey: "services",
          status: "declined",
          requests: 1,
        },
      ],
    })
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "Ghost tours",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 409,
      message: "The editorial board decided not to add this one.",
    })
  })

  it("refuses when the match was removed", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "Ghost tours",
          nameKey: "ghost tours",
          optionKey: "services",
          status: "removed",
          requests: 1,
        },
      ],
    })
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "Ghost tours",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 409,
      message: "The editorial board decided not to add this one.",
    })
  })

  it("limits a contributor to 5 suggestions a day", async () => {
    const now = new Date().toISOString()
    const rows = Array.from({ length: 5 }, (_, i) => ({
      documentId: `sug0000000000000000000${i}`,
      name: `Idea ${i}`,
      nameKey: `idea ${i}`,
      optionKey: "services",
      status: "open",
      requests: 0,
      suggestedBy: "u1",
      createdAt: now,
    }))
    const { strapi } = memoised({ [SUGGESTION]: rows })
    expect(
      await createSuggestion(strapi, {
        optionKey: "services",
        name: "One more idea",
        baUserId: "u1",
      })
    ).toMatchObject({
      ok: false,
      status: 429,
      message: "You can suggest up to 5 options a day.",
    })
  })

  it("only counts a contributor's own suggestions from the last 24 hours", async () => {
    const now = new Date().toISOString()
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const own = Array.from({ length: 4 }, (_, i) => ({
      documentId: `sug000000000000000000${10 + i}`,
      name: `Idea ${i}`,
      nameKey: `idea ${i}`,
      optionKey: "services",
      status: "open",
      requests: 0,
      suggestedBy: "u1",
      createdAt: now,
    }))
    const rows = [
      ...own,
      // Older than 24h: doesn't count toward the limit.
      {
        documentId: "sug00000000000000000098",
        name: "Old idea",
        nameKey: "old idea",
        optionKey: "services",
        status: "open",
        requests: 0,
        suggestedBy: "u1",
        createdAt: twoDaysAgo,
      },
      // Someone else's suggestion, posted today: doesn't count either.
      {
        documentId: "sug00000000000000000099",
        name: "Someone else's idea",
        nameKey: "someone else's idea",
        optionKey: "services",
        status: "open",
        requests: 0,
        suggestedBy: "u2",
        createdAt: now,
      },
    ]
    const { strapi } = memoised({ [SUGGESTION]: rows })
    const result = await createSuggestion(strapi, {
      optionKey: "services",
      name: "A fifth idea today",
      baUserId: "u1",
    })
    expect(result.ok).toBe(true)
  })
})

describe("toggleVote: new statuses", () => {
  const row = (status: string) => ({
    documentId: "sug00000000000000000001",
    name: "A",
    nameKey: "a",
    optionKey: "services",
    status,
    requests: 1,
  })

  it.each(["open", "reviewing", "planned"] as const)(
    "accepts votes on %s suggestions",
    async (status) => {
      const { strapi } = memoised({ [SUGGESTION]: [row(status)] })
      expect(await toggleVote(strapi, "sug00000000000000000001", "u1")).toEqual(
        { voted: true, votes: 1 }
      )
    }
  )

  it.each(["accepted", "declined", "removed"] as const)(
    "refuses votes on %s suggestions",
    async (status) => {
      const { strapi } = memoised({ [SUGGESTION]: [row(status)] })
      expect(
        await toggleVote(strapi, "sug00000000000000000001", "u1")
      ).toBeNull()
    }
  )
})

describe("setSuggestionStatus", () => {
  const open = {
    documentId: "sug00000000000000000001",
    name: "A",
    nameKey: "a",
    optionKey: "services",
    status: "open",
    requests: 1,
  }

  it("review moves open to reviewing and records no decision", async () => {
    const { strapi, store } = memoised({ [SUGGESTION]: [open] })
    const result = await setSuggestionStatus(strapi, {
      documentId: open.documentId,
      status: "reviewing",
      decidedBy: "Board",
    })
    expect(result).toMatchObject({ status: "reviewing" })
    expect(store[SUGGESTION]![0]!.decidedAt).toBeUndefined()
    expect(store[SUGGESTION]![0]!.decidedBy).toBeUndefined()
  })

  it.each(["open", "reviewing"] as const)(
    "plan moves %s to planned and stores a note",
    async (from) => {
      const { strapi, store } = memoised({
        [SUGGESTION]: [{ ...open, status: from }],
      })
      const result = await setSuggestionStatus(strapi, {
        documentId: open.documentId,
        status: "planned",
        decidedBy: "Board",
        note: " Coming in Q2 ",
      })
      expect(result).toMatchObject({
        status: "planned",
        decisionNote: "Coming in Q2",
        decidedBy: "Board",
      })
      expect(store[SUGGESTION]![0]!.decidedAt).toBeDefined()
    }
  )

  it.each(["open", "reviewing", "planned"] as const)(
    "remove moves %s to removed",
    async (from) => {
      const { strapi } = memoised({
        [SUGGESTION]: [{ ...open, status: from }],
      })
      const result = await setSuggestionStatus(strapi, {
        documentId: open.documentId,
        status: "removed",
        decidedBy: "Board",
      })
      expect(result).toMatchObject({ status: "removed", decidedBy: "Board" })
    }
  )

  it.each(["accepted", "declined", "removed"] as const)(
    "can't move a final status (%s)",
    async (from) => {
      const { strapi } = memoised({
        [SUGGESTION]: [{ ...open, status: from }],
      })
      expect(
        await setSuggestionStatus(strapi, {
          documentId: open.documentId,
          status: "removed",
          decidedBy: "Board",
        })
      ).toBeNull()
      expect(
        await setSuggestionStatus(strapi, {
          documentId: open.documentId,
          status: "reviewing",
          decidedBy: "Board",
        })
      ).toBeNull()
    }
  )
})

describe("decideSuggestion: decline validation", () => {
  it("refuses a decline without a note", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "A",
          nameKey: "a",
          optionKey: "services",
          status: "open",
          requests: 1,
        },
      ],
    })
    expect(
      await decideSuggestion(strapi, {
        documentId: "sug00000000000000000001",
        decision: "decline",
        decidedBy: "Board",
      })
    ).toMatchObject({
      ok: false,
      status: 400,
      message: "Add a note: it’s shown with the suggestion.",
    })
  })
})

describe("decideSuggestion: accept from any undecided status", () => {
  it.each(["open", "reviewing", "planned"] as const)(
    "accepts from %s",
    async (status) => {
      const { strapi } = memoised({
        [SUGGESTION]: [
          {
            documentId: "sug00000000000000000001",
            name: "A",
            nameKey: "a",
            optionKey: "services",
            status,
            requests: 1,
            libraries: [],
          },
        ],
      })
      const result = await decideSuggestion(strapi, {
        documentId: "sug00000000000000000001",
        decision: "accept",
        decidedBy: "Board",
      })
      expect(result).toMatchObject({ ok: true, data: { status: "accepted" } })
    }
  )
})

describe("decideSuggestion: library_types", () => {
  const libType = {
    documentId: "sug00000000000000000002",
    name: "makerspace",
    nameKey: "makerspace",
    optionKey: "library_types",
    status: "planned",
    requests: 1,
    libraries: [],
  }

  it("refuses to accept a name not in the enum", async () => {
    const { strapi } = memoised(
      { [SUGGESTION]: [libType] },
      {
        contentTypes: {
          [LIBRARY]: {
            attributes: { libraryType: { enum: ["National", "Public"] } },
          },
        },
      }
    )
    expect(
      await decideSuggestion(strapi, {
        documentId: libType.documentId,
        decision: "accept",
        decidedBy: "Board",
      })
    ).toMatchObject({
      ok: false,
      status: 400,
      message:
        "Add the library type to the schema first, then accept it. Mark it planned until then.",
    })
  })

  it("accepts and renames to the enum's spelling, creating no option", async () => {
    const { strapi, store } = memoised(
      { [SUGGESTION]: [libType] },
      {
        contentTypes: {
          [LIBRARY]: {
            attributes: {
              libraryType: { enum: ["National", "Public", "Makerspace"] },
            },
          },
        },
      }
    )
    const result = await decideSuggestion(strapi, {
      documentId: libType.documentId,
      decision: "accept",
      decidedBy: "Board",
    })
    expect(result).toMatchObject({
      ok: true,
      data: { status: "accepted", name: "Makerspace" },
    })
    expect(store[SERVICE]).toBeUndefined()
  })

  it("matches the enum against the board's tidied name, not the stored one", async () => {
    const { strapi, store } = memoised(
      { [SUGGESTION]: [{ ...libType, name: "Prison library" }] },
      {
        contentTypes: {
          [LIBRARY]: {
            attributes: { libraryType: { enum: ["National", "Prison"] } },
          },
        },
      }
    )
    const result = await decideSuggestion(strapi, {
      documentId: libType.documentId,
      decision: "accept",
      decidedBy: "Board",
      name: "Prison",
    })
    expect(result).toMatchObject({
      ok: true,
      data: { status: "accepted", name: "Prison" },
    })
    expect(store[SERVICE]).toBeUndefined()
  })
})

describe("listSuggestions: suggester names and board notes", () => {
  it("names the suggester when their activity is public, else null", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "A",
          nameKey: "a",
          optionKey: "services",
          status: "open",
          requests: 1,
          suggestedBy: "pub1",
        },
        {
          documentId: "sug00000000000000000002",
          name: "B",
          nameKey: "b",
          optionKey: "services",
          status: "open",
          requests: 1,
          suggestedBy: "priv1",
        },
      ],
      [PROFILE]: [
        {
          documentId: "p00000000000000000000001",
          baUserId: "pub1",
          firstName: "Alex",
          lastName: "Bennett",
          username: "alexb",
          profileVisibility: "public",
          publicPrefs: {},
        },
        {
          documentId: "p00000000000000000000002",
          baUserId: "priv1",
          firstName: "Sam",
          lastName: "Lee",
          username: "samlee",
          profileVisibility: "private",
          publicPrefs: {},
        },
      ],
    })
    const list = await listSuggestions(strapi)
    const byName = Object.fromEntries(
      list.map((s) => [s.name, s.suggestedByName])
    )
    expect(byName.A).toBe("Alex B.")
    expect(byName.B).toBeNull()
  })

  it("returns the real decisionNote for every status (the board and admin see it all)", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "A",
          nameKey: "a",
          optionKey: "services",
          status: "accepted",
          requests: 1,
          decisionNote: "Internal note",
        },
        {
          documentId: "sug00000000000000000002",
          name: "B",
          nameKey: "b",
          optionKey: "services",
          status: "declined",
          requests: 1,
          decisionNote: "Not needed",
        },
      ],
    })
    const list = await listSuggestions(strapi)
    const notes = Object.fromEntries(list.map((s) => [s.name, s.decisionNote]))
    expect(notes).toEqual({ A: "Internal note", B: "Not needed" })
  })
})

describe("listSuggestions: statuses filter", () => {
  it("excludes removed suggestions, the way the public and board lists do", async () => {
    const { strapi } = memoised({
      [SUGGESTION]: [
        {
          documentId: "sug00000000000000000001",
          name: "A",
          nameKey: "a",
          optionKey: "services",
          status: "open",
          requests: 1,
        },
        {
          documentId: "sug00000000000000000002",
          name: "B",
          nameKey: "b",
          optionKey: "services",
          status: "removed",
          requests: 1,
        },
      ],
    })
    const list = await listSuggestions(strapi, {
      statuses: NON_REMOVED_STATUSES,
    })
    expect(list.map((s) => s.name)).toEqual(["A"])
  })
})

describe("toPublicSuggestion", () => {
  const base = {
    documentId: "sug00000000000000000001",
    name: "A",
    optionKey: "services" as const,
    requests: 0,
    votes: 2,
    libraries: [],
    unlinkedLibraries: [],
    description: null,
    suggestedBy: null,
    suggestedByName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    decidedAt: null,
    decidedBy: null,
  }

  it("hides the decisionNote outside declined and planned", () => {
    expect(
      toPublicSuggestion({
        ...base,
        status: "accepted",
        decisionNote: "Internal note",
      }).decisionNote
    ).toBeNull()
    expect(
      toPublicSuggestion({
        ...base,
        status: "open",
        decisionNote: "Should never appear",
      }).decisionNote
    ).toBeNull()
  })

  it("shows the decisionNote for declined and planned", () => {
    expect(
      toPublicSuggestion({
        ...base,
        status: "declined",
        decisionNote: "Not needed",
      }).decisionNote
    ).toBe("Not needed")
    expect(
      toPublicSuggestion({
        ...base,
        status: "planned",
        decisionNote: "Coming in Q2",
      }).decisionNote
    ).toBe("Coming in Q2")
  })

  it("has no libraries list, only a count", () => {
    const result = toPublicSuggestion({
      ...base,
      status: "open",
      decisionNote: null,
      libraries: [{ documentId: "lib1", name: "Nailsea Library" }],
    })
    expect(result).not.toHaveProperty("libraries")
    expect(result.libraryCount).toBe(1)
  })
})
