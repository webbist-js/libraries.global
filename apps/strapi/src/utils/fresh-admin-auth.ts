import type { Core } from "@strapi/strapi"
import { errors } from "@strapi/utils"

type AdminSession = { metadata?: { loginAt?: string }; expiresAt?: string }
type AdminDatabase = {
  db: {
    query: (uid: string) => {
      findOne: (params: {
        where: Record<string, unknown>
        select: string[]
      }) => Promise<unknown>
    }
  }
}
type AdminContext = {
  state?: { session?: { id?: string }; user?: { id?: string | number } }
  status?: number
  body?: unknown
}

/** Strapi 5.60 preserves metadata.loginAt across token rotation. Access-token
 * issuance is deliberately not used as proof of a new administrator sign-in.
 */
export async function requireFreshAdminAuth(
  strapi: AdminDatabase,
  ctx: AdminContext,
  now = Date.now()
) {
  const sessionId = ctx.state?.session?.id
  const userId = ctx.state?.user?.id
  const session =
    sessionId && userId !== undefined
      ? await strapi.db.query("admin::session").findOne({
          where: {
            sessionId,
            userId: String(userId),
            origin: "admin",
            status: "active",
          },
          select: ["metadata", "expiresAt"],
        })
      : null
  const stored = session as AdminSession | null
  const loginAt = Date.parse(stored?.metadata?.loginAt ?? "")
  if (
    Number.isFinite(loginAt) &&
    loginAt <= now + 30_000 &&
    loginAt >= now - 300_000 &&
    Date.parse(stored?.expiresAt ?? "") > now
  )
    return true
  ctx.status = 403
  ctx.body = { error: "reauthentication_required" }

  return false
}

export async function ensureFreshAdminApproval(
  strapi: Core.Strapi,
  ctx: AdminContext,
  documentId: string,
  status: string
) {
  if (status !== "approved") return
  const target = await strapi
    .documents("plugin::content-moderation.submission")
    .findOne({ documentId, fields: ["submissionType"] })
  if (
    !target ||
    !["role_application", "library_claim"].includes(target.submissionType)
  )
    return
  if (!(await requireFreshAdminAuth(strapi, ctx)))
    throw new errors.ForbiddenError(
      "Sign out and sign back in before approving account authority."
    )
}
