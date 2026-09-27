import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { eraseAccount } from "../src/utils/erase-account"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const UPLOAD = "plugin::content-moderation.submission-upload"
const AFF = "api::library-affiliation.library-affiliation"
const SAVED = "api::saved-event.saved-event"
const POINTS = "plugin::rewards.point-event"
const BADGES = "plugin::rewards.badge-award"
const SNAPSHOT = "plugin::rewards.leaderboard-snapshot"
const UP_USER = "plugin::users-permissions.user"

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
      },
      { documentId: "p2", id: 2, baUserId: "u2", username: "bob" },
    ],
    [SUB]: [
      {
        documentId: "s1",
        submittedByUserId: "u1",
        submittedByEmail: "alice@example.org",
        submittedByName: "Alice Smith",
      },
      {
        documentId: "s2",
        submittedByUserId: "u2",
        submittedByEmail: "b@x.org",
      },
    ],
    [UPLOAD]: [{ documentId: "up1", baUserId: "u1", fileId: 9 }],
    [AFF]: [{ documentId: "a1", baUserId: "u1" }],
    [SAVED]: [
      { documentId: "e1", baUserId: "u1", eventDocumentId: "ev1" },
      { documentId: "e2", baUserId: "u2", eventDocumentId: "ev1" },
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
  it("strips personal data, follows and preferences from the profile", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    const profile = store[PROFILE].find((p) => p.documentId === "p1")!
    expect(profile).toMatchObject({
      baUserId: "deleted-u1",
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
      publicPrefs: null,
      followedLibraries: { set: [] },
      followedProfiles: { set: [] },
      points: 0,
      streak: 0,
      lastActivityDate: null,
    })
  })

  it("deletes the avatar file", async () => {
    const { strapi, remove, avatar } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(remove).toHaveBeenCalledWith(avatar)
  })

  it("deletes saved events, claims, upload ownership and the users-permissions user", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[SAVED].map((e) => e.documentId)).toEqual(["e2"])
    expect(store[AFF]).toEqual([])
    expect(store[UPLOAD]).toEqual([])
    expect(store[UP_USER]).toEqual([])
  })

  it("anonymises submissions but keeps other people's untouched", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[SUB][0]).toMatchObject({
      submittedByUserId: "deleted-u1",
      submittedByEmail: "deleted@invalid",
      submittedByName: null,
    })
    expect(store[SUB][1]).toMatchObject({
      submittedByUserId: "u2",
      submittedByEmail: "b@x.org",
    })
  })

  it("unlinks points, badges and leaderboard snapshot entries", async () => {
    const { strapi, store } = seed()
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[POINTS][0].baUserId).toBe("deleted-u1")
    expect(store[BADGES][0].baUserId).toBe("deleted-u1")
    expect(store[SNAPSHOT][0].entries).toEqual([
      { baUserId: "deleted-u1", username: null, rank: 1, periodPoints: 20 },
      { baUserId: "u2", username: "bob", rank: 2, periodPoints: 10 },
    ])
  })

  it("still scrubs linked records when the profile is missing", async () => {
    const { strapi, store } = seed()
    store[PROFILE] = []
    await eraseAccount(strapi, { baUserId: "u1" })

    expect(store[SAVED].map((e) => e.documentId)).toEqual(["e2"])
    expect(store[SUB][0].submittedByEmail).toBe("deleted@invalid")
  })

  it("carries on when the avatar file can't be removed", async () => {
    const { strapi, remove, store } = seed()
    remove.mockRejectedValueOnce(new Error("provider down"))
    await eraseAccount(strapi, { baUserId: "u1", email: "alice@example.org" })

    expect(store[SAVED].map((e) => e.documentId)).toEqual(["e2"])
    expect(strapi.log.warn).toHaveBeenCalled()
  })
})
