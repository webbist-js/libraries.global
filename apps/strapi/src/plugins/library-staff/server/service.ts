import {
  libraryTypeName,
  emailTemplate,
  findUnsafeContent,
  normalizeMobileTimetable,
  sectionCheckedAt,
  facilityChecklistFor,
  noticeIsActive,
  noticeIsUpcoming,
  noticeLocalDate,
} from "@repo/shared-data"

import { emailConfigured } from "../../../plugins/content-moderation/server/utils/email-config"
import {
  changeEffectiveAuthority,
  revokeAuthoritySource,
} from "../../../utils/authority-grants"
import { noticesForLibrary } from "../../../utils/library-notices"
import { listStaff, requireStaffMember } from "../../../utils/staff"
import {
  afterStaffCommit,
  notifyStaffChange,
} from "../../../utils/staff-notifications"
import { hasLibraryFeature } from "../../../utils/team-access"
import { removeServiceScopes } from "../../access/server/services/network-fulfilment"

export const AUDIT = "plugin::library-staff.staff-audit"
const LIBRARY = "api::library.library"
const PROFILE = "api::user-profile.user-profile"

export class StaffError extends Error {
  constructor(
    public status: number,
    public code: string
  ) {
    super(code)
  }
}

/** Serialise membership changes so two owners cannot remove each other. */
export async function staffTransaction<T>(
  strapi: any,
  id: string,
  work: () => Promise<T>
): Promise<T> {
  return strapi.db.transaction(async ({ trx }: any) => {
    if (typeof trx?.raw === "function")
      await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
        `staff-library:${id}`,
      ])

    return work()
  })
}

/**
 * The facility checklist's health row: how many of its questions the record
 * answers, a "Yes" being a linked option and a "No" an `absentFacilities`
 * entry (the label, as `utils/facility-answers` stores it).
 */
export function facilityHealth(
  lib: Record<string, any>,
  mobile: boolean,
  edit: string
) {
  const checks = facilityChecklistFor(libraryTypeName(lib.libraryType))
  const present = new Set<string>(
    ["accessibility", "services", "amenities"]
      .flatMap((key) => (Array.isArray(lib[key]) ? lib[key] : []))
      .map((row: any) => row?.name)
  )
  const absent = new Set<string>(
    Array.isArray(lib.absentFacilities) ? lib.absentFacilities : []
  )
  const answered = checks.filter(
    (check) => present.has(check.name) || absent.has(check.label)
  ).length
  const total = checks.length

  return {
    key: "accessibility",
    label: mobile ? "Vehicle details" : "Accessibility",
    note: `${answered} of ${total} answered`,
    status: answered >= total ? "ok" : "todo",
    answered,
    total,
    action: {
      label: answered >= total ? "Still right" : "Finish",
      href: `${edit}?step=access`,
    },
  }
}

