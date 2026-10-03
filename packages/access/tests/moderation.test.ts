import { describe, expect, it } from "vitest"

import {
  canModerate,
  canModerateApplication,
  fromSessionCapabilities,
  highestRole,
  QUEUE_OF_SUBMISSION_TYPE,
  resolveCapabilities,
  SUBMISSION_TYPES,
  submissionTypesOfQueue,
  toSessionCapabilities,
  type RoleGrant,
  type SubmissionType,
} from "../src"

const caps = (grants: RoleGrant[]) =>
  resolveCapabilities({ signedIn: true, grants, claims: [] })

const sub = (submissionType: SubmissionType, locale = "en") => ({
  submissionType,
  locale,
  submittedByUserId: "author",
})

describe("canModerate", () => {
  it("lets a global moderator see every submission type", () => {
    const c = caps([{ role: "moderator", queue: "all", locale: null }])
    expect(c.set.has("moderate.queue")).toBe(true)
    for (const t of SUBMISSION_TYPES)
      expect(canModerate(c, sub(t, "de"), "viewer")).toBe(true)
  })

  it("limits a scoped moderator to its queue and locale", () => {
    const c = caps([{ role: "moderator", queue: "knowledge", locale: "fr" }])
    expect(c.moderation).toEqual([{ queue: "knowledge", locale: "fr" }])
    expect(canModerate(c, sub("wiki_edit", "fr"), "viewer")).toBe(true)
    expect(canModerate(c, sub("blog_submission", "fr"), "viewer")).toBe(false)
    expect(canModerate(c, sub("wiki_edit", "en"), "viewer")).toBe(false)
  })

  it("covers applications with queue all", () => {
    const c = caps([{ role: "moderator", queue: "all", locale: null }])
    expect(canModerate(c, sub("role_application"), "viewer")).toBe(true)
  })

  it("never lets anyone moderate their own submission", () => {
    for (const role of ["moderator", "editorial_board"] as const) {
      const c = caps([{ role, queue: "all", locale: null }])
      expect(canModerate(c, sub("correction"), "author")).toBe(false)
    }
  })

  it("denies users without a moderation scope", () => {
    const c = caps([{ role: "wiki_editor", queue: "all", locale: null }])
    expect(c.set.has("moderate.queue")).toBe(false)
    expect(canModerate(c, sub("wiki_edit"), "viewer")).toBe(false)
  })
})

describe("canModerateApplication", () => {
  const app = (locales: string[], submittedByUserId = "author") => ({
    locales,
    submittedByUserId,
  })

  it("lets a moderator with no locale review every application", () => {
    for (const queue of ["all", "applications"] as const) {
      const c = caps([{ role: "moderator", queue, locale: null }])
      expect(canModerateApplication(c, app([]), "viewer")).toBe(true)
      expect(canModerateApplication(c, app(["fr", "de"]), "viewer")).toBe(true)
    }
    const board = caps([
      { role: "editorial_board", queue: "all", locale: null },
    ])
    expect(canModerateApplication(board, app([]), "viewer")).toBe(true)
  })

  it("limits a locale-scoped moderator to applications for that locale only", () => {
    for (const queue of ["all", "applications"] as const) {
      const c = caps([{ role: "moderator", queue, locale: "fr" }])
      expect(canModerateApplication(c, app(["fr"]), "viewer")).toBe(true)
      expect(canModerateApplication(c, app(["fr", "de"]), "viewer")).toBe(false)
      expect(canModerateApplication(c, app(["de"]), "viewer")).toBe(false)
      // Every language: only a moderator with no locale may decide it.
      expect(canModerateApplication(c, app([]), "viewer")).toBe(false)
    }
  })

  it("needs a scope that covers the applications queue", () => {
    const c = caps([{ role: "moderator", queue: "knowledge", locale: null }])
    expect(canModerateApplication(c, app(["fr"]), "viewer")).toBe(false)
  })

  it("never lets anyone review their own application", () => {
    const c = caps([{ role: "moderator", queue: "all", locale: null }])
    expect(canModerateApplication(c, app(["fr"], "viewer"), "viewer")).toBe(
      false
    )
  })
})

describe("moderation queues", () => {
  it("maps every submission type to a queue", () => {
    for (const t of SUBMISSION_TYPES)
      expect(QUEUE_OF_SUBMISSION_TYPE[t]).toBeDefined()
    expect(Object.keys(QUEUE_OF_SUBMISSION_TYPE).sort()).toEqual(
      [...SUBMISSION_TYPES].sort()
    )
  })

  it("lists the six index types", () => {
    expect(submissionTypesOfQueue("index").sort()).toEqual(
      [
        "correction",
        "new_library",
        "library_claim",
        "library_edit",
        "topic_suggestion",
        "location_request",
      ].sort()
    )
    expect(submissionTypesOfQueue("knowledge")).toEqual(["wiki_edit"])
    expect(submissionTypesOfQueue("journal")).toEqual(["blog_submission"])
    expect(submissionTypesOfQueue("applications")).toEqual(["role_application"])
  })
})

describe("session capabilities", () => {
  it("round-trips through JSON", () => {
    const c = resolveCapabilities({
      signedIn: true,
      grants: [
        { role: "wiki_editor", queue: "all", locale: "fr" },
        { role: "wiki_editor", queue: "all", locale: "de" },
        { role: "journal_editor", queue: "all", locale: null },
        { role: "moderator", queue: "index", locale: "en" },
      ],
      claims: [{ libraryDocumentId: "lib1" }],
    })
    const back = fromSessionCapabilities(
      // eslint-disable-next-line unicorn/prefer-structured-clone -- proves the session form survives JSON, which structuredClone would not test
      JSON.parse(JSON.stringify(toSessionCapabilities(c)))
    )
    expect([...back.set].sort()).toEqual([...c.set].sort())
    expect([...back.claimedLibraryIds]).toEqual(["lib1"])
    expect(back.moderation).toEqual([{ queue: "index", locale: "en" }])
    expect(back.editorLocales.journal).toBe("all")
    expect(back.editorLocales.docs).not.toBe("all")
    expect(
      [...(back.editorLocales.docs as ReadonlySet<string>)].sort()
    ).toEqual(["de", "fr"])
  })

  it("reads a missing session as no capabilities", () => {
    for (const s of [null, undefined, {}]) {
      const c = fromSessionCapabilities(s)
      expect(c.set.size).toBe(0)
      expect(c.moderation).toEqual([])
      expect(c.editorLocales.docs).not.toBe("all")
    }
  })
})

describe("highestRole", () => {
  it("is reader with no grants", () => {
    expect(highestRole([])).toBe("reader")
  })

  it("picks the highest granted role", () => {
    expect(highestRole([{ role: "moderator" }, { role: "wiki_editor" }])).toBe(
      "moderator"
    )
  })
})
