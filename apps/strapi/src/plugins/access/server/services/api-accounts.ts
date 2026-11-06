import { emailTemplate } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { loadNetwork, memberIds } from "./network-catalogue"
import { requireNoOtherTeam, teamTransaction } from "./teams"
import { TEAM_MEMBER_UID, TEAM_UID } from "../../../../utils/team-access"
import { AccessError, isDocumentId } from "../utils/admin"
import {
  API_NOTICE_DIMENSIONS,
  apiUsageNotice,
} from "../utils/api-usage-notice"

/**
 * Private bridge for the application's API accounts. An API account belongs
 * to an organisation (Team). Creating one is free; paid API coverage lives
 * in the application ledger. Payment never changes Team verification, roles
 * or covered Libraries.
 */
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const identity = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200

type OrganisationInput = {
  requestId: string
  baUserId: string
  email: string
  name: string
  primaryNetworkId?: string
  libraryDocumentIds?: string[]
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const teams = () => strapi.documents(TEAM_UID)
  const members = () => strapi.documents(TEAM_MEMBER_UID)
  const teamService = () => strapi.plugin("access").service("teams")
  const activeMembers = (teamId: string) =>
    members().findMany({
      filters: { team: { documentId: teamId }, status: "active" },
      fields: ["baUserId", "teamRole", "status"],
      limit: 551,
    })

  return {
    /**
     * Create a free organisation with the caller as its organiser.
     * Idempotent by `requestId` (stored as the Team's private
     * `billingAccountId`). One active organisation membership per account.
     */
    async createOrganisation(input: OrganisationInput) {
      if (
        !uuid(input?.requestId) ||
        !identity(input.baUserId) ||
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 120 ||
        typeof input.email !== "string" ||
        input.email.length > 254 ||
        !input.email.includes("@")
      )
        throw new AccessError(400, "invalid_organisation")
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
            throw new AccessError(410, "organisation_profile_missing")
          const [existing] = await teams().findMany({
            filters: { billingAccountId: input.requestId },
            limit: 1,
          })
          if (existing) {
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
            { name: input.name.trim(), libraryDocumentIds: libraryIds },
            "self-service"
          )
          await teams().update({
            documentId: created.documentId,
            data: {
              primaryNetwork: network?.documentId ?? null,
              billingAccountId: input.requestId,
              // Unverified: any library assignments remain claims for review.
              verifiedAt: null,
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

    /** Organisations where the account is an active organiser, for erasure checks. */
    async ownerCheck(input: { baUserId: string }) {
      if (!identity(input?.baUserId))
        throw new AccessError(400, "invalid_identity")
      const mine = await members().findMany({
        filters: {
          baUserId: input.baUserId,
          status: "active",
          teamRole: "organiser",
        },
        populate: { team: { fields: ["documentId"] } },
        limit: 11,
      })
      const result: {
        teamId: string
        otherOrganisers: number
        otherMembers: number
      }[] = []
      for (const member of mine) {
        const teamId = member.team?.documentId
        if (!teamId) continue
        const others = (await activeMembers(teamId)).filter(
          (r) => r.baUserId && r.baUserId !== input.baUserId
        )
        result.push({
          teamId,
          otherOrganisers: others.filter((r) => r.teamRole === "organiser")
            .length,
          otherMembers: others.filter((r) => r.teamRole !== "organiser").length,
        })
      }

      return { teams: result }
    },

    /**
     * One usage warning (50/80/100% of an allowance or the overage cap) for
     * each active organiser. The event key deduplicates retries.
     */
    async notice(
      teamId: string,
      input: { periodStart: string; dimension: string; threshold: number }
    ) {
      if (
        !isDocumentId(teamId) ||
        typeof input?.periodStart !== "string" ||
        !Number.isFinite(Date.parse(input.periodStart)) ||
        !API_NOTICE_DIMENSIONS[input.dimension] ||
        ![50, 80, 100].includes(input.threshold)
      )
        throw new AccessError(400, "invalid_api_notice")
      const team = await teams().findOne({
        documentId: teamId,
        fields: ["name"],
      })
      if (!team) throw new AccessError(404, "not_found")
      const { title, body } = apiUsageNotice(input.dimension, input.threshold)
      const base = process.env.APP_PUBLIC_URL ?? "https://libraries.global"
      let sent = 0
      for (const row of await activeMembers(teamId)) {
        if (row.teamRole !== "organiser" || !row.baUserId) continue
        await strapi.service("api::notification.notification").enqueue({
          baUserId: row.baUserId,
          kind: "billing_update",
          eventKey: `api-warning:${teamId}:${input.periodStart}:${input.dimension}:${input.threshold}:${row.baUserId}`,
          title,
          body,
          href: "/developers/usage",
          emailPreference:
            input.threshold === 100 ? "transactional" : undefined,
          emailPayload: emailTemplate({
            title,
            body,
            url: `${base}/developers/usage`,
            action: "View API usage",
            siteUrl: base,
          }),
        })
        sent++
      }

      return { sent }
    },
  }
}
