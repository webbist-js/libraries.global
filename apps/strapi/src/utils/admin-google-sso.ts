import type { Core } from "@strapi/strapi"
import { Strategy as GoogleStrategy } from "passport-google-oauth2"

interface GoogleProfile {
  email?: string
  email_verified?: boolean
}

type VerifyDone = (
  error: Error | null,
  user?: { email: string } | false
) => void

function adminSsoLoopbackCallback({ env }: Core.Config.Shared.ConfigParams) {
  const callback = new URL(env("STRAPI_ADMIN_GOOGLE_CALLBACK_URL", ""))
  if (
    callback.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(callback.hostname) ||
    callback.pathname !== "/admin/connect/google" ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash
  ) {
    throw new Error(
      "Admin SSO loopback mode requires an HTTP loopback callback"
    )
  }

  return callback
}

export function adminPanelUrl({ env }: Core.Config.Shared.ConfigParams) {
  if (!env.bool("STRAPI_ADMIN_SSO_LOOPBACK", false)) return "/admin"

  return new URL("/admin", adminSsoLoopbackCallback({ env })).toString()
}

export function adminAuthCookieSecure({
  env,
}: Core.Config.Shared.ConfigParams) {
  if (!env.bool("STRAPI_ADMIN_SSO_LOOPBACK", false)) {
    return env("NODE_ENV") === "production"
  }

  adminSsoLoopbackCallback({ env })

  // The browser-to-CMS connection must be carried by an encrypted SSH tunnel.
  return false
}

export function googleAdminAuthProviders({
  env,
}: Core.Config.Shared.ConfigParams) {
  if (!env.bool("STRAPI_ADMIN_GOOGLE_SSO_ENABLED", false)) return []

  const clientID = env("GOOGLE_CLIENT_ID")
  const clientSecret = env("GOOGLE_CLIENT_SECRET")
  if (!clientID || !clientSecret) {
    throw new Error(
      "Google admin SSO requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    )
  }

  const allowedEmails = new Set(
    env
      .array("STRAPI_ADMIN_GOOGLE_ALLOWED_EMAILS", [])
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
  if (allowedEmails.size === 0) {
    throw new Error(
      "Google admin SSO requires STRAPI_ADMIN_GOOGLE_ALLOWED_EMAILS"
    )
  }

  return [
    {
      uid: "google",
      displayName: "Google",
      createStrategy: (strapi: Core.Strapi) =>
        new GoogleStrategy(
          {
            clientID,
            clientSecret,
            scope: ["email", "profile"],
            state: true,
            pkce: true,
            // An explicit URL supports private admin access through an SSH tunnel.
            callbackURL:
              env("STRAPI_ADMIN_GOOGLE_CALLBACK_URL") ||
              strapi.admin.services.passport.getStrategyCallbackURL("google"),
          },
          async (
            _accessToken: string,
            _refreshToken: string,
            profile: GoogleProfile,
            done: VerifyDone
          ) => {
            if (!profile.email || profile.email_verified !== true) {
              return done(null, false)
            }

            const email = profile.email.trim()
            if (!allowedEmails.has(email.toLowerCase()))
              return done(null, false)

            try {
              const user = await strapi.db.query("admin::user").findOne({
                where: {
                  email: { $eqi: email },
                  isActive: true,
                },
                select: ["email"],
              })

              // Only existing active administrators may sign in, even if someone
              // later enables auto-registration in Strapi's SSO settings.
              return done(null, user ? { email: user.email } : false)
            } catch {
              return done(new Error("Unable to verify Google admin access"))
            }
          }
        ),
    },
  ]
}
