import { describe, expect, it } from "vitest"

import {
  canModerate,
  canStaff,
  fromSessionCapabilities,
  resolveCapabilities,
  resolveEntitlements,
  toSessionCapabilities,
  type StaffAction,
  type StaffRole,
} from "../src"

const member = (staffRole: StaffRole, canGoLive = true) =>
  resolveCapabilities({
    signedIn: true,
    grants: [],
    claims: [{ libraryDocumentId: "library1", staffRole, canGoLive }],
  })

describe("staff access", () => {
  it.each([
    "edit",
    "reviewSuggestions",
    "notices",
    "seeTeam",
    "goLive",
  ] as StaffAction[])(
    "allows both levels to %s only at their library",
    (action) => {
      for (const role of ["owner", "editor"] as const) {
        expect(canStaff(member(role), action, "library1")).toBe(true)
        expect(canStaff(member(role), action, "library2")).toBe(false)
      }
    }
  )
  it.each(["manageTeam", "manageLive"] as StaffAction[])(
    "requires an owner for %s",
    (action) => {
      expect(canStaff(member("editor"), action, "library1")).toBe(false)
      expect(canStaff(member("owner"), action, "library1")).toBe(true)
    }
  )
  it("enforces a live restriction and refuses anonymous claims", () => {
    expect(canStaff(member("owner", false), "goLive", "library1")).toBe(false)
    const anonymous = resolveCapabilities({
      signedIn: false,
      grants: [],
      claims: [
        { libraryDocumentId: "library1", staffRole: "owner", canGoLive: true },
      ],
    })
    expect(anonymous.staff.size).toBe(0)
    expect(anonymous.claimedLibraryIds.size).toBe(0)
  })
  it("allows corrections but never claims, staff requests, other libraries or self-review", () => {
    const c = member("editor")
    const submission = {
      submissionType: "correction" as const,
      locale: "en",
      submittedByUserId: "other",
      targetLibraryDocumentId: "library1",
    }
    expect(canModerate(c, submission, "staff")).toBe(true)
    expect(canModerate(c, submission, "other")).toBe(false)
    expect(
      canModerate(
        c,
        { ...submission, targetLibraryDocumentId: "library2" },
        "staff"
      )
    ).toBe(false)
    for (const submissionType of [
      "library_claim",
      "library_edit",
      "new_library",
    ] as const)
      expect(canModerate(c, { ...submission, submissionType }, "staff")).toBe(
        false
      )
  })
  it("round-trips roles and restrictions without trusting malformed session data", () => {
    const c = member("owner", false)
    expect(
      canStaff(
        fromSessionCapabilities(toSessionCapabilities(c)),
        "manageTeam",
        "library1"
      )
    ).toBe(true)
    expect(
      canStaff(
        fromSessionCapabilities(toSessionCapabilities(c)),
        "goLive",
        "library1"
      )
    ).toBe(false)
    expect(
      fromSessionCapabilities({
        capabilities: ["staff.area"],
        staffLibraries: [
          { id: "library1", role: "admin", canGoLive: true } as never,
        ],
      }).staff.size
    ).toBe(0)
    expect(
      fromSessionCapabilities({ claimedLibraryIds: ["library1"] }).staff.size
    ).toBe(0)
  })
  it("keeps traffic and team management Team-only", () => {
    for (const plan of ["pro", "team"] as const) {
      const e = resolveEntitlements({
        signedIn: true,
        now: new Date(),
        grants: [{ plan, expiresAt: null }],
      })
      expect(e.features.has("library.team")).toBe(plan === "team")
      expect(e.features.has("library.traffic")).toBe(plan === "team")
    }
  })
})
