import { isDeepStrictEqual } from "node:util"

import { isPaidTeamMembership, type PaidTeamMembership } from "@repo/access"
import type { Core } from "@strapi/strapi"

import { loadNetwork, memberIds } from "./network-catalogue"
import { teamTransaction, requireNoOtherTeam } from "./teams"
import { notifySessionInvalidated } from "../../../../utils/role-grants"
import { TEAM_MEMBER_UID, TEAM_UID } from "../../../../utils/team-access"
import { AccessError, isDocumentId } from "../utils/admin"

const mode = () => (process.env.BILLING_ENV === "live" ? "live" : "sandbox")
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const identity = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200

type SignupInput = {
  accountId: string
  mode: string
  baUserId: string
  name: string
  email: string
  primaryNetworkId?: string
  libraryDocumentIds?: string[]
  publicServiceRequested?: boolean
}
type ContextInput = { teamId: string; mode: string; baUserId: string }
type SyncInput = {
  teamId: string
  accountId: string
  revision: number
  membership: unknown
}
type BillingTeam = {
  documentId: string
  name: string
  source: string
  billingMode: string
  billingArchived?: boolean
  billingSuspended?: boolean
  billingAccountId: string
  billingRevision?: number
  publicServiceApproved?: boolean
  billingMembership?: PaidTeamMembership | null
}

