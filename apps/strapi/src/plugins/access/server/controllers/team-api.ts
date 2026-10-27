import { decodeHeaderName } from "../../../../utils/header-name"
import { isValidServiceSecret } from "../../../../utils/service-secret"
import { AccessError, isDocumentId } from "../utils/admin"

/**
 * The site's Team routes (content API, `auth: false`): the bridge secret
 * plus `X-Ba-User-Id` identify the caller, and the teams service re-reads
 * their membership on every call (organiser for writes). Errors carry a
 * stable `code` the Next proxy passes through to the page.
 */

type User = { id: string; email: string; name: string }

export default ({ strapi }: { strapi: any }) => {
  const teams = () => strapi.plugin("access").service("teams")

  const wrap =
    (work: (ctx: any, user: User) => Promise<unknown>, status = 200) =>
    async (ctx: any) => {
      if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
        return ctx.unauthorized("Invalid service secret")
      const id = ctx.request.header["x-ba-user-id"]
      const email = ctx.request.header["x-ba-user-email"]
      if (typeof id !== "string" || !id || typeof email !== "string")
        return ctx.unauthorized("Missing identity")
      ctx.set("Cache-Control", "no-store")
      try {
        const body = await work(ctx, {
          id,
          email,
          name: decodeHeaderName(ctx.request.header["x-ba-user-name"]) ?? "",
        })
        ctx.status = status
        ctx.body = status === 204 ? null : (body ?? { ok: true })
      } catch (err) {
        if (!(err instanceof AccessError)) throw err
        ctx.status = err.status
        ctx.body = { error: { code: err.code } }
      }
    }

  const teamId = (ctx: any): string => {
    const id = ctx.params?.id
    if (!isDocumentId(id)) throw new AccessError(404, "not_found")

    return id
  }
  const memberId = (ctx: any): string => {
    const id = ctx.params?.memberId
    if (!isDocumentId(id)) throw new AccessError(404, "not_found")

    return id
  }
  const actor = (u: User) =>
    ({ kind: "user", baUserId: u.id, email: u.email, name: u.name }) as const

  return {
    // GET /teams/mine
    mine: wrap(async (_ctx, user) => ({
      teams: await teams().listMine(user.id),
    })),

    // GET /teams/:id  (organiser: everything; member: read-only view)
    detail: wrap((ctx, user) =>
      teams().detail(teamId(ctx), { baUserId: user.id })
    ),
    configure: wrap((ctx, user) => {
      if (ctx.request.header["x-ba-email-verified"] !== "true")
        throw new AccessError(403, "email_verification_required")
      const body = ctx.request.body ?? {}

      return teams().configure(
        teamId(ctx),
        {
          name: body.name,
          libraryDocumentIds: body.libraryDocumentIds,
          primaryNetworkId: body.primaryNetworkId,
        },
        actor(user)
      )
    }),
    libraries: wrap(async (ctx) => ({
      libraries: await teams().searchLibraries(
        typeof ctx.query.q === "string" ? ctx.query.q : ""
      ),
    })),

    // POST /teams/:id/invites  { email, teamRole?, preassign? }
    // → 201 { member, emailSent }: the seat is held even when no email
    // provider is configured (the page then says so).
    invite: wrap(
      (ctx, user) =>
        teams().invite(
          teamId(ctx),
          (ctx.request.body ?? {}).email,
          (ctx.request.body ?? {}).teamRole,
          (ctx.request.body ?? {}).preassign,
          actor(user),
          ctx.request.header.origin ?? null
        ),
      201
    ),

    // POST /teams/:id/invites/:memberId/resend
    resendInvite: wrap(async (ctx, user) => {
      await teams().resendInvite(
        teamId(ctx),
        memberId(ctx),
        actor(user),
        ctx.request.header.origin ?? null
      )
    }, 204),

    // DELETE /teams/:id/invites/:memberId
    revokeInvite: wrap(async (ctx, user) => {
      await teams().revokeInvite(teamId(ctx), memberId(ctx), actor(user))
    }, 204),

    // GET /teams/join/:token
    preview: wrap((ctx, user) => teams().preview(ctx.params.token, user.email)),

    // POST /teams/join/:token/accept
    accept: wrap(async (ctx, user) => {
      if (ctx.request.header["x-ba-email-verified"] !== "true")
        throw new AccessError(403, "email_verification_required")

      return { team: await teams().accept(ctx.params.token, user) }
    }),

    // PUT /teams/:id/members/:memberId  { teamRole?, assignments? }
    member: wrap(async (ctx, user) => {
      const b = ctx.request.body ?? {}

      return {
        member: await teams().setMember(
          teamId(ctx),
          memberId(ctx),
          { teamRole: b.teamRole, assignments: b.assignments },
          actor(user)
        ),
      }
    }),

    // DELETE /teams/:id/members/:memberId
    remove: wrap(async (ctx, user) => {
      await teams().remove(teamId(ctx), memberId(ctx), actor(user))
    }, 204),
  }
}
