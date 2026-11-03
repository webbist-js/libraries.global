import { passkey } from "@better-auth/passkey"
import {
  buildSessionAccess,
  isContributorRole,
  isPaidMembership,
  type SessionProfile,
} from "@repo/access"
import {
  MAGIC_LINK_TTL_SECONDS,
  RESET_LINK_TTL_SECONDS,
  VERIFICATION_LINK_TTL_SECONDS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  TERMS_VERSION,
} from "@repo/shared-data/auth-policy"
import {
  emailOwnershipProtection,
  recordSignupBrowser,
  type VerificationContext,
} from "@repo/shared-data/email-ownership-proof"
import { liveCookieOptions, signLiveProof } from "@repo/shared-data/live-proof"
import {
  mobileAuthConfig,
  MOBILE_SESSION_COOKIE,
} from "@repo/shared-data/mobile-auth"
import {
  confirmationLocked,
  recordFailure,
  withConfirmation,
} from "@repo/shared-data/mobile-confirmation"
import { strapiAdapter } from "@strapi-community/plugin-better-auth"
import { betterAuth } from "better-auth"
import {
  getSessionFromCtx,
  APIError,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api"
import { customSession, magicLink } from "better-auth/plugins"

import { applicationPool } from "./application-db"
import { verifiedDiscordProfile } from "./discord-profile"
import {
  sendMagicLinkEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "./email"
import { ensureProfile } from "./profile"
import { sessionProfile } from "./session-profile"
import { eraseAccount } from "../utils/erase-account"

const TERMS_REQUIRED_MESSAGE =
  "Confirm you're 18 or over and accept the terms to create an account."

/**
 * The terms version a new user accepted: sent in the sign-up body for email
 * accounts, or carried through the OAuth state for social sign-up.
 */
async function acceptedTermsVersion(
  user: Record<string, unknown>
): Promise<unknown> {
  if (user.termsVersion) return user.termsVersion
  try {
    const state = (await getOAuthState()) as { termsVersion?: unknown } | null

    return state?.termsVersion
  } catch {
    return undefined
  }
}

const mobile = mobileAuthConfig(
  process.env.MOBILE_APP_URL,
  process.env.APP_PUBLIC_URL
)
const pool = applicationPool()

async function verificationContext(): Promise<VerificationContext> {
  return auth.$context
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  trustedOrigins: [
    process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
    ...(mobile ? [mobile.mobile.origin] : []),
  ],
  advanced: {
    database: { generateId: "serial" },
    ipAddress: { ipAddressHeaders: ["x-auth-client-ip"] },
    ...(mobile
      ? {
          cookies: {
            session_token: {
              name: MOBILE_SESSION_COOKIE,
              attributes: { domain: mobile.cookieDomain },
            },
          },
        }
      : {}),
  },
  database: strapiAdapter(),
  user: {
    deleteUser: {
      enabled: true,
      // Billing must settle before domain erasure, regardless of entry point.
      beforeDelete: async (user) => {
        const secret = process.env.STRAPI_BRIDGE_SECRET
        if (!secret)
          throw new Error("Account deletion bridge is not configured")
        const response = await fetch(
          new URL(
            "/api/internal/auth/before-delete",
            process.env.APP_INTERNAL_URL ?? process.env.APP_PUBLIC_URL
          ),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Service-Secret": secret,
            },
            body: JSON.stringify({ userId: user.id }),
            signal: AbortSignal.timeout(30_000),
          }
        )
        if (!response.ok)
          throw new APIError("SERVICE_UNAVAILABLE", {
            message:
              "Account deletion could not be completed. Please try again.",
          })
        await eraseAccount(strapi, { baUserId: user.id, email: user.email })
      },
    },
    // Record of the terms and 18+ confirmation each account accepted.
    additionalFields: {
      termsVersion: { type: "string", required: false, input: true },
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path === "/passkey/verify-authentication" &&
        ctx.headers?.get("x-live-confirm") === "true"
      ) {
        const existing = await getSessionFromCtx(ctx)
        if (!existing)
          throw new APIError("UNAUTHORIZED", { message: "Sign in first" })
        const locked = await withConfirmation(
          pool,
          existing.user.id,
          async (state) => confirmationLocked(state)
        )
        if (locked)
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Try again in 15 minutes",
          })
        const liveContext = ctx.context as unknown as { liveUserId?: string }
        liveContext.liveUserId = existing.user.id
      }
      if (
        ctx.path === "/sign-up/email" &&
        (ctx.body as { termsVersion?: unknown } | undefined)?.termsVersion !==
          TERMS_VERSION
      ) {
        throw new APIError("BAD_REQUEST", { message: TERMS_REQUIRED_MESSAGE })
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      recordSignupBrowser(ctx, process.env.NODE_ENV === "production")
      if (
        ctx.path !== "/passkey/verify-authentication" ||
        ctx.headers?.get("x-live-confirm") !== "true"
      )
        return
      const liveUserId = (ctx.context as unknown as { liveUserId?: string })
        .liveUserId
      const fresh = ctx.context.newSession
      if (fresh && fresh.user.id === liveUserId) {
        await withConfirmation(pool, fresh.user.id, async (state) => {
          state.attempts = 0
          state.lockedUntil = 0
        })
        ctx.setCookie(
          "lg_live",
          signLiveProof(fresh.user.id, fresh.session.id),
          liveCookieOptions
        )
      } else if (liveUserId) {
        const locked = await withConfirmation(pool, liveUserId, async (state) =>
          recordFailure(state)
        )
        if (locked && process.env.STRAPI_BRIDGE_SECRET)
          await fetch(
            `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/mobile-libraries/live/locked`,
            {
              method: "POST",
              headers: {
                "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET,
                "X-Ba-User-Id": liveUserId,
              },
              signal: AbortSignal.timeout(5000),
            }
          ).catch(() => {})
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    // Unverified password accounts cannot sign in. Without this, anyone could
    // register someone else's address and pre-claim the account.
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    resetPasswordTokenExpiresIn: RESET_LINK_TTL_SECONDS,
    // A reset may follow a stolen password, so it ends every session.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      const base = process.env.APP_PUBLIC_URL ?? "http://localhost:3000"
      const url = `${base}/auth/reset-password?token=${encodeURIComponent(token)}`
      await sendResetPasswordEmail(user.email, url)
    },
  },
  emailVerification: {
    ...emailOwnershipProtection(verificationContext),
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: VERIFICATION_LINK_TTL_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url)
    },
  },
  rateLimit: {
    enabled: true,
    // Database storage so limits hold across CMS instances.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/magic-link": { window: 60, max: 3 },
      "/sign-up/email": { window: 60, max: 3 },
      "/forget-password": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      // Guesses at the current password from a signed-in session.
      "/change-password": { window: 60, max: 5 },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            mapProfileToUser: verifiedDiscordProfile,
          },
        }
      : {}),
  },
  plugins: [
    passkey({
      rpName: "Libraries Global",
      origin: mobile
        ? [mobile.site.origin, mobile.mobile.origin]
        : (process.env.APP_PUBLIC_URL ?? "http://localhost:3000"),
    }),
    magicLink({
      // Sign-in only: new accounts must come through a flow that shows the
      // terms and the 18+ confirmation.
      disableSignUp: true,
      expiresIn: MAGIC_LINK_TTL_SECONDS,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
    }),
    customSession(async ({ user, session }) => {
      await ensureProfile(strapi, user)
      const data = await sessionProfile(strapi, user.id)
      const profile: SessionProfile = {
        ...data,
        contributorRole: isContributorRole(data.contributorRole)
          ? data.contributorRole
          : "reader",
        compositionPreferences: {
          country: data.country,
          languages: data.languages.filter((entry) =>
            ["native", "fluent", "conversational"].includes(entry.proficiency)
          ) as NonNullable<
            SessionProfile["compositionPreferences"]
          >["languages"],
        },
        paidMembership:
          isPaidMembership(data.paidMembership) &&
          data.paidMembership.mode === (process.env.BILLING_ENV ?? "sandbox")
            ? data.paidMembership
            : null,
      }

      return { user: { ...user, ...buildSessionAccess(profile) }, session }
    }),
  ],
  session: {
    freshAge: 5 * 60,
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session token after 1 day of activity
    cookieCache: {
      enabled: false,
    },
  },
  databaseHooks: {
    account: {
      create: {
        // Pre-hijack guard. Better Auth implicitly links an OAuth login to an
        // existing user with the same email, then marks the email verified.
        // If that existing user was never verified, whoever set its password
        // may not own the address — so drop the password credential and any
        // sessions before the rightful owner's OAuth account is attached.
        before: async (account) => {
          if (account.providerId === "credential") return
          const context = await auth.$context
          const user = await context.internalAdapter.findUserById(
            account.userId
          )
          if (user && !user.emailVerified) {
            await context.adapter.deleteMany({
              model: "account",
              where: [
                { field: "userId", value: account.userId },
                { field: "providerId", value: "credential" },
              ],
            })
            await context.internalAdapter.deleteUserSessions(account.userId)
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await (
            await auth.$context
          ).internalAdapter.findUserById(session.userId)
          if (!user) return false
          await ensureProfile(strapi, user)

          return { data: session }
        },
      },
    },
    user: {
      create: {
        // No account without accepting the current terms (which include the
        // 18+ requirement). Returning false aborts the creation.
        before: async (user) => {
          const version = await acceptedTermsVersion(user)
          if (version !== TERMS_VERSION) return false

          return {
            data: {
              ...user,
              termsVersion: TERMS_VERSION,
              termsAcceptedAt: new Date(),
            },
          }
        },
        after: async (user) => {
          await ensureProfile(strapi, user)
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
