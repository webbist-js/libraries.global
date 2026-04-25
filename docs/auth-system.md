# Auth System — libraries.global

## Overview

Authentication is handled by **Better Auth** running as a **Strapi-native plugin** (`@strapi-community/plugin-better-auth`). Better Auth lives entirely inside Strapi — not in Next.js. All auth endpoints are served from `{STRAPI_URL}/api/better-auth/*`.

The Next.js frontend is a pure consumer: it calls Strapi's auth endpoints via the `authClient` and reads the session in RSC pages via a cookie-forwarding fetch helper.

There is no `strapiJWT` in sessions. There are no custom Better Auth plugins in Next.js. Auth is fully managed by Strapi.

---

## Architecture

```
Browser
  └── authClient (better-auth/react)
       └── POST {STRAPI_URL}/api/better-auth/sign-in/email  (or sign-up, social, magic-link, etc.)
            └── Better Auth (Strapi plugin)
                 └── Sets session cookie on Strapi domain
                      └── Subsequent requests carry the cookie automatically
```

### SSR session retrieval (Next.js RSC pages)

RSC pages cannot access the browser's cookie jar directly. Instead, `getSessionSSR` forwards the incoming request's `Cookie` header to Strapi:

```
Next.js RSC page
  └── getSessionSSR(await headers())
       └── GET {STRAPI_URL}/api/better-auth/get-session  (Cookie: forwarded)
            └── { user: BetterAuthUser, session: BetterAuthSession } | null
```

### OAuth flow

```
Browser
  └── authClient.signIn.social({ provider, callbackURL })
       └── Redirect to provider (GitHub / Google)
            └── Provider redirects to {STRAPI_URL}/api/better-auth/callback/{provider}
                 └── Better Auth sets session cookie → redirects to callbackURL
```

OAuth app callback URLs **must point to Strapi**, not to Next.js.

### Magic link flow

```
Browser
  └── authClient.signIn.magicLink({ email, callbackURL })
       └── Strapi sends email with link: {STRAPI_URL}/api/better-auth/magic-link/verify?token=...
            └── User clicks link → session cookie set → redirect to callbackURL
```

---

## Database tables

Better Auth creates four tables in Strapi's database. These are managed automatically — do not edit them manually.

| Table             | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `ba_user`         | User identity: id, email, name, emailVerified, image, createdAt, updatedAt |
| `ba_session`      | Active sessions: token, userId, expiresAt, ipAddress, userAgent            |
| `ba_account`      | OAuth account links: providerId, accountId, userId                         |
| `ba_verification` | Email verification and magic-link tokens                                   |

Session lifetime: **30 days** (`expiresIn: 60 * 60 * 24 * 30`).

---

## Key files

### Strapi (`apps/strapi`)

| File                | Purpose                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `config/plugins.ts` | Better Auth plugin config: secret, baseURL, trustedOrigins, email/password, OAuth providers, magic link, session lifetime |

### Next.js (`apps/ui/src`)

| File                                 | Purpose                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `lib/auth-client.ts`                 | `authClient` pointing at `{NEXT_PUBLIC_STRAPI_URL}/api/better-auth`; includes `magicLinkClient()` plugin         |
| `lib/auth-server.ts`                 | `getSessionSSR(headers)` for RSC pages; exports `BetterAuthUser`, `BetterAuthSession`, `AuthSessionResult` types |
| `hooks/useUserMutations.ts`          | React Query mutation hooks: sign-in, register, change/forgot/reset password                                      |
| `app/[locale]/auth/signin/`          | Sign-in page (email+password tab and magic link tab)                                                             |
| `app/[locale]/auth/register/`        | Registration page                                                                                                |
| `app/[locale]/auth/forgot-password/` | Forgot password page                                                                                             |
| `app/[locale]/auth/change-password/` | Change password page (authenticated)                                                                             |
| `app/[locale]/auth/reset-password/`  | Reset password via token from email                                                                              |
| `app/[locale]/auth/magic-link-sent/` | "Check your inbox" confirmation page                                                                             |
| `app/[locale]/auth/magic-link/`      | Magic link verification / fallback page                                                                          |

---

## Environment variables

### `apps/strapi/.env`

```env
BETTER_AUTH_SECRET=<32+ char random string>
BETTER_AUTH_BASE_URL=https://<strapi-domain>/api/better-auth
APP_PUBLIC_URL=https://<nextjs-domain>
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### `apps/ui/.env.local`

```env
NEXT_PUBLIC_STRAPI_URL=https://<strapi-domain>
STRAPI_URL=https://<strapi-domain>   # server-side only (not prefixed with NEXT_PUBLIC_)
```

The following variables are **no longer needed in the UI** and should be removed if present:

- `BETTER_AUTH_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

---

## Using auth in Next.js code

### Server components (RSC pages)

```ts
import { headers } from "next/headers"
import { getSessionSSR } from "@/lib/auth-server"

// Returns { user: BetterAuthUser, session: BetterAuthSession } | null
const session = await getSessionSSR(await headers())

if (!session) {
  // User is not authenticated
}
```

### Client components

