import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { eraseAccount } from "../src/utils/erase-account"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const UPLOAD = "plugin::content-moderation.submission-upload"
const VOTE = "plugin::content-moderation.option-vote"
const AFF = "api::library-affiliation.library-affiliation"
const SAVED = "api::saved-event.saved-event"
const GRANT = "api::entitlement-grant.entitlement-grant"
const VERIFY = "api::pro-verification.pro-verification"
const ROLE_GRANT = "api::role-grant.role-grant"
const SUBSCRIBER = "api::subscriber.subscriber"
const POINTS = "plugin::rewards.point-event"
const BADGES = "plugin::rewards.badge-award"
const SNAPSHOT = "plugin::rewards.leaderboard-snapshot"
const UP_USER = "plugin::users-permissions.user"
const UP_FILE = "plugin::upload.file"
const CRED = "plugin::events.event-credential"
const CRED_EVENT = "plugin::events.credential-event"

const ERASED =
  /^deleted-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function seed() {
  const avatar = { id: 77, name: "me.jpg", url: "/uploads/me.jpg" }
  const faked = makeFakeStrapi({
    [PROFILE]: [
      {
        documentId: "p1",
        id: 1,
        baUserId: "u1",
        contributorNumber: 42,
        username: "alice",
        firstName: "Alice",
        lastName: "Smith",
        bio: "Librarian in Leeds",
        city: "Leeds",
        avatar,
        profileVisibility: "public",
        isVerifiedLibrarian: true,
        contributorRole: "verified_librarian",
        languages: [{ code: "en", proficiency: "native" }],
        interests: [{ documentId: "t1", name: "Maps", slug: "maps" }],
        notifPrefs: { weeklyDigest: true },
        publicPrefs: { showLocation: true },
        followedLibraries: [{ documentId: "lib1" }],
        followedProfiles: [{ documentId: "p2" }],
        points: 120,
        streak: 3,
        lastActivityDate: "2026-09-26",
        earnedProUntil: "2099-01-01T00:00:00.000Z",
      },
      { documentId: "p2", id: 2, baUserId: "u2", username: "bob" },
    ],
    [SUB]: [
      {
        documentId: "s1",
        status: "approved",
        submittedByUserId: "u1",
        submittedByEmail: "alice@example.org",
        submittedByName: "Alice Smith",
        fields: { kind: "photo", photoId: 10, credit: "Alice" },
        note: "approved note",
        evidenceType: "personal_communication",
        evidenceUrl: "https://private.example/person",
      },
      {
        documentId: "s2",
        status: "pending",
        submittedByUserId: "u1",
        submittedByEmail: "alice@example.org",
        fields: { kind: "photo", photoId: 9, credit: "Alice" },
        draftData: { step: 2 },
        note: "my phone number is 0113 000",
      },
      {
        documentId: "s3",
        status: "draft",
        submittedByUserId: "u1",
        submittedByEmail: "alice@example.org",
        fields: { kind: "record", name: "X" },
        draftData: { fields: { photoId: 11 } },
        note: "draft note",
      },
      {
        documentId: "s4",
        status: "needs_info",
        submittedByUserId: "u1",
        submittedByEmail: "alice@example.org",
        fields: { kind: "record" },
        note: "n",
      },
      {
        documentId: "s5",
        submittedByUserId: "u2",
        submittedByEmail: "b@x.org",
        status: "pending",
        fields: { kind: "record" },
      },
      {
        documentId: "s6",
        status: "pending",
        submissionType: "event_feed",
        submittedByUserId: "u1",
        submittedByEmail: "alice@example.org",
        fields: { kind: "replace", credentialDocumentId: "cred-active" },
      },
    ],
    ["api::library-change.library-change"]: [
      {
        documentId: "change",
        actorId: "ba:u1",
        actorName: "Alice",
        reviewerId: "u1",
        next: {
          sourceRecords: [{ url: "https://public.example", role: "reference" }],
        },
      },
      {
        documentId: "staff-change",
        actorId: "ba:u1",
        actorName: "Alice",
        reviewerId: "ba:u1",
        next: "Retained public fact",
      },
    ],
    [CRED]: [
      { documentId: "cred-pending", status: "pending", connectedBy: "ba:u1" },
      {
        documentId: "cred-active",
        status: "active",
        connectedBy: "ba:u1",
        pendingSubmissionDocumentId: "s6",
        pendingCredentialsEncrypted: "encrypted-blob",
        pendingHints: { url: "https://example.org/cal.ics" },
        pendingTestedAt: "2026-10-01T00:00:00.000Z",
        pendingTestResult: "ok",
      },
    ],
    [CRED_EVENT]: [
      { documentId: "ce1", actor: "ba:u1", action: "connect_submitted" },
    ],
    [UP_FILE]: [
      { id: 9, documentId: "f9", name: "pending.jpg" },
      { id: 10, documentId: "f10", name: "approved.jpg" },
      { id: 11, documentId: "f11", name: "draft.jpg" },
    ],
    [UPLOAD]: [
      { documentId: "up1", baUserId: "u1", fileId: 9 },
      { documentId: "up2", baUserId: "u1", fileId: 10 },
    ],
    [VOTE]: [
      { documentId: "v1", baUserId: "u1", suggestionDocumentId: "sug1" },
      { documentId: "v2", baUserId: "u2", suggestionDocumentId: "sug1" },
    ],
    [AFF]: [{ documentId: "a1", baUserId: "u1" }],
    [SAVED]: [
      { documentId: "e1", baUserId: "u1", eventDocumentId: "ev1" },
      { documentId: "e2", baUserId: "u2", eventDocumentId: "ev1" },
    ],
    [GRANT]: [{ documentId: "g1", baUserId: "u1", plan: "pro" }],
    [VERIFY]: [
      { documentId: "pv1", baUserId: "u1", kind: "student" },
      { documentId: "pv2", baUserId: "u2", kind: "student" },
    ],
    [ROLE_GRANT]: [
      { documentId: "rg1", baUserId: "u1", role: "verified_librarian" },
      { documentId: "rg2", baUserId: "u1", role: "moderator" },
      { documentId: "rg3", baUserId: "u2", role: "wiki_editor" },
    ],
    [SUBSCRIBER]: [
      { documentId: "n1", email: "Alice@Example.org" },
      { documentId: "n2", email: "someone@else.org" },
    ],
    [POINTS]: [{ documentId: "pt1", baUserId: "u1", points: 5 }],
    [BADGES]: [{ documentId: "b1", baUserId: "u1", badgeId: "verifier" }],
    [SNAPSHOT]: [
      {
        documentId: "snap1",
        id: 5,
        entries: [
          { baUserId: "u1", username: "alice", rank: 1, periodPoints: 20 },
          { baUserId: "u2", username: "bob", rank: 2, periodPoints: 10 },
        ],
      },
    ],
    [UP_USER]: [{ documentId: "uu1", id: 3, email: "alice@example.org" }],
  })
  const remove = vi.fn()
  faked.services["upload.upload"] = { remove }

  return { ...faked, avatar, remove }
}