function hasPaidAccess(
  team: BillingTeam,
  membership: PaidTeamMembership,
  capacityBlocked: boolean
) {
  return (
    !membership.revoked &&
    !team.billingSuspended &&
    !capacityBlocked &&
    membership.paidSeats >= 5 &&
    ["active", "past_due", "canceled"].includes(membership.status) &&
    Boolean(
      membership.accessUntil && Date.parse(membership.accessUntil) > Date.now()
    )
  )
}
function projectionChanged(
  previous: PaidTeamMembership | null | undefined,
  membership: PaidTeamMembership
) {
  const fields = [
    "status",
    "cancelAtPeriodEnd",
    "revoked",
    "paidSeats",
    "pendingSeats",
  ] as const

  return previous && fields.some((key) => previous[key] !== membership[key])
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const teams = () => strapi.documents(TEAM_UID)
  const members = () => strapi.documents(TEAM_MEMBER_UID)
  const teamService = () => strapi.plugin("access").service("teams")
  async function teamOf(teamId: string) {
    if (!isDocumentId(teamId)) throw new AccessError(404, "team_not_found")
    const team = (await teams().findOne({
      documentId: teamId,
    })) as unknown as BillingTeam | null
    if (
      !team ||
      team.source !== "checkout" ||
      team.billingMode !== mode() ||
      team.billingArchived
    )
      throw new AccessError(404, "team_billing_not_found")

    return team
  }
  async function rows(teamId: string) {
    return members().findMany({
      filters: {
        team: { documentId: teamId },
        status: { $in: ["active", "invited"] },
      },
      limit: 551,
    })
  }

  async function notifyProjection(
    team: BillingTeam,
    current: Awaited<ReturnType<typeof rows>>,
    membership: PaidTeamMembership,
    notice: {
      accountId: string
      revision: number
      access: boolean
      capacityBlocked: boolean
    }
  ) {
    const previous = team.billingMembership
    if (team.billingRevision === notice.revision) return
    if (
      !(!previous?.paidThrough && membership.paidThrough) &&
      !projectionChanged(previous, membership)
    )
      return
    for (const organiser of current.filter(
      (row) =>
        row.status === "active" && row.teamRole === "organiser" && row.baUserId
    )) {
      await strapi.service("api::notification.notification").enqueue({
        baUserId: organiser.baUserId,
        kind: "billing_update",
        eventKey: `team-billing:${notice.accountId}:${notice.revision}:${organiser.baUserId}`,
        title:
          !previous?.paidThrough && notice.access
            ? "Your Team membership is ready"
            : "Your Team subscription has changed",
        body: notice.capacityBlocked
          ? "Your members and invitations exceed the paid seat allowance. Remove excess seats or increase the allowance, then refresh payment status."
          : "Open Team billing to check paid seats, renewal and payment status. Team verification and Library staff authority are assessed separately.",
        href: `/staff/teams/billing`,
      })
    }
  }

  return {
    async create(input: SignupInput) {
      if (
        !uuid(input?.accountId) ||
        input.mode !== mode() ||
        !identity(input.baUserId) ||
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 120 ||
        typeof input.email !== "string" ||
        input.email.length > 254 ||
        !input.email.includes("@") ||
        (input.publicServiceRequested !== undefined &&
          typeof input.publicServiceRequested !== "boolean")
      )
        throw new AccessError(400, "invalid_team_signup")

      if (
        input.primaryNetworkId !== undefined &&
        !isDocumentId(input.primaryNetworkId)
      )
        throw new AccessError(400, "invalid_network")

      return teamTransaction(
        strapi,
        `membership:${input.baUserId}`,
        async () => {
          const profile = await strapi.db
            .query("api::user-profile.user-profile")
            .findOne({ where: { baUserId: input.baUserId } })
          if (!profile || String(profile.username ?? "").startsWith("deleted-"))
            throw new AccessError(410, "team_profile_missing")
          const [existing] = await teams().findMany({
            filters: { billingAccountId: input.accountId },
            limit: 1,
          })
          if (existing) {
            if (existing.billingMode !== mode())
              throw new AccessError(409, "billing_environment_mismatch")
            await teamService().requireOrganiser(
              existing.documentId,
              input.baUserId
            )

            return { teamId: existing.documentId }
          }
          await requireNoOtherTeam(strapi, input.baUserId)
          const network = input.primaryNetworkId
            ? await loadNetwork(strapi, input.primaryNetworkId)
            : null
          const sourceIds = network
            ? await memberIds(strapi, network.documentId)
            : []
          const libraryIds = input.libraryDocumentIds ?? sourceIds
          if (
            !Array.isArray(libraryIds) ||
            libraryIds.length > 2000 ||
            libraryIds.some(
              (id) => !isDocumentId(id) || (network && !sourceIds.includes(id))
            )
          )
            throw new AccessError(400, "invalid_team_libraries")
          const created = await teamService().create(
            {
              name: input.name.trim(),
              seats: 5,
              libraryDocumentIds: libraryIds,
            },
            "self-service"
          )
          await teams().update({
            documentId: created.documentId,
            data: {
              primaryNetwork: network?.documentId ?? null,
              source: "checkout",
              status: "lapsed",
              expiresAt: new Date(0).toISOString(),
              billingAccountId: input.accountId,
              billingMode: mode(),
              billingRevision: 0,
              verifiedAt: null,
              publicServiceApproved: false,
              ...(input.publicServiceRequested
                ? {
                    notes:
                      "Public-library-service eligibility check requested during signup.",
                  }
                : {}),
            },
          })
          await members().create({
            data: {
              team: { connect: [{ documentId: created.documentId }] },
              baUserId: input.baUserId,
              email: input.email.trim().toLowerCase(),
              teamRole: "organiser",
              status: "active",
              acceptedAt: new Date().toISOString(),
              invitedBy: input.baUserId,
            },
          })

          return { teamId: created.documentId }
        }
      )
    },
    async context(input: ContextInput) {
      const team = await teamOf(input?.teamId)
      if (input.mode !== mode() || !identity(input.baUserId))
        throw new AccessError(400, "invalid_team_billing")
      await teamService().requireOrganiser(team.documentId, input.baUserId)

      return {
        teamId: team.documentId,
        accountId: team.billingAccountId,
        name: team.name,
        discounted: team.publicServiceApproved === true,
        used: (await rows(team.documentId)).length,
      }
    },
    async sync(input: SyncInput) {
      if (
        !uuid(input?.accountId) ||
        !Number.isSafeInteger(input.revision) ||
        input.revision < 1 ||
        !isPaidTeamMembership(input.membership) ||
        input.membership.mode !== mode()
      )
        throw new AccessError(400, "invalid_team_membership")

      const membership = input.membership

      return teamTransaction(strapi, input.teamId, async () => {
        const team = await teamOf(input.teamId)
        if (team.billingAccountId !== input.accountId)
          throw new AccessError(409, "team_billing_binding_invalid")
        const current = await rows(team.documentId)
        const userIds = current
          .filter((r) => r.status === "active" && r.baUserId)
          .map((r) => r.baUserId)
        if ((team.billingRevision ?? 0) > input.revision)
          return { userIds, capacityBlocked: false }
        if (
          team.billingRevision === input.revision &&
          !isDeepStrictEqual(team.billingMembership, membership)
        )
          throw new AccessError(409, "team_billing_revision_conflict")
        const m = membership
        const capacityBlocked = m.paidSeats > 0 && current.length > m.paidSeats
        const access = hasPaidAccess(team, m, capacityBlocked)
        await teams().update({
          documentId: team.documentId,
          data: {
            seats: Math.max(5, m.paidSeats),
            pendingSeats: m.pendingSeats,
            status: access ? "active" : "lapsed",
            expiresAt: m.accessUntil ?? new Date(0).toISOString(),
            billingRevision: input.revision,
            billingMembership: m,
          },
        })
        // One access notice per revision, independent of Stripe's financial emails.
        await notifyProjection(team, current, m, {
          accountId: input.accountId,
          revision: input.revision,
          access,
          capacityBlocked,
        })

        // The caller invalidates returned IDs after commit. Other instances use the existing 60-second TTL.
        // Verification, covered Libraries and member roles are never payment fields.
        return { userIds, capacityBlocked }
      })
    },
    async deletionCheck(input: { baUserId: string }) {
      if (!identity(input?.baUserId))
        throw new AccessError(400, "invalid_identity")
      const mine = await members().findMany({
        filters: {
          baUserId: input.baUserId,
          status: "active",
          teamRole: "organiser",
        },
        populate: { team: true },
        limit: 11,
      })
      for (const member of mine) {
        if (member.team?.source !== "checkout") continue
        const others = (await rows(member.team.documentId)).filter(
          (r) =>
            r.status === "active" &&
            r.teamRole === "organiser" &&
            r.baUserId !== input.baUserId
        )
        if (!others.length)
          throw new AccessError(409, "transfer_team_before_deletion")
      }

      return { ok: true }
    },
    async discard(input: ContextInput & { accountId: string }) {
      return teamTransaction(strapi, input?.teamId, async () => {
        const team = await teamOf(input.teamId)
        if (team.billingAccountId !== input.accountId)
          throw new AccessError(409, "team_billing_binding_invalid")
        await teamService().requireOrganiser(team.documentId, input.baUserId)
        const current = await rows(team.documentId)
        if (current.some((r) => r.baUserId && r.baUserId !== input.baUserId))
          throw new AccessError(409, "team_has_members")
        if (
          team.billingMembership?.accessUntil &&
          Date.parse(team.billingMembership.accessUntil) > Date.now()
        )
          throw new AccessError(409, "team_still_paid")
        for (const row of current)
          await members().update({
            documentId: row.documentId,
            data: {
              status: "removed",
              tokenHash: null,
              removedAt: new Date().toISOString(),
            },
          })
        await teams().update({
          documentId: team.documentId,
          data: {
            status: "lapsed",
            billingSuspended: true,
            billingArchived: true,
          },
        })
        await notifySessionInvalidated(strapi, input.baUserId)

        return { ok: true }
      })
    },
  }
}
