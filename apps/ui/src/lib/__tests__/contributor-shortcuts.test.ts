import { describe, expect, it } from "vitest"

import {
  buildContributeMenu,
  type ContributorCard,
  selectedLibrary,
} from "../contributor-shortcuts"

const keys = (cards: ContributorCard[]) => cards.map((c) => c.key)
const links = (card: ContributorCard | undefined) =>
  card?.links.map((l) => [l.label, l.href]) ?? []

const SIGNED_IN = ["submit.correction", "submit.docSuggestion"]
const LIBRARIES = [
  { id: "bl", name: "British Library", slug: "british-library" },
  { id: "bod", name: "Bodleian", slug: "bodleian" },
]

describe("buildContributeMenu", () => {
  it("gives a signed-out visitor the Everyone cards, with sign-in before adding a library", () => {
    const menu = buildContributeMenu({ status: "signedOut" })
    expect(menu.work).toEqual([])
    expect(keys(menu.common)).toEqual(["drives", "hub"])
    expect(links(menu.common[0])).toEqual([["All drives", "/community"]])
    expect(links(menu.common[1])).toEqual([
      ["Add a library", "/auth/signin?callbackUrl=%2Fcontribute%2Findex%2Fnew"],
      ["All ways to contribute", "/contribute"],
    ])
    expect(menu.common[1]?.links[0]?.sub).toBe("Sign in first")
  })

  it("shows only the Everyone cards while roles load, whatever the capabilities say", () => {
    const menu = buildContributeMenu({
      status: "loading",
      capabilities: ["staff.area", "moderate.queue", ...SIGNED_IN],
      claimedLibraries: LIBRARIES,
      teams: [{ id: "t1", role: "organiser" }],
    })
    expect(menu.work).toEqual([])
    expect(links(menu.common[0])).toEqual([["All drives", "/community"]])
    expect(links(menu.common[1])).toEqual([
      ["Add a library", "/contribute/index/new"],
      ["All ways to contribute", "/contribute"],
    ])
  })

  it("gives a signed-in contributor Drives with Propose a drive, and the hub with My submissions", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: SIGNED_IN,
      counts: { inReview: 2 },
    })
    expect(menu.work).toEqual([])
    expect(links(menu.common[0])).toEqual([
      ["All drives", "/community"],
      ["Propose a drive", "/community/propose"],
    ])
    expect(links(menu.common[1])).toEqual([
      ["Add a library", "/contribute/index/new"],
      ["All ways to contribute", "/contribute"],
      ["My submissions", "/contribute/submissions"],
    ])
    expect(menu.common[1]?.links[2]?.sub).toBe("2 in review")
  })

  it("leaves My submissions without a line when nothing is in review or the count is unknown", () => {
    for (const inReview of [0, null, undefined]) {
      const menu = buildContributeMenu({
        status: "signedIn",
        capabilities: SIGNED_IN,
        counts: { inReview },
      })
      expect(menu.common[1]?.links[2]?.sub).toBeUndefined()
    }
  })

  it("offers the editorial board New drive instead of a proposal", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: [...SIGNED_IN, "drives.manage"],
    })
    expect(links(menu.common[0])).toEqual([
      ["All drives", "/community"],
      ["New drive", "/community/drives/new"],
    ])
    expect(menu.common[0]?.links[1]?.sub).toBe("Editorial board")
  })

  it("puts the featured drive on the Drives card with its progress", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: SIGNED_IN,
      featuredDrive: {
        title: "Opening hours for Alabama",
        slug: "alabama-hours",
        progress: { done: 74, total: 198, percent: 37, unit: "library" },
      },
    })
    expect(menu.common[0]?.featured).toEqual({
      title: "Opening hours for Alabama",
      href: "/community/drives/alabama-hours",
      percent: 37,
      progress: "74 of 198 libraries done",
    })
  })

  it("marks the featured drive as loading, and leaves it out when there is none", () => {
    expect(
      buildContributeMenu({ status: "signedOut", featuredDrive: "loading" })
        .common[0]?.featured
    ).toBe("loading")
    expect(
      buildContributeMenu({ status: "signedOut", featuredDrive: null })
        .common[0]?.featured
    ).toBeUndefined()
    const uncounted = buildContributeMenu({
      status: "signedOut",
      featuredDrive: { title: "New", slug: "new", progress: null },
    }).common[0]?.featured
    expect(uncounted).toEqual({
      title: "New",
      href: "/community/drives/new",
      percent: 0,
      progress: null,
    })
  })

  it("gives staff a Your libraries card that follows the selected library", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: ["staff.area", ...SIGNED_IN],
      claimedLibraries: LIBRARIES,
      selectedLibraryId: "bod",
      counts: { suggestions: 2 },
    })
    expect(keys(menu.work)).toEqual(["libraries"])
    const card = menu.work[0]
    expect(card?.title).toBe("Your libraries")
    expect(links(card)).toEqual([
      ["Staff area", "/staff"],
      ["Edit Bodleian", "/staff/bodleian/edit"],
      ["Event feeds", "/staff/bodleian/events"],
    ])
    expect(card?.links.map((l) => l.sub)).toEqual([
      "All 2 libraries",
      "Hours, contacts, services",
      "For Bodleian",
    ])
    expect(card?.links[1]?.badge).toBe(2)
    // Drives shows for staff too, and Add a library stays in the hub.
    expect(keys(menu.common)).toEqual(["drives", "hub"])
    expect(
      menu.common[1]?.links.some((l) => l.href === "/contribute/index/new")
    ).toBe(true)
  })

  it("uses the singular for one library and no badge without suggestions", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: ["staff.area"],
      claimedLibraries: [LIBRARIES[1]!],
      counts: { suggestions: 0 },
    })
    const card = menu.work[0]
    expect(card?.title).toBe("Your library")
    expect(card?.links[0]?.sub).toBeUndefined()
    expect(card?.links[1]?.badge).toBeUndefined()
  })

  it("offers only the staff area while library names are unresolved", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: ["staff.area"],
      claimedLibraries: [{ id: "x", name: null, slug: "no-name" }],
    })
    expect(links(menu.work[0])).toEqual([["Staff area", "/staff"]])
  })

  it("falls back to the first named library and encodes its slug", () => {
    expect(selectedLibrary(LIBRARIES, "missing")?.id).toBe("bl")
    expect(selectedLibrary(LIBRARIES, null)?.id).toBe("bl")
    expect(selectedLibrary([], "bl")).toBeNull()
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: ["staff.area"],
      claimedLibraries: [{ id: "d", name: "d/e", slug: "d/e" }],
    })
    expect(menu.work[0]?.links[1]?.href).toBe("/staff/d%2Fe/edit")
  })

  it("gives a Team organiser without a library the team card with a staff area line", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: SIGNED_IN,
      teams: [
        { id: "t1", role: "organiser" },
        { id: "t2", role: "member" },
      ],
    })
    expect(keys(menu.work)).toEqual(["team"])
    expect(links(menu.work[0])).toEqual([
      ["Manage your team", "/staff/team"],
      ["Staff area", "/staff"],
    ])
    expect(menu.work[0]?.links.map((l) => l.sub)).toEqual([
      "Organiser · 2 teams",
      "No library assigned yet",
    ])
  })

  it("gives a Team member with a library the plain team link only", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: ["staff.area"],
      claimedLibraries: [LIBRARIES[0]!],
      teams: [{ id: "t1", role: "member" }],
    })
    expect(keys(menu.work)).toEqual(["libraries", "team"])
    expect(links(menu.work[1])).toEqual([["Your team", "/staff/team"]])
    expect(menu.work[1]?.links[0]?.sub).toBe("Member")
  })

  it("gives editors their own Knowledge and Journal cards", () => {
    const knowledge = buildContributeMenu({
      status: "signedIn",
      capabilities: ["docs.directEdit"],
    })
    expect(keys(knowledge.work)).toEqual(["knowledge"])
    expect(links(knowledge.work[0])).toEqual([
      ["Write an article", "/contribute/knowledge/new?type=knowledge"],
      ["Edit articles", "/contribute/knowledge"],
    ])
    const journal = buildContributeMenu({
      status: "signedIn",
      capabilities: ["journal.directEdit"],
    })
    expect(keys(journal.work)).toEqual(["journal"])
    expect(links(journal.work[0])).toEqual([
      ["Write an article", "/contribute/knowledge/new?type=journal"],
      ["Edit articles", "/contribute/knowledge?type=journal"],
    ])
  })

  it("gives Moderators a Review card with the queue and what is waiting", () => {
    const waiting = buildContributeMenu({
      status: "signedIn",
      capabilities: ["moderate.queue"],
      counts: { moderation: 14 },
    })
    expect(keys(waiting.work)).toEqual(["review"])
    expect(links(waiting.work[0])).toEqual([
      ["Moderation queue", "/contribute/moderation"],
    ])
    expect(waiting.work[0]?.links[0]?.badge).toBe(14)
    expect(waiting.work[0]?.links[0]?.sub).toBeUndefined()

    const empty = buildContributeMenu({
      status: "signedIn",
      capabilities: ["moderate.queue"],
      counts: { moderation: 0 },
    })
    expect(empty.work[0]?.links[0]?.sub).toBe("Nothing waiting")
    expect(empty.work[0]?.links[0]?.badge).toBeUndefined()

    const unknown = buildContributeMenu({
      status: "signedIn",
      capabilities: ["moderate.queue"],
    })
    expect(unknown.work[0]?.links[0]?.sub).toBeUndefined()
    expect(unknown.work[0]?.links[0]?.badge).toBeUndefined()
  })

  it("combines the cards for someone with several roles, their own work first", () => {
    const menu = buildContributeMenu({
      status: "signedIn",
      capabilities: [
        "staff.area",
        "docs.directEdit",
        "journal.directEdit",
        "moderate.queue",
        "drives.manage",
        ...SIGNED_IN,
      ],
      claimedLibraries: LIBRARIES,
      teams: [{ id: "t1", role: "member" }],
    })
    expect(keys(menu.work)).toEqual([
      "libraries",
      "team",
      "knowledge",
      "journal",
      "review",
    ])
    expect(keys(menu.common)).toEqual(["drives", "hub"])
    expect(
      menu.work.flatMap((c) => c.links).some((l) => l.label === "Staff drawer")
    ).toBe(false)
  })
})