describe("eraseAccount", () => {
  it("strips personal data, follows, preferences and earned Pro from the profile", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    const profile = store[PROFILE].find((p) => p.documentId === "p1")!
    expect(profile).toMatchObject({
      baUserId: expect.stringMatching(ERASED),
      username: "deleted-42",
      firstName: "Deleted",
      lastName: "User",
      bio: null,
      city: null,
      avatar: null,
      profileVisibility: "private",
      isVerifiedLibrarian: false,
      contributorRole: "reader",
      languages: [],
      interests: [],
      notifPrefs: null,
      dismissedPrompts: null,
      publicPrefs: null,
      followedLibraries: { set: [] },
      followedDrives: { set: [] },
      followedProfiles: { set: [] },
      points: 0,
      streak: 0,
      lastActivityDate: null,
      earnedProUntil: null,
    })
  })

  it("re-keys everything to one random id that is not derived from the account", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    const erased = store[PROFILE][0].baUserId
    expect(erased).toMatch(ERASED)
    expect(erased).not.toContain("u1")
    expect(store[SUB][0].submittedByUserId).toBe(erased)
    expect(store[POINTS][0].baUserId).toBe(erased)
    expect(store[BADGES][0].baUserId).toBe(erased)
    expect(store[SNAPSHOT][0].entries[0].baUserId).toBe(erased)
  })

  it("runs inside one database transaction", async () => {
    const { strapi } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(strapi.db.transaction).toHaveBeenCalledTimes(1)
  })

  it("erases a profile cover and its selected background along with the avatar", async () => {
    const { strapi, store, remove } = seed()
    const cover = { id: 78, name: "cover.webp", url: "/uploads/cover.webp" }
    store[PROFILE][0]!.coverImage = cover
    store[PROFILE][0]!.profileBackground = "rose"
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })
    expect(remove).toHaveBeenCalledWith(cover)
    expect(store[PROFILE][0]).toMatchObject({
      coverImage: null,
      profileBackground: "violet",
    })
  })

  it("deletes the avatar file", async () => {
    const { strapi, remove, avatar } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(remove).toHaveBeenCalledWith(avatar)
  })

  it("deletes saved events, claims, votes, grants, verifications, upload ownership, the newsletter row and the users-permissions user", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[SAVED].map((e) => e.documentId)).toEqual(["e2"])
    expect(store[AFF]).toEqual([])
    expect(store[UPLOAD]).toEqual([])
    expect(store[VOTE].map((v) => v.documentId)).toEqual(["v2"])
    expect(store[GRANT]).toEqual([])
    expect(store[VERIFY].map((v) => v.documentId)).toEqual(["pv2"])
    expect(store[SUBSCRIBER].map((n) => n.documentId)).toEqual(["n2"])
    expect(store[UP_USER]).toEqual([])
  })

  it("erases owned notifications and guest newsletter delivery records for the deleted address", async () => {
    const { strapi, store } = seed()
    const notifications = "api::notification.notification"
    store[notifications] = [
      { documentId: "owned", baUserId: "u1" },
      { documentId: "confirmation", recipientEmail: "alice@example.org" },
      {
        documentId: "other",
        baUserId: "u2",
        recipientEmail: "bob@example.org",
      },
    ]
    await eraseAccount(strapi, { baUserId: "u1", email: "Alice@Example.org" })
    expect(store[notifications].map((n) => n.documentId)).toEqual(["other"])
  })

  it("deletes every role grant the user holds, and only theirs", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[ROLE_GRANT].map((g) => g.documentId)).toEqual(["rg3"])
  })

  it("anonymises submissions, blanks the unfinished ones and deletes their photos, keeps approved content", async () => {
    const { strapi, store, remove } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    const by = (id: string) => store[SUB].find((s) => s.documentId === id)!
    for (const id of ["s1", "s2", "s3", "s4"]) {
      expect(by(id)).toMatchObject({
        submittedByUserId: expect.stringMatching(ERASED),
        submittedByEmail: "deleted@invalid",
        submittedByName: null,
      })
    }
    // Approved: the public record keeps its content.
    expect(by("s1").fields).toEqual({
      kind: "photo",
      photoId: 10,
      credit: "Alice",
    })
    expect(by("s1")).toMatchObject({
      note: null,
      evidenceType: null,
      evidenceUrl: null,
    })
    // Draft, pending, needs_info: emptied.
    for (const id of ["s2", "s3", "s4"]) {
      expect(by(id).fields).toBeNull()
      expect(by(id).draftData).toBeNull()
      expect(by(id).note).toBeNull()
    }
    expect(store["api::library-change.library-change"][0]).toMatchObject({
      actorId: null,
      actorName: null,
      reviewerId: null,
      next: {
        sourceRecords: [{ url: "https://public.example", role: "reference" }],
      },
    })
    expect(store["api::library-change.library-change"][1]).toMatchObject({
      actorId: null,
      actorName: null,
      reviewerId: null,
      next: "Retained public fact",
    })
    // Other people's rows are untouched.
    expect(by("s5")).toMatchObject({
      submittedByUserId: "u2",
      submittedByEmail: "b@x.org",
      fields: { kind: "record" },
    })
    // The pending and draft photos are gone; the approved one (now a
    // library image) and the avatar are the only other removals.
    const removedIds = remove.mock.calls
      .map(([f]: any[]) => f.id as number)
      .sort((a, b) => a - b)
    expect(removedIds).toEqual([9, 11, 77])
  })

  it("still scrubs linked records when the profile is missing", async () => {
    const { strapi, store } = seed()
    store[PROFILE] = []
    await eraseAccount(strapi, { baUserId: "u1" })

    expect(store[SAVED].map((e) => e.documentId)).toEqual(["e2"])
    expect(store[SUB][0].submittedByEmail).toBe("deleted@invalid")
    // No email given: the newsletter row can't be matched and stays.
    expect(store[SUBSCRIBER]).toHaveLength(2)
  })

  it("drops a feed still waiting on this person and forgets who connected an approved one", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(
      store[CRED].find((c) => c.documentId === "cred-pending")
    ).toBeUndefined()
    const active = store[CRED].find((c) => c.documentId === "cred-active")!
    expect(active.connectedBy).toBeNull()
    expect(active.pendingCredentialsEncrypted).toBeNull()
    expect(active.pendingHints).toBeNull()
    expect(active.pendingTestedAt).toBeNull()
    expect(active.pendingTestResult).toBeNull()
    expect(active.pendingSubmissionDocumentId).toBeNull()
    expect(store[CRED_EVENT][0]!.actor).toBe("ba:erased")
  })

  it("carries on when a file can't be removed", async () => {
    const { strapi, remove, store } = seed()
    remove.mockRejectedValueOnce(new Error("provider down"))
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[SAVED].map((e) => e.documentId)).toEqual(["e2"])
    expect(strapi.log.warn).toHaveBeenCalled()
  })
})
