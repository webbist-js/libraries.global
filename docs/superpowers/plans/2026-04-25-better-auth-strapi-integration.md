# Better Auth + Strapi Users-Permissions Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user who signs up or logs in via Better Auth (email/password, Google, GitHub) is automatically synced as a real user in Strapi's `up_users` table (users-permissions plugin), making Strapi the source of truth for user records.

**Architecture:** Better Auth runs in Next.js and owns sessions + OAuth flows. A lightweight Strapi API endpoint (`/api/auth-bridge/sync-user`) accepts server-to-server calls secured with a shared secret. Better Auth's `databaseHooks.user.create.after` calls this endpoint immediately after every new user creation, creating the corresponding `up_users` record. The "Failed to get session" crash is fixed by adding try/catch to `getSessionSSR`.

**Tech Stack:** Better Auth 1.4.x, Next.js 15 App Router, Strapi v5, pg (Postgres), TypeScript.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/ui/src/lib/auth.ts` | Modify | Add `databaseHooks`, pool singleton, migrate-on-load |
| `apps/ui/src/lib/auth-server.ts` | Modify | Wrap `getSessionSSR` in try/catch |
| `apps/ui/src/app/api/auth/[...all]/route.ts` | Modify | Remove duplicate `runMigrations` (now in auth.ts) |
| `apps/ui/.env.local` | Modify | Add `STRAPI_BRIDGE_SECRET` |
| `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` | Create | Find-or-create `up_users` entry, issue Strapi JWT |
| `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts` | Create | Register `POST /api/auth-bridge/sync-user` with no auth |
| `apps/strapi/.env` | Modify | Add `STRAPI_BRIDGE_SECRET` |

---

## Task 1: Add env vars to both apps

**Files:**
- Modify: `apps/ui/.env.local`
- Modify: `apps/strapi/.env`

The shared secret is: `ff59ed7843da150329610c029276fe487f50c7ab865f37f61e3bb82b1cf4ed92`

- [ ] **Step 1: Add STRAPI_BRIDGE_SECRET to Next.js env**

In `apps/ui/.env.local`, add after the `# -------------------------- BE settings ---------------------------------` block:

```
STRAPI_BRIDGE_SECRET=ff59ed7843da150329610c029276fe487f50c7ab865f37f61e3bb82b1cf4ed92
```

- [ ] **Step 2: Add STRAPI_BRIDGE_SECRET to Strapi env**

In `apps/strapi/.env`, add at the bottom under `# ------- Better Auth -------`:

```
STRAPI_BRIDGE_SECRET=ff59ed7843da150329610c029276fe487f50c7ab865f37f61e3bb82b1cf4ed92
```

- [ ] **Step 3: Verify both envs have the same value**

```bash
grep STRAPI_BRIDGE_SECRET apps/ui/.env.local apps/strapi/.env
```

Expected output: both lines show the same secret.

---

## Task 2: Create the Strapi auth-bridge controller

**Files:**
- Create: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`

This controller handles `POST /api/auth-bridge/sync-user`. It validates the shared secret, then finds or creates the Strapi user, and issues a Strapi JWT.

- [ ] **Step 1: Create the controller directory and file**

Create `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` with this exact content:

```ts
export default {
  async syncUser(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { email, name, provider } = ctx.request.body as {
      email?: string
      name?: string
      provider?: string
    }

    if (!email || !provider) {
      return ctx.badRequest("Missing required fields: email, provider")
    }

    // Find existing Strapi user by email
    let user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } })

    if (!user) {
      // Look up the default "authenticated" role
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } })

      if (!authenticatedRole) {
        return ctx.internalServerError(
          'Strapi "authenticated" role not found. Check users-permissions setup.'
        )
      }

      // Create user in up_users — email used as username for uniqueness
      user = await strapi.query("plugin::users-permissions.user").create({
        data: {
          email,
          username: email, // email is unique; use as username
          provider,
          confirmed: true,
          blocked: false,
          role: authenticatedRole.id,
        },
      })
    }

    // Issue a Strapi JWT for this user
    const jwt = strapi
      .plugin("users-permissions")
      .service("jwt")
      .issue({ id: user.id })

    return ctx.send({
      user: { id: user.id, email: user.email, username: user.username },
      jwt,
    })
  },
}
```

- [ ] **Step 2: Verify the file was created**

```bash
cat apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts
```

Expected: the controller content above.

---

## Task 3: Create the Strapi auth-bridge route

**Files:**
- Create: `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`

Strapi v5 auto-discovers API routes from `src/api/*/routes/*.ts`. No registration in `src/index.ts` needed. The route must have `auth: false` — the endpoint is secured by the shared secret, not a Strapi JWT.

- [ ] **Step 1: Create the route file**

Create `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`:

```ts
export default {
  routes: [
    {
      method: "POST",
      path: "/auth-bridge/sync-user",
      handler: "auth-bridge.syncUser",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
}
```

- [ ] **Step 2: Verify Strapi API structure**

```bash
ls apps/strapi/src/api/auth-bridge/
```

Expected:
```
controllers/
routes/
```

---

## Task 4: Fix `auth-server.ts` — prevent session errors from crashing pages

**Files:**
- Modify: `apps/ui/src/lib/auth-server.ts`

Currently `getSessionSSR` propagates any error thrown by `auth.api.getSession`. This crashes pages with "Failed to get session". The fix is a try/catch that returns `null` on any error so pages degrade gracefully (showing "Sign in" instead of crashing).

- [ ] **Step 1: Update `getSessionSSR` with try/catch**

Replace the entire content of `apps/ui/src/lib/auth-server.ts`:

```ts
import "server-only"

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers"

import { auth } from "./auth"

export type { Session } from "./auth"

export type BetterAuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export type BetterAuthSession = {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type AuthSessionResult = {
  user: BetterAuthUser
  session: BetterAuthSession
} | null

/**
 * Retrieve the current Better Auth session from the Next.js auth handler.
 * Returns null (never throws) so pages degrade gracefully when session is
 * unavailable, expired, or BA encounters a transient DB error.
 */
