import "server-only"

import { betterAuth } from "better-auth"
import { magicLink } from "better-auth/plugins"
import { Pool } from "pg"

import { sendMagicLinkEmail, sendResetPasswordEmail } from "./email"

// Pool singleton — prevents multiple connections during Next.js dev hot-reload
const globalForPg = global as typeof globalThis & { _baPool?: Pool }
const pool =
  globalForPg._baPool ??
  new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== "production") globalForPg._baPool = pool

/**
 * Called by databaseHooks.user.create.after for every new BA user.
 * Creates the corresponding record in Strapi's up_users table so that
 * Strapi's users-permissions plugin has awareness of the user.
 * Non-fatal — logs on failure but never throws.
 */
async function syncUserToStrapi(user: {
  id: string
  email: string
  name: string
}): Promise<void> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const secret = process.env.STRAPI_BRIDGE_SECRET

  if (!secret) {
    console.warn(
      "[auth] STRAPI_BRIDGE_SECRET not set — skipping Strapi user sync"
    )
    return
  }

  try {
    const res = await fetch(`${strapiUrl}/api/auth-bridge/sync-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify({
        email: user.email,
        name: user.name,
        provider: "local",
        baUserId: user.id,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("[auth] Strapi sync failed:", res.status, text)
    }
  } catch (err) {
    console.error("[auth] Failed to reach Strapi for user sync:", err)
  }
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  trustedOrigins: [process.env.APP_PUBLIC_URL ?? "http://localhost:3000"],
  database: pool,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token }) => {
      const base = process.env.APP_PUBLIC_URL ?? "http://localhost:3000"
      const url = `${base}/auth/reset-password?token=${encodeURIComponent(token)}`
      await sendResetPasswordEmail(user.email, url)
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session token after 1 day of activity
    cookieCache: {
      enabled: false, // Disable cookie cache — prevents "Invalid Base64 character: ." errors
      // from stale session_data cookies set by old BA instances (Strapi plugin era)
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Sync every new BA user to Strapi's up_users table.
          // Fires for email/password registration and all OAuth providers.
          await syncUserToStrapi({ id: user.id, email: user.email, name: user.name })
        },
      },
    },
  },
})

// Run BA table migrations on module load so tables exist before any
// getSession call — not just when the /api/auth/* route handler is first hit.
void auth.$context
  .then((ctx) => ctx.runMigrations())
  .catch((err) => console.error("[better-auth] migration error:", err))

export type Session = typeof auth.$Infer.Session
