import { describe, expect, it, vi } from "vitest"

import {
  decideSuggestion,
  listSuggestions,
  recordSuggestion,
  SUGGESTION,
  toggleVote,
  VOTE,
} from "../../src/plugins/content-moderation/server/utils/option-suggestions"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const SERVICE = "api::service.service"
const L1 = { documentId: "lib00000000000000000001", name: "Nailsea Library" }
const L2 = { documentId: "lib00000000000000000002", name: "Clevedon Library" }

function memoised(seed: Record<string, any[]> = {}) {
  const made = makeFakeStrapi(seed, {
    tables: { cm_option_votes: VOTE },
    uniqueKeys: { [VOTE]: [["suggestionDocumentId", "baUserId"]] },
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
      status: "accepted",
      acceptedOptionDocumentId: option.documentId,
      decidedBy: "Board",
    })
    // Decided once only.
    expect(
      await decideSuggestion(strapi, {
        documentId: open.documentId,
        decision: "decline",
        decidedBy: "Board",
      })
    ).toBeNull()
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
      status: "accepted",
      acceptedOptionDocumentId: option.documentId,
      unlinkedLibraries: [
        { ...L2, reason: "not_published" },
        { ...L3, reason: "not_found" },
      ],
    })
    expect(store[SUGGESTION]![0]!.unlinkedLibraries).toHaveLength(2)
    const [view] = await listSuggestions(strapi, { status: "accepted" })
    expect(view!.unlinkedLibraries).toEqual(done!.unlinkedLibraries)
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