export async function getSessionSSR(
  headers: ReadonlyHeaders
): Promise<AuthSessionResult> {
  try {
    const session = await auth.api.getSession({
      headers: headers as unknown as Headers,
    })
    return session as AuthSessionResult
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify the file**

```bash
cat apps/ui/src/lib/auth-server.ts
```

Expected: file matches above.

---

## Task 5: Update `auth.ts` — add Strapi sync hook, pool singleton, migrate-on-load

**Files:**
- Modify: `apps/ui/src/lib/auth.ts`

Three changes in one file:
1. **Pool singleton** — prevents duplicate connections when Next.js dev hot-reloads the module
2. **`databaseHooks.user.create.after`** — fires for every new user regardless of provider (email, Google, GitHub); calls Strapi bridge
3. **`runMigrations` on load** — ensures BA tables exist before any `getSession` call (not just when route.ts is first hit)

- [ ] **Step 1: Rewrite `auth.ts`**

Replace the entire content of `apps/ui/src/lib/auth.ts`:

```ts
import "server-only"

import { betterAuth } from "better-auth"
import { Pool } from "pg"

import { sendResetPasswordEmail } from "./email"

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
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      pkce: false, // GitHub OAuth Apps don't support PKCE
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session token after 1 day of activity
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Sync every new BA user to Strapi's up_users table.
          // Fires for email/password registration and all OAuth providers.
          await syncUserToStrapi({ email: user.email, name: user.name })
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
```

- [ ] **Step 2: Verify the file**

```bash
cat apps/ui/src/lib/auth.ts
```

Expected: file matches above.

---

## Task 6: Clean up `route.ts` — remove duplicate `runMigrations`

**Files:**
- Modify: `apps/ui/src/app/api/auth/[...all]/route.ts`

`runMigrations` now runs in `auth.ts` on module load. The call in `route.ts` is redundant (though harmless). Remove it for clarity.

- [ ] **Step 1: Update route.ts**

Replace entire content of `apps/ui/src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"

export const { POST, GET } = toNextJsHandler(auth)
```

- [ ] **Step 2: Verify**

```bash
cat "apps/ui/src/app/api/auth/[...all]/route.ts"
```

Expected: 5 lines matching above.

---

## Task 7: Verify full flow end-to-end

Prerequisites: both Strapi and Next.js dev servers running.

- [ ] **Step 1: Confirm Strapi route is registered**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:1337/api/auth-bridge/sync-user \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: wrongsecret" \
  -d '{"email":"test@test.com","provider":"local"}'
```

Expected: `401` (unauthorized — secret mismatch, but route exists)

- [ ] **Step 2: Confirm the endpoint accepts valid secret**

```bash
curl -s -X POST http://127.0.0.1:1337/api/auth-bridge/sync-user \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: ff59ed7843da150329610c029276fe487f50c7ab865f37f61e3bb82b1cf4ed92" \
  -d '{"email":"smoke@test.com","name":"Smoke Test","provider":"local"}' | jq .
```

Expected: JSON with `{ "user": { "id": ..., "email": "smoke@test.com" }, "jwt": "..." }`

- [ ] **Step 3: Confirm test user appeared in Strapi up_users**

```bash
PGPASSWORD=mFm8z7z8 psql -h localhost -p 5433 -U admin librariesglobal \
  -c "SELECT id, email, provider, confirmed FROM up_users WHERE email='smoke@test.com';"
```

Expected: one row with `confirmed = true`, `provider = local`.

- [ ] **Step 4: Test email/password sign-up in the UI**

Navigate to `http://localhost:3000/auth/register`, create a new account with email + password.

After submit, run:
```bash
PGPASSWORD=mFm8z7z8 psql -h localhost -p 5433 -U admin librariesglobal \
  -c "SELECT id, email, provider, confirmed FROM up_users ORDER BY id DESC LIMIT 3;"
```

Expected: the new email appears in `up_users`.

- [ ] **Step 5: Test Google OAuth in the UI**

Navigate to `http://localhost:3000/auth/signin`, click "Continue with Google", complete OAuth. After redirect back:
- Page must NOT show "Something went wrong" or "Failed to get session"
- Header must show user menu (not "Sign in")
- `up_users` must contain the Google account email

```bash
PGPASSWORD=mFm8z7z8 psql -h localhost -p 5433 -U admin librariesglobal \
  -c "SELECT id, email, provider, confirmed FROM up_users ORDER BY id DESC LIMIT 3;"
```

- [ ] **Step 6: Test GitHub OAuth**

Navigate to `http://localhost:3000/auth/signin`, click "Continue with GitHub". After redirect:
- No 404 (PKCE already disabled)
- No "Failed to get session" error
- User appears in `up_users`

- [ ] **Step 7: Verify existing users in up_users are visible in Strapi admin**

Open `http://127.0.0.1:1337/admin` → Content Manager → User (from users-permissions). The synced users should appear there.

---

## Known Constraints

- The `provider` field in `up_users` is always set to `"local"` regardless of OAuth provider. This is intentional — Strapi is used only as a user store, not as an auth provider. Actual auth lives entirely in Better Auth.
- If a user already exists in `up_users` by email, the sync endpoint returns the existing record (idempotent).
- The Strapi JWT returned by the sync endpoint is not currently stored in the BA session. If future features need per-user Strapi API calls on behalf of the user, extend the BA session schema to include `strapiJWT` and store the value returned by the sync hook.
