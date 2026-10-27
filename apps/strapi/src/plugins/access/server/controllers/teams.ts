import { parseTeamInput } from "../services/teams"
import { AccessError, adminOf, fail, isDocumentId } from "../utils/admin"

/**
 * The Teams page (admin routes, `plugin::access.manage-teams`). The admin
 * is always `ctx.state.user`; nothing about who acts comes from the body.
 */

const CODE_MESSAGES: Record<string, string> = {
  not_found: "Team not found.",
  no_seats: "The team has no free seats.",
  already_member: "They are already on the team.",
  invite_already_pending: "An invite for that email is already pending.",
  invalid_email: "Enter a valid email address.",
  invalid_preassign: "The pre-assignment is not valid.",
  library_not_in_team: "That library is not one of the team's.",
  team_inactive: "The team is lapsed or expired.",
  member_not_active: "They haven't accepted their invite yet.",
  claim_pending: "A claim for that library is already waiting for a Moderator.",
  last_organiser: "A team needs at least one organiser.",
  invalid_role: "Choose owner or editor.",
  invalid_team_role: "Choose organiser or member.",
  invalid_library: "That library id is not valid.",
  email_failed: "The invitation email could not be sent.",
  email_not_configured:
    "APP_PUBLIC_URL is not set, so invite links can't be built.",
  not_invited: "That person has already accepted or was removed.",
}

export default ({ strapi }: { strapi: any }) => {
  const teams = () => strapi.plugin("access").service("teams")

  const run =
    (
      work: (ctx: any, admin: { id: string | number }) => Promise<unknown>,
      status = 200
    ) =>
    async (ctx: any) => {
      const admin = adminOf(ctx)
      if (!admin) return fail(ctx, 401, "Sign in to the admin first.")
      ctx.set?.("Cache-Control", "no-store")
      try {
        const body = await work(ctx, admin)
        ctx.status = status
        ctx.body = status === 204 ? null : { data: body ?? null }
      } catch (err) {
        if (!(err instanceof AccessError)) throw err
        fail(
          ctx,
          err.status,
          err.message !== err.code
            ? err.message
            : (CODE_MESSAGES[err.code] ?? err.code),
          { code: err.code }
        )
      }
    }

  const teamId = (ctx: any): string => {
    const id = ctx.params?.id
    if (!isDocumentId(id))
      throw new AccessError(400, "invalid_id", "Invalid team id")

    return id
  }
  const memberId = (ctx: any): string => {
    const id = ctx.params?.memberId
    if (!isDocumentId(id))
      throw new AccessError(400, "invalid_id", "Invalid member id")

    return id
  }

  return {
    // GET /teams?q=
    list: run((ctx) => {
      const q = ctx.query?.q
      if (q !== undefined && typeof q !== "string")
        throw new AccessError(400, "invalid_query", "q must be text")

      return teams().list(q ?? "")
    }),

    // GET /libraries?q=
    searchLibraries: run((ctx) => {
      const q = ctx.query?.q
      if (typeof q !== "string")
        throw new AccessError(400, "invalid_query", "q must be text")

      return teams().searchLibraries(q)
    }),

    // POST /teams
    create: run(async (ctx, admin) => {
      const parsed = parseTeamInput(ctx.request?.body)
      if (!parsed.ok)
        throw new AccessError(400, "invalid_input", parsed.message)
      const verified = ctx.request?.body?.verified === true

      return teams().create(
        { ...parsed.value, name: parsed.value.name!, verified },
        admin.id
      )
    }, 201),

    // GET /teams/:id
    findOne: run((ctx) =>
      teams().detail(teamId(ctx), { baUserId: null, admin: true })
    ),

    // PUT /teams/:id
    update: run((ctx, admin) => {
      const parsed = parseTeamInput(ctx.request?.body, true)
      if (!parsed.ok)
        throw new AccessError(400, "invalid_input", parsed.message)

      return teams().update(teamId(ctx), parsed.value, admin.id)
    }),

    // POST /teams/:id/verify  { verified: boolean }
    verify: run((ctx, admin) => {
      const verified = ctx.request?.body?.verified
      if (typeof verified !== "boolean")
        throw new AccessError(
          400,
          "invalid_input",
          "verified must be true or false"
        )

      return teams().verify(teamId(ctx), verified, admin.id)
    }),

    widgetBranding: run((ctx, admin) => {
      const enabled = ctx.request?.body?.enabled
      if (typeof enabled !== "boolean")
        throw new AccessError(400, "invalid_input")

      return teams().widgetBranding(teamId(ctx), enabled, admin.id)
    }),

    // POST /teams/:id/members  { email, teamRole?, preassign? }
    invite: run(async (ctx, admin) => {
      const b = ctx.request?.body ?? {}

      return teams().invite(teamId(ctx), b.email, b.teamRole, b.preassign, {
        kind: "admin",
        id: admin.id,
      })
    }, 201),

    // POST /teams/:id/members/:memberId/resend
    resend: run(async (ctx, admin) => {
      await teams().resendInvite(teamId(ctx), memberId(ctx), {
        kind: "admin",
        id: admin.id,
      })
    }, 204),

    // PUT /teams/:id/members/:memberId  { teamRole?, assignments? }
    member: run((ctx, admin) => {
      const b = ctx.request?.body ?? {}

      return teams().setMember(
        teamId(ctx),
        memberId(ctx),
        { teamRole: b.teamRole, assignments: b.assignments },
        { kind: "admin", id: admin.id }
      )
    }),

    // DELETE /teams/:id/members/:memberId
    remove: run(async (ctx, admin) => {
      await teams().remove(teamId(ctx), memberId(ctx), {
        kind: "admin",
        id: admin.id,
      })
    }, 204),

    // POST /teams/:id/assign  { memberId, libraryDocumentId, staffRole }
    assign: run((ctx, admin) => {
      const b = ctx.request?.body ?? {}
      if (!isDocumentId(b.memberId))
        throw new AccessError(400, "invalid_id", "Invalid member id")

      return teams().assign(
        teamId(ctx),
        b.memberId,
        b.libraryDocumentId,
        b.staffRole,
        {
          kind: "admin",
          id: admin.id,
        }
      )
    }),

    // POST /teams/:id/unassign  { memberId, libraryDocumentId }
    unassign: run(async (ctx, admin) => {
      const b = ctx.request?.body ?? {}
      if (!isDocumentId(b.memberId))
        throw new AccessError(400, "invalid_id", "Invalid member id")
      await teams().unassign(teamId(ctx), b.memberId, b.libraryDocumentId, {
        kind: "admin",
        id: admin.id,
      })
    }, 204),
  }
}
