import { errors } from "@strapi/utils"
import { fromNodeHeaders } from "better-auth/node"

/** Cookie identity for owner routes; never accept a body/query/bridge user ID. */
export default async (
  ctx: any,
  _config: unknown,
  { strapi }: { strapi: any }
) => {
  const auth = strapi.plugin("better-auth").service("auth-service").getAuth()
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(ctx.request.headers),
    query: { disableRefresh: true },
  })
  if (!session?.user) throw new errors.UnauthorizedError("Sign in required")
  ctx.state.accountUser = session.user

  return true
}