```ts
import { authClient } from "@/lib/auth-client"

// Sign in with email + password
const result = await authClient.signIn.email({
  email,
  password,
  callbackURL: "/",
})

// Sign in with magic link (sends email)
await authClient.signIn.magicLink({ email, callbackURL: "/" })

// OAuth sign-in (redirect flow)
await authClient.signIn.social({ provider: "github", callbackURL: "/" })
await authClient.signIn.social({ provider: "google", callbackURL: "/" })

// Register a new account
await authClient.signUp.email({
  email,
  password,
  name: email,
  callbackURL: "/",
})

// Reactive session (re-renders on change)
const { data: session } = authClient.useSession()

// Sign out
await authClient.signOut()

// Password management
await authClient.changePassword({
  currentPassword,
  newPassword,
  revokeOtherSessions: false,
})
await authClient.forgetPassword({ email, redirectTo: "/auth/reset-password" })
await authClient.resetPassword({ newPassword, token })
```

### Strapi controllers (server-side)

```ts
const session = await strapi.betterAuth.api.getSession({
  headers: ctx.request.headers,
})
if (!session?.user) return ctx.unauthorized()

const { user } = session
// user.id, user.email, user.name, user.emailVerified
```

---

## OAuth app configuration

For OAuth to work, the provider's callback URL must point to **Strapi**, not Next.js.

| Provider | Setting                    | Value                                                     |
| -------- | -------------------------- | --------------------------------------------------------- |
| GitHub   | Authorization callback URL | `https://<strapi-domain>/api/better-auth/callback/github` |
| Google   | Authorized redirect URI    | `https://<strapi-domain>/api/better-auth/callback/google` |

---

## Local development

For credential sign-in and magic link, no special config is needed. Strapi (port 1337) and Next.js (port 3000) both run on `localhost`, so the session cookie is shared across ports automatically.

### OAuth in local dev (requires HTTPS)

OAuth providers require HTTPS and a publicly reachable callback URL. Use ngrok:

```bash
# Terminal 1 — expose Strapi
ngrok http 1337

# Terminal 2 — expose Next.js
ngrok http 3000
```

Update `.env` files with the ngrok URLs:

```env
# apps/strapi/.env
BETTER_AUTH_BASE_URL=https://<strapi-ngrok-subdomain>.ngrok-free.app/api/better-auth
APP_PUBLIC_URL=https://<ui-ngrok-subdomain>.ngrok-free.app

# apps/ui/.env.local
NEXT_PUBLIC_STRAPI_URL=https://<strapi-ngrok-subdomain>.ngrok-free.app
STRAPI_URL=https://<strapi-ngrok-subdomain>.ngrok-free.app
```

Update the OAuth app callback URLs to match the Strapi ngrok URL. Free-tier ngrok generates a new subdomain on each restart, so this must be repeated each session.

---

## What was removed in the Better Auth migration

The previous system ran Better Auth inside Next.js with three custom plugins that bridged BA sessions to Strapi users-permissions JWTs. All of this has been removed:

| Removed                                      | What it did                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `strapiAuthPlugin`                           | Translated BA sign-in into a Strapi `/auth/local` call; stored the Strapi JWT in the BA session |
| `strapiOAuthPlugin`                          | Synced OAuth sign-ins to Strapi users-permissions via `/auth/{provider}/callback`               |
| `strapiSessionPlugin`                        | Validated the Strapi JWT on every `getSession()` call by hitting `/users/me`                    |
| `apps/ui/src/app/api/auth/[...all]/route.ts` | Next.js route that handled all BA endpoints                                                     |
| `apps/ui/src/lib/auth.ts`                    | Better Auth server config (no longer needed in the UI)                                          |
| `strapiJWT` field in sessions                | There is no Strapi JWT in sessions anymore                                                      |

Auth is now a single system: Better Auth in Strapi, with its own user store (`ba_user`), session store (`ba_session`), and OAuth account links (`ba_account`).

---

## Strapi roles and permissions

These apply to Strapi's content API (not to Better Auth itself). Configure in **Strapi Admin → Settings → Users & Permissions → Roles**.

### Public (unauthenticated)

| Permission               | Endpoint                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| Read published libraries | `GET /api/libraries`                                                  |
| Read published locations | `GET /api/countries`, `/api/regions`, `/api/areas`, `/api/continents` |
| Read map pins            | `/api/map/*`                                                          |

### Authenticated (default logged-in role)

All Public permissions plus:

| Permission           | Endpoint                                     | Notes                          |
| -------------------- | -------------------------------------------- | ------------------------------ |
| Create submissions   | `POST /api/content-moderation/submissions`   | corrections, claims, additions |
| Read own submissions | `GET /api/content-moderation/submissions/my` | view submission status         |

### Editor (moderator — assign manually in Strapi Admin)

All Authenticated permissions plus:

| Permission               | Endpoint                                               | Notes                      |
| ------------------------ | ------------------------------------------------------ | -------------------------- |
| Read all submissions     | `GET /api/content-moderation/submissions`              | moderation dashboard       |
| Update submission status | `PATCH /api/content-moderation/submissions/:id/status` | approve / reject           |
| Update library entries   | `PUT /api/libraries/:id`                               | apply approved corrections |

---

## Adding more OAuth providers

1. Add the provider's credentials to `apps/strapi/.env`
2. Add the provider to the `socialProviders` block in `apps/strapi/config/plugins.ts`
3. Register the OAuth app with the provider; set the callback URL to `{STRAPI_URL}/api/better-auth/callback/{provider}`
4. Add a sign-in button in the UI calling `authClient.signIn.social({ provider: "..." })`
