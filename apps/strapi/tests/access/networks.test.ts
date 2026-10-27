import { describe, it, expect, vi } from "vitest"

import {
  approveNetworkClaim,
  submitNetworkClaim,
} from "../../src/plugins/access/server/services/network-claims"
import {
  fulfilNetworkMandate,
  reconcileNetworkMandate,
  approvedTeamMandate,
  removeServiceScopes,
} from "../../src/plugins/access/server/services/network-fulfilment"
import {
  AFFILIATION,
  MANDATE,
  SUBMISSION,
  type SubmissionRecord,
} from "../../src/plugins/access/server/services/network-records"
import createNetworks from "../../src/plugins/access/server/services/networks"
import createModeration from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { contributorReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import {
  issueAuthorityGrant,
  revokeAuthoritySource,
  effectiveManagedAuthority,
} from "../../src/utils/authority-grants"
import { eraseAccount } from "../../src/utils/erase-account"
import {
  networkFixture,
  LIBRARY,
  GRANT,
  STAFF,
  NET,
  L1,
  L2,
  L3,
  T1,
} from "../helpers/network-strapi"

const user = { id: "manager", email: "manager@example.org", name: "Manager" }
const input = {
  intent: "management",
  role: "Service manager",
  note: "I manage these branches for our institution.",
  department: "Libraries",
  libraryIds: [L1, L2],
  teamId: T1,
}
async function approved(
  f: ReturnType<typeof networkFixture>,
  ids?: string[],
  owner = false
) {
  const claim = await submitNetworkClaim(f.strapi, user, NET, {
      ...input,
      staffRole: owner ? "owner" : "editor",
    }),
    submission = await f.strapi
      .documents(SUBMISSION)
      .findOne({ documentId: claim.documentId })

  return approveNetworkClaim(
    f.strapi,
    submission as SubmissionRecord,
    "ba:moderator",
    ids,
    owner ? "owner" : "editor"
  )
}
describe("Library Network management", () => {
  it("freezes one case and grants only the reviewed subset, idempotently", async () => {
    const f = networkFixture(),
      id = await approved(f, [L1])
    expect(f.store[SUBMISSION]).toHaveLength(1)
    expect(f.store[STAFF] ?? []).toHaveLength(0)
    await fulfilNetworkMandate(f.strapi, id)
    await fulfilNetworkMandate(f.strapi, id)
    expect(f.store[STAFF]).toHaveLength(1)
    expect(f.store[GRANT]).toHaveLength(1)
    expect(f.store[MANDATE][0].approvedLibraryIds).toEqual([L1])
    expect(f.store[MANDATE][0].fulfilment.complete).toBe(true)
    expect(await approvedTeamMandate(f.strapi, T1, L2)).toBeNull()
  })
  it("shows source additions for a batch review without granting staff access", async () => {
    const f = networkFixture(),
      id = await approved(f)
    await fulfilNetworkMandate(f.strapi, id)
    f.store[LIBRARY].push(f.library(L3))
    const service = createNetworks({ strapi: f.strapi }),
      mine = await service.mine(user.id)
    expect(mine.mandates[0].additionsAwaitingReview).toEqual([L3])
    expect(await effectiveManagedAuthority(f.strapi, user.id, [L3])).toEqual(
      new Map()
    )
    expect(await approvedTeamMandate(f.strapi, T1, L3)).toBeNull()
  })
  it("refuses outsider IDs, consortium management and a non-organiser Team", async () => {
    const f = networkFixture()
    await expect(
      submitNetworkClaim(f.strapi, user, NET, { ...input, libraryIds: [L3] })
    ).rejects.toMatchObject({ code: "network_membership_changed" })
    await expect(
      submitNetworkClaim(f.strapi, { ...user, id: "outsider" }, NET, input)
    ).rejects.toMatchObject({ code: "organiser_required" })
    f.store["api::library-network.library-network"][0].kind = "consortium"
    await expect(
      submitNetworkClaim(f.strapi, user, NET, input)
    ).rejects.toMatchObject({ code: "consortium_has_no_branch_authority" })
    await expect(
      submitNetworkClaim(f.strapi, user, NET, {
        ...input,
        intent: "employment",
        libraryIds: [],
        teamId: null,
      })
    ).resolves.toMatchObject({ status: "pending" })
  })
  it("keeps an independent claim and Team grant when network authority is revoked", async () => {
    const f = networkFixture(),
      id = await approved(f)
    await fulfilNetworkMandate(f.strapi, id)
    await issueAuthorityGrant(f.strapi, {
      baUserId: user.id,
      libraryDocumentId: L1,
      sourceKind: "claim",
      sourceDocumentId: "individual-claim",
      staffRole: "owner",
      issuedBy: "test",
    })
    await issueAuthorityGrant(f.strapi, {
      baUserId: user.id,
      libraryDocumentId: L1,
      sourceKind: "team",
      sourceDocumentId: "independent-team-assignment",
      staffRole: "editor",
      issuedBy: "test",
    })
    await reconcileNetworkMandate(
      f.strapi,
      id,
      { version: 1, revoke: true, reason: "Service responsibility ended" },
      "ba:moderator"
    )
    expect(f.store[STAFF]).toHaveLength(1)
    expect(
      (await effectiveManagedAuthority(f.strapi, user.id, [L1])).get(L1)
        ?.staffRole
    ).toBe("owner")
    await revokeAuthoritySource(f.strapi, {
      baUserId: user.id,
      libraryDocumentId: L1,
      sourceKind: "claim",
    })
    expect(
      (await effectiveManagedAuthority(f.strapi, user.id, [L1])).get(L1)
        ?.staffRole
    ).toBe("editor")
  })
  it("removes derived Team authority and refuses stale reconciliation versions", async () => {
    const f = networkFixture(),
      id = await approved(f, undefined, true)
    await fulfilNetworkMandate(f.strapi, id)
    await issueAuthorityGrant(f.strapi, {
      baUserId: "colleague",
      libraryDocumentId: L1,
      sourceKind: "team",
      sourceDocumentId: "member",
      mandateDocumentId: id,
      staffRole: "editor",
      issuedBy: "test",
    })
    await expect(
      reconcileNetworkMandate(
        f.strapi,
        id,
        { version: 0, revoke: true, reason: "Ended" },
        "ba:moderator"
      )
    ).rejects.toMatchObject({ code: "version_conflict" })
    await reconcileNetworkMandate(
      f.strapi,
      id,
      { version: 1, libraryIds: [L1], reason: "Confirmed branch transfer" },
      "ba:moderator"
    )
    expect(
      await effectiveManagedAuthority(f.strapi, "colleague", [L1])
    ).toEqual(new Map())
    expect(f.store[MANDATE][0].approvedLibraryIds).toEqual([L2])
  })
  it("rejects a removed library at approval but accepts an explicitly reviewed subset", async () => {
    const f = networkFixture(),
      claim = await submitNetworkClaim(f.strapi, user, NET, input),
      submission = await f.strapi
        .documents(SUBMISSION)
        .findOne({ documentId: claim.documentId })
    f.store[LIBRARY][1].networks = []
    await expect(
      approveNetworkClaim(
        f.strapi,
        submission as SubmissionRecord,
        "ba:moderator"
      )
    ).rejects.toMatchObject({ code: "network_membership_changed" })
    await expect(
      approveNetworkClaim(
        f.strapi,
        submission as SubmissionRecord,
        "ba:moderator",
        [L1]
      )
    ).resolves.toBeTypeOf("string")
  })
  it("keeps private affiliations and evidence out of public projections", async () => {
    const f = networkFixture()
    await submitNetworkClaim(f.strapi, user, NET, input)
    const service = createNetworks({ strapi: f.strapi }),
      json = JSON.stringify(await service.detail(NET, {}))
    expect(json).not.toContain(user.id)
    expect(json).not.toContain(input.note)
    expect(await service.publicAffiliations("private-user")).toEqual({
      affiliations: [],
    })
    expect(f.store[AFFILIATION][0].status).toBe("pending")
  })
})

describe("Network review and recovery", () => {
  it("uses the existing self-review gate and awards a grouped case only once", async () => {
    const f = networkFixture(),
      claim = await submitNetworkClaim(f.strapi, user, NET, input),
      service = createModeration({ strapi: f.strapi })
    const award = vi.fn().mockResolvedValue({ awarded: true })
    f.services["rewards.points"] = { award }
    expect(
      await service.updateStatus(
        claim.documentId,
        "approved",
        contributorReviewer(user)
      )
    ).toEqual({ error: "self_review" })
    expect(f.store[MANDATE] ?? []).toHaveLength(0)
    expect(
      await service.updateStatus(
        claim.documentId,
        "approved",
        contributorReviewer({ id: "moderator", email: "mod@example.org" }),
        "Approve the reviewed service scope"
      )
    ).toMatchObject({ data: { status: "approved" } })
    expect(
      await service.updateStatus(
        claim.documentId,
        "approved",
        contributorReviewer({ id: "moderator" })
      )
    ).toEqual({ error: "invalid_transition" })
    expect(f.store[MANDATE]).toHaveLength(1)
    expect(award).toHaveBeenCalledTimes(1)
  })
  it("resubmits a needs-info case with a fresh frozen scope and keeps its identity", async () => {
    const f = networkFixture(),
      claim = await submitNetworkClaim(f.strapi, user, NET, input)
    f.store[SUBMISSION][0].status = "needs_info"
    f.store[LIBRARY].push(f.library(L3))
    f.services["content-moderation.submission"] = createModeration({
      strapi: f.strapi,
    })
    const result = await submitNetworkClaim(f.strapi, user, NET, {
      ...input,
      note: "Updated institutional evidence",
      libraryIds: [L1, L2, L3],
    })
    expect(result.documentId).toBe(claim.documentId)
    expect(f.store[SUBMISSION]).toHaveLength(1)
    expect(f.store[SUBMISSION][0].fields.sourceLibraryIds).toEqual([L1, L2, L3])
    expect(f.store[SUBMISSION][0].payloadHash).toBe(
      payloadHash(f.store[SUBMISSION][0])
    )
  })
  it("retains a failed grant for retry and commits each completed grant with its checkpoint", async () => {
    const f = networkFixture(),
      id = await approved(f),
      api = f.strapi.documents(GRANT)
    api.create.mockRejectedValueOnce(
      new Error("Database temporarily unavailable")
    )
    await fulfilNetworkMandate(f.strapi, id)
    expect(f.store[MANDATE][0].fulfilment.complete).toBe(false)
    expect(f.store[MANDATE][0].fulfilment.failures[L1].attempts).toBe(1)
    expect(f.store[GRANT] ?? []).toHaveLength(0)
    await fulfilNetworkMandate(f.strapi, id)
    expect(f.store[GRANT]).toHaveLength(2)
    expect(f.store[MANDATE][0].fulfilment.complete).toBe(true)
  })
  it("bounds each batch and denies revoked authority before every removal has finished", async () => {
    const f = networkFixture()
    for (let n = 3; n <= 30; n++)
      f.store[LIBRARY].push(f.library(`library${String(n).padStart(17, "0")}`))
    const ids = f.store[LIBRARY].map((row) => row.documentId),
      claim = await submitNetworkClaim(f.strapi, user, NET, {
        ...input,
        libraryIds: ids,
      }),
      submission = await f.strapi
        .documents(SUBMISSION)
        .findOne({ documentId: claim.documentId }),
      id = await approveNetworkClaim(
        f.strapi,
        submission as SubmissionRecord,
        "ba:moderator"
      )
    await fulfilNetworkMandate(f.strapi, id)
    expect(f.store[GRANT]).toHaveLength(25)
    expect(f.store[MANDATE][0].fulfilment.pending).toHaveLength(5)
    await fulfilNetworkMandate(f.strapi, id)
    expect(f.store[GRANT]).toHaveLength(30)
    await reconcileNetworkMandate(
      f.strapi,
      id,
      { version: 1, revoke: true, reason: "Service authority withdrawn" },
      "ba:moderator"
    )
    expect(f.store[MANDATE][0].fulfilment.revocations).toHaveLength(5)
    expect(await effectiveManagedAuthority(f.strapi, user.id, ids)).toEqual(
      new Map()
    )
  })
  it("requires explicit owner review before a service mandate can delegate Team access", async () => {
    const f = networkFixture(),
      id = await approved(f)
    await fulfilNetworkMandate(f.strapi, id)
    expect(await approvedTeamMandate(f.strapi, T1, L1)).toBeNull()
    const submission = f.store[SUBMISSION][0] as SubmissionRecord
    await expect(
      approveNetworkClaim(f.strapi, submission, "ba:moderator", [L1], "owner")
    ).rejects.toThrow("Owner responsibility was not requested")
    submission.fields.staffRole = "owner"
    await approveNetworkClaim(
      f.strapi,
      submission,
      "ba:moderator",
      [L1],
      "owner"
    )
    await fulfilNetworkMandate(f.strapi, id)
    expect(
      (await effectiveManagedAuthority(f.strapi, user.id, [L1, L2])).get(L1)
        ?.staffRole
    ).toBe("owner")
    expect(
      (await effectiveManagedAuthority(f.strapi, user.id, [L1, L2])).get(L2)
        ?.staffRole
    ).toBe("editor")
    expect(await approvedTeamMandate(f.strapi, T1, L1)).not.toBeNull()
    expect(await approvedTeamMandate(f.strapi, T1, L2)).toBeNull()
  })
  it("cancels an approved pending grant when staff access is removed individually", async () => {
    const f = networkFixture(),
      id = await approved(f)
    await removeServiceScopes(f.strapi, user.id, L1, "ba:moderator")
    await revokeAuthoritySource(f.strapi, {
      baUserId: user.id,
      libraryDocumentId: L1,
    })
    await fulfilNetworkMandate(f.strapi, id)
    expect(
      (await effectiveManagedAuthority(f.strapi, user.id, [L1, L2])).has(L1)
    ).toBe(false)
    expect(f.store[MANDATE][0].approvedLibraryIds).toEqual([L2])
  })
})

describe("Private network identity", () => {
  it("does not expose a service claim through the public activity feed", async () => {
    const f = networkFixture()
    await submitNetworkClaim(f.strapi, user, NET, input)
    f.store[SUBMISSION][0].status = "approved"
    expect(
      await createModeration({ strapi: f.strapi }).findPublicByBaUserId(user.id)
    ).toEqual([])
  })
  it("redacts network evidence and revokes derived authority when an account is erased", async () => {
    const f = networkFixture(),
      id = await approved(f, undefined, true)
    await fulfilNetworkMandate(f.strapi, id)
    await issueAuthorityGrant(f.strapi, {
      baUserId: "colleague",
      libraryDocumentId: L1,
      sourceKind: "team",
      sourceDocumentId: "member",
      mandateDocumentId: id,
      issuedBy: "test",
    })
    f.store[SUBMISSION][0].status = "approved"
    f.services["access.networks"] = createNetworks({ strapi: f.strapi })
    await eraseAccount(f.strapi, { baUserId: user.id, email: user.email })
    expect(f.store[AFFILIATION]).toHaveLength(0)
    expect(f.store[MANDATE][0].status).toBe("revoked")
    expect(f.store[MANDATE][0].baUserId).toMatch(/^deleted-/)
    expect(f.store[SUBMISSION][0].fields).toBeNull()
    expect(f.store[GRANT].some((row) => row.baUserId === user.id)).toBe(false)
    expect(
      await effectiveManagedAuthority(f.strapi, "colleague", [L1])
    ).toEqual(new Map())
  })
})

describe("Withdrawal and duplicate protection", () => {
  it("keeps active authority and open cases visible after a long review history", async () => {
    const f = networkFixture(),
      id = await approved(f)
    const mandate = f.store[MANDATE][0],
      request = f.store[SUBMISSION][0]
    f.store[MANDATE].unshift(
      ...Array.from({ length: 25 }, (_, index) => ({
        ...mandate,
        documentId: `old-mandate-${index}`,
        status: "revoked",
      }))
    )
    request.status = "needs_info"
    request.createdAt = "2025-01-01T00:00:00Z"
    f.store[SUBMISSION].push(
      ...Array.from({ length: 35 }, (_, index) => ({
        ...request,
        documentId: `closed-case-${index}`,
        status: "approved",
        createdAt: "2026-01-01T00:00:00Z",
      }))
    )
    const mine = await createNetworks({ strapi: f.strapi }).mine(user.id)
    expect(mine.mandates.some((row) => row.documentId === id)).toBe(true)
    expect(
      mine.requests.some((row) => row.documentId === request.documentId)
    ).toBe(true)
    expect(mine.requests).toHaveLength(31)
  })
  it("does not create a second case for an unchanged approved management scope", async () => {
    const f = networkFixture()
    await approved(f)
    await expect(
      submitNetworkClaim(f.strapi, user, NET, input)
    ).rejects.toMatchObject({ code: "scope_already_approved" })
    expect(f.store[SUBMISSION]).toHaveLength(1)
  })
  it("withdraws pending cases and refuses a late apply of their frozen scope", async () => {
    const f = networkFixture(),
      claim = await submitNetworkClaim(f.strapi, user, NET, input),
      snapshot = structuredClone(f.store[SUBMISSION][0])
    f.services["content-moderation.submission"] = createModeration({
      strapi: f.strapi,
    })
    await createNetworks({ strapi: f.strapi }).revokeAffiliation(
      user.id,
      f.store[AFFILIATION][0].documentId,
      { reason: "No longer employed here" }
    )
    expect(f.store[SUBMISSION][0].status).toBe("rejected")
    await expect(
      approveNetworkClaim(
        f.strapi,
        snapshot as SubmissionRecord,
        "ba:moderator"
      )
    ).rejects.toThrow("withdrawn")
    expect(claim.status).toBe("pending")
  })
  it("does not apply an automatic withdrawal built against a superseded request", async () => {
    const f = networkFixture(),
      claim = await submitNetworkClaim(f.strapi, user, NET, input)
    f.store[SUBMISSION][0].payloadHash = "new-revision"
    expect(
      await createModeration({ strapi: f.strapi }).updateStatus(
        claim.documentId,
        "rejected",
        { id: "system", kind: "system", email: null, baUserId: null },
        "Withdraw prior request",
        { expectedPayloadHash: "old-revision" }
      )
    ).toEqual({ error: "conflict" })
    expect(f.store[SUBMISSION][0].status).toBe("pending")
  })
})