export default ({ strapi }: { strapi: any }) => ({
  async authorise(
    user: string,
    id: string,
    action: any = "seeTeam",
    team = false
  ) {
    const member = await requireStaffMember(strapi, user, id, action)
    if (!member) {
      const exists = (await listStaff(strapi, id)).some(
        (row) => row.baUserId === user
      )
      throw new StaffError(
        exists ? 403 : 404,
        exists ? "forbidden" : "not_found"
      )
    }
    // Team features belong to the library: on only when an active Team of
    // the caller's covers it (never a personal plan alone).
    if (team && !(await hasLibraryFeature(strapi, user, "library.team", id)))
      throw new StaffError(402, "upgrade_required")

    return member
  },
  async name(user: string) {
    const [row] = await strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $eq: user } },
      fields: ["firstName", "lastName", "username"],
      limit: 1,
    })

    return (
      [row?.firstName, row?.lastName].filter(Boolean).join(" ") ||
      row?.username ||
      "Library staff"
    )
  },
  async audit(
    id: string,
    actor: string,
    action: string,
    subject: string | null = null,
    detail: Record<string, unknown> = {}
  ) {
    await strapi.documents(AUDIT).create({
      data: {
        library: { connect: [{ documentId: id }] },
        actor,
        action,
        subject,
        detail,
        at: new Date().toISOString(),
      },
    })
  },
  async mail(to: string | string[], subject: string, text: string) {
    if (!emailConfigured())
      throw new StaffError(503, "email_provider_not_configured")
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        ...emailTemplate({
          postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
          siteUrl: process.env.APP_PUBLIC_URL,
          title: subject,
          body: text,
        }),
      })
  },
  async joined(user: string, id: string) {
    await this.audit(id, user, "joined", user)
    await notifyStaffChange(strapi, user, id, "joined")
  },
  /**
   * The library's staff list. Covered (the caller's Team includes this
   * library): levels, verified dates, the Team's pending invites
   * pre-assigned here, the audit and who may change access. Uncovered: the
   * names only, plus whether the caller may leave.
   */
  async team(user: string, id: string) {
    await this.authorise(user, id)
    const [full, team] = await Promise.all([
      hasLibraryFeature(strapi, user, "library.team", id),
      strapi.plugin("access")?.service("teams")?.forLibrary(id, user) ?? null,
    ])
    const members = await listStaff(strapi, id)
    const actor = members.find((row) => row.baUserId === user)!
    const names = await Promise.all(
      members.map(async (row) => {
        const name = await this.name(row.baUserId)

        return {
          affiliationDocumentId: row.affiliationDocumentId,
          name,
          initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((word: string) => word[0])
            .join(""),
          ...(full
            ? {
                staffRole: row.staffRole,
                canGoLive: row.canGoLive,
                approvedAt: row.approvedAt,
              }
            : {}),
          isYou: row.baUserId === user,
        }
      })
    )
    const audit =
      full && actor.staffRole === "owner"
        ? await strapi.documents(AUDIT).findMany({
            filters: { library: { documentId: { $eq: id } } },
            sort: "at:desc",
            limit: 20,
          })
        : []

    // The Team covering this library when the viewer isn't in it: the tab
    // then names the organiser to ask, instead of offering a plan.
    const coveringTeam =
      team && !team.viewerIsMember
        ? {
            id: team.documentId,
            name: team.name,
            organiserName: team.organiserName ?? null,
            organiserEmailMasked: team.organiserEmailMasked ?? null,
            viewerIsMember: false as const,
          }
        : null

    return {
      members: names,
      invites: full && team ? team.invites : [],
      coveringTeam,
      audit: await Promise.all(
        audit.map(async (row: any) => ({
          at: row.at,
          action: row.action,
          actorName: row.actor
            ? row.actor.startsWith("admin:")
              ? "Site admin"
              : await this.name(row.actor)
            : "Former staff",
          subjectName: row.subject ? await this.name(row.subject) : null,
        }))
      ),
      // A personal claim is voluntary, even when no other staff have joined.
      canLeave: true,
      covered: full,
      team:
        team && team.viewerIsMember
          ? {
              documentId: team.documentId,
              name: team.name,
              verified: team.verified,
              viewerIsOrganiser: team.viewerIsOrganiser,
              organiserNames: team.organiserNames,
            }
          : null,
    }
  },
  async overview(user: string, id: string) {
    const actor = await this.authorise(user, id)
    const lib = await strapi.documents(LIBRARY).findOne({
      documentId: id,
      status: "published",
      populate: {
        libraryType: { fields: ["name"] },
        heroImage: true,
        accessibility: true,
        amenities: true,
        services: true,
        area: true,
        region: true,
        country: true,
        continent: true,
      },
    })
    if (!lib) throw new StaffError(404, "not_found")
    const edit = `/staff/${lib.slug}/edit`
    const mobile = libraryTypeName(lib.libraryType) === "Mobile"
    const checked = sectionCheckedAt(lib, "hours")
    const timetable = mobile
      ? normalizeMobileTimetable(lib.mobileTimetable)
      : null
    const health = [
      mobile
        ? {
            // A Mobile library's hours are its timetable: done once stops
            // exist; "Confirm times" when nobody has checked it recently.
            key: "hours",
            label: "Timetable",
            note: !timetable?.stops.length
              ? "No stops yet"
              : checked
                ? `${timetable.stops.length} stops · checked ${checked.slice(0, 10)}`
                : `${timetable.stops.length} stops · not confirmed yet`,
            status: timetable?.stops.length ? "ok" : "todo",
            action: {
              label: !timetable?.stops.length
                ? "Add stops"
                : checked
                  ? "Still right"
                  : "Confirm times",
              href: `${edit}?step=timetable`,
            },
          }
        : {
            key: "hours",
            label: "Opening hours",
            note: checked
              ? `Checked ${checked.slice(0, 10)}`
              : "Not checked yet",
            status: checked ? "ok" : "todo",
            action: {
              label: checked ? "Still right" : "Add times",
              href: `${edit}?step=3`,
            },
          },
      {
        key: "photo",
        label: "Photo",
        note: lib.heroImage ? "Added" : "Not added",
        status: lib.heroImage ? "ok" : "todo",
        action: { label: "Add photo", href: `${edit}?step=6` },
      },
      facilityHealth(lib, mobile, edit),
      {
        key: "catalogue",
        label: "Catalogue link",
        note: lib.catalogueUrl ? "Added" : "Not added",
        status: lib.catalogueUrl ? "ok" : "todo",
        // catalogueUrl lives on the wizard's step 3 (links), not step 1.
        action: { label: "Add link", href: `${edit}?step=links` },
      },
      ...(!mobile
        ? [
            {
              key: "feed",
              label: "Events feed",
              note: lib.hasActiveFeed ? "Connected" : "Not connected",
              status: lib.hasActiveFeed ? "ok" : "todo",
              action: {
                label: lib.hasActiveFeed ? "Manage" : "Connect",
                href: lib.hasActiveFeed
                  ? `/staff/${lib.slug}/events`
                  : `/staff/${lib.slug}/events/connect`,
              },
            },
          ]
        : []),
    ]
    const now = new Date()
    const [suggestions, notices] = await Promise.all([
      strapi.documents("plugin::content-moderation.submission").count({
        filters: {
          targetDocumentId: { $eq: id },
          submissionType: { $eq: "correction" },
          status: { $eq: "pending" },
          submittedByUserId: { $ne: user },
        },
      }),
      noticesForLibrary(strapi, id, now),
    ])
    const today = noticeLocalDate(now, lib.timezone)
    const path = [
      lib.continent?.slug,
      lib.country?.slug,
      lib.region?.slug,
      lib.slug,
    ]
      .filter(Boolean)
      .join("/")

    return {
      library: {
        documentId: id,
        name: lib.name,
        slug: lib.slug,
        libraryType: libraryTypeName(lib.libraryType),
        path: `/${path}`,
        completeness:
          typeof lib.completeness === "number" ? lib.completeness : null,
      },
      role: actor.staffRole,
      health,
      counts: {
        suggestions,
        noticesUpcoming: notices.filter((notice) =>
          noticeIsUpcoming(notice, today)
        ).length,
        noticesActive: notices.filter((notice) => noticeIsActive(notice, today))
          .length,
      },
    }
  },
  async changeMember(
    user: string,
    id: string,
    memberId: string,
    body: any,
    remove = false,
    leave = false
  ) {
    return staffTransaction(strapi, id, async () => {
      const actor = await this.authorise(
        user,
        id,
        leave ? "seeTeam" : "manageTeam",
        !leave
      )
      const members = await listStaff(strapi, id)
      const member = members.find(
        (row) =>
          row.affiliationDocumentId ===
          (leave ? actor.affiliationDocumentId : memberId)
      )
      if (!member) throw new StaffError(404, "not_found")
      if (
        !leave &&
        member.staffRole === "owner" &&
        members.filter((row) => row.staffRole === "owner").length === 1 &&
        (remove || body.staffRole === "editor")
      )
        throw new StaffError(409, "last_owner")
      if (remove || leave) {
        await removeServiceScopes(strapi, member.baUserId, id, `ba:${user}`)
        await revokeAuthoritySource(strapi, {
          baUserId: member.baUserId,
          libraryDocumentId: id,
        })
        await this.audit(id, user, leave ? "left" : "removed", member.baUserId)
      } else {
        const data: Record<string, unknown> = {}
        if (body.staffRole !== undefined) {
          if (!["owner", "editor"].includes(body.staffRole))
            throw new StaffError(400, "invalid_role")
          data.staffRole = body.staffRole
        }
        if (body.canGoLive !== undefined) {
          if (typeof body.canGoLive !== "boolean")
            throw new StaffError(400, "invalid_live_permission")
          data.canGoLive = body.canGoLive
        }
        if (Object.keys(data).length === 0)
          throw new StaffError(400, "empty_change")
        const permissionsChanged = Object.keys(data).some(
          (key) => data[key] !== (member as any)[key]
        )
        await changeEffectiveAuthority(strapi, {
          baUserId: member.baUserId,
          libraryDocumentId: id,
          ...data,
        })
        for (const key of Object.keys(data))
          await this.audit(
            id,
            user,
            key === "staffRole" ? "level_changed" : "can_go_live_changed",
            member.baUserId,
            { previous: (member as any)[key], next: data[key] }
          )
        if (permissionsChanged)
          await afterStaffCommit(
            strapi,
            `staff permissions for ${member.baUserId}`,
            async () => {
              const library = await strapi.documents(LIBRARY).findOne({
                documentId: id,
                status: "published",
                fields: ["name", "slug"],
              })
              await strapi.service("api::notification.notification").enqueue({
                baUserId: member.baUserId,
                kind: "staff_update",
                eventKey: `staff-permissions:${id}:${member.baUserId}:${JSON.stringify(data)}:${Date.now()}`,
                title: `Your staff permissions for ${library?.name ?? "a library"} changed`,
                body: "An owner changed your staff level or permission to go live. Check the Team tab for your current access.",
                href: library?.slug ? `/staff/${library.slug}/team` : "/staff",
                emailPreference: "transactional",
              })
            }
          )
      }
      // Membership effects (hasStaff, live sessions, search, the removal
      // email) run from the affiliation lifecycle.
      if (remove || leave) return { member: null }

      return {
        member:
          (await this.team(user, id)).members.find(
            (row: any) =>
              row.affiliationDocumentId === member.affiliationDocumentId
          ) ?? null,
      }
    })
  },
  async report(user: string, id: string, message: unknown) {
    await this.authorise(user, id)
    if (
      typeof message !== "string" ||
      message.trim().length < 10 ||
      message.length > 1000 ||
      findUnsafeContent(message)
    )
      throw new StaffError(400, "invalid_message")
    if (!process.env.MODERATORS_EMAIL)
      throw new StaffError(503, "moderators_email_not_configured")
    const lib = await strapi.documents(LIBRARY).findOne({
      documentId: id,
      status: "published",
      fields: ["name"],
    })
    const base = process.env.APP_PUBLIC_URL ?? "https://libraries.global"
    const review = new URL(`/moderation/staff/${id}`, base)
    await this.mail(
      process.env.MODERATORS_EMAIL,
      `Staff access report: ${lib?.name ?? id}`,
      `Library: ${lib?.name ?? "Unknown library"} (${id})\nReported by: ${await this.name(user)}\n\n${message.trim()}\n\nReview who has staff access and remove anyone who shouldn't:\n${review}`
    )
    await this.audit(id, user, "access_reported")
  },
  async prune() {
    const now = new Date()
    await strapi.db.query(AUDIT).deleteMany({
      where: {
        at: { $lt: new Date(now.getTime() - 730 * 86_400_000).toISOString() },
      },
    })
  },
})
