# Better Auth Migration Design Spec

**Date:** 2026-04-25
**Scope:** Migrate auth from custom Next.js Better Auth + Strapi users-permissions bridge to `@strapi-community/plugin-better-auth` (Strapi-native), adding magic link sign-in alongside credentials and OAuth.

---

## Problem

The current auth setup is a bespoke bridge: Better Auth runs inside Next.js and translates sessions into Strapi users-permissions JWTs via three custom plugins (`strapiAuthPlugin`, `strapiOAuthPlugin`, `strapiSessionPlugin`). This is fragile — it duplicates user storage, requires maintaining two auth layers in sync, and makes Strapi API calls on behalf of users awkward.

The `@strapi-community/plugin-better-auth` package installs Better Auth as Strapi's own database adapter. All auth endpoints live at `/api/better-auth/*` on the Strapi origin. Next.js becomes a thin consumer.

---

## What Moves / What Disappears

### Deleted from `apps/ui`

| Path                                  | Reason                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/auth.ts`                     | Next.js Better Auth server instance — replaced by Strapi plugin     |
| `src/app/api/auth/[...all]/route.ts`  | Next.js Better Auth API route — replaced by Strapi endpoints        |
| `src/app/[locale]/auth/strapi-oauth/` | Strapi users-permissions OAuth callback route — no longer needed    |
| `src/types/better-auth.d.ts`          | `BetterAuthUserWithStrapi` type with `strapiJWT` — no longer needed |

### Added to `apps/ui`

| Path                                             | Purpose                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/lib/auth-client.ts`                         | Rewritten: `baseURL` → Strapi Better Auth, `magicLinkClient()` added     |
| `src/lib/auth-server.ts`                         | `getSessionSSR()` via cookie-forwarding fetch to Strapi session endpoint |
| `src/app/[locale]/auth/magic-link-sent/page.tsx` | "Check your inbox" confirmation page                                     |
| `src/app/[locale]/auth/magic-link/page.tsx`      | Magic link landing/verification page                                     |

### Added to `apps/strapi`

| Path                          | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `config/plugins.ts` (updated) | Add `better-auth` plugin entry with full config |

---

## Architecture & Data Flow

### Session flow (client → SSR)

```
Browser
  └── authClient.signIn.email() / signIn.social() / signIn.magicLink()
       └── POST {STRAPI_URL}/api/better-auth/sign-in/email   (etc.)
            └── Better Auth (Strapi plugin) sets session cookie on Strapi domain
                 └── Subsequent requests carry the cookie automatically
```

For localhost dev, Strapi runs on port 1337 and Next.js on 3000. Browsers share `localhost` cookies across ports, so the session cookie set by Strapi is readable by Next.js in dev.

For production, both apps must share a domain (e.g. `api.libraries.global` for Strapi, `libraries.global` for Next.js) so the session cookie's `domain` attribute covers both.

### SSR session retrieval

RSC pages cannot call `auth.api.getSession()` (no local Better Auth instance). Instead:

```ts
// lib/auth-server.ts
export async function getSessionSSR(headers: Headers) {
  const res = await fetch(
    `${process.env.STRAPI_URL}/api/better-auth/get-session`,
    {
      headers: { cookie: headers.get("cookie") ?? "" },
      cache: "no-store",
    }
  )
  if (!res.ok) return null
  return res.json() // { user, session } | null
}
```

Called in RSC layouts/pages that need auth context:

```ts
const session = await getSessionSSR(await headers())
```

### OAuth flow

```
Browser clicks "Sign in with GitHub"
  └── authClient.signIn.social({ provider: "github", callbackURL: "/dashboard" })
       └── Redirects to GitHub → callback lands at:
            {STRAPI_URL}/api/better-auth/callback/github
            └── Better Auth creates/links ba_user, sets session cookie
                 └── Redirects to callbackURL (Next.js domain)
```

OAuth app callback URLs must point to the Strapi origin (not Next.js).

### Magic link flow

```
User enters email → authClient.signIn.magicLink({ email })
  └── POST {STRAPI_URL}/api/better-auth/sign-in/magic-link
       └── sendMagicLink callback fires → Strapi email plugin sends email
            └── User clicks link → GET {STRAPI_URL}/api/better-auth/magic-link/verify?token=...
                 └── Session set → redirect to callbackURL
```

> **Note:** Magic link is marked untested in the plugin README (as of April 2025). This feature may require debugging after initial setup. The design is spec-compliant with Better Auth's `magicLink()` plugin API.

---

## Strapi Plugin Configuration

In `apps/strapi/config/plugins.ts`:

```ts
import { magicLink } from "better-auth/plugins"

export default ({ env }) => ({
  // ... existing plugins ...
  "better-auth": {
    enabled: true,
    config: {
      betterAuthOptions: {
        secret: env("BETTER_AUTH_SECRET"),
        baseURL: env("BETTER_AUTH_BASE_URL"), // e.g. https://abc.ngrok.io/api/better-auth
        trustedOrigins: [env("APP_PUBLIC_URL")], // e.g. https://xyz.ngrok.io (Next.js)
        emailAndPassword: {
          enabled: true,
          sendResetPassword: async ({ user, url }) => {
            await global.strapi.plugin("email").provider.send({
              to: user.email,
              subject: "Reset your libraries.global password",
              html: `<p>Reset your password: <a href="${url}">${url}</a></p>`,
              text: `Reset your password: ${url}`,
            })
          },
        },
        socialProviders: {
          github: {
            clientId: env("GITHUB_CLIENT_ID"),
            clientSecret: env("GITHUB_CLIENT_SECRET"),
          },
          google: {
            clientId: env("GOOGLE_CLIENT_ID"),
            clientSecret: env("GOOGLE_CLIENT_SECRET"),
          },
        },
        plugins: [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              await global.strapi.plugin("email").provider.send({
                to: email,
                subject: "Your sign-in link — libraries.global",
                html: `<p>Sign in to libraries.global: <a href="${url}">${url}</a></p>`,
                text: `Sign in: ${url}`,
              })
            },
          }),
        ],
        session: {
          expiresIn: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  },
})
```

`global.strapi` is available at runtime when the callback fires — this pattern is safe for Strapi v5.

---

## Next.js Auth Client

`apps/ui/src/lib/auth-client.ts` rewritten:

```ts
import { createAuthClient } from "better-auth/client"
import { magicLinkClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/better-auth`,
  plugins: [magicLinkClient()],
})
```

No custom Strapi plugins. No `strapiJWT`. The session returned by Better Auth contains `user` and `session` objects — standard Better Auth shape.

### Sign-in form changes

- **Credentials tab:** `authClient.signIn.email({ email, password, callbackURL: "/" })`
- **Magic link tab:** `authClient.signIn.magicLink({ email, callbackURL: "/" })` → redirect to `/auth/magic-link-sent`
- **Registration:** `authClient.signUp.email({ email, password, name, callbackURL: "/" })`
- **OAuth buttons:** `authClient.signIn.social({ provider: "github" | "google", callbackURL: "/" })`

### Hooks update

`useUserMutations.ts` replaces custom `signInStrapi`/`registerStrapi` calls with standard Better Auth client calls.

### Content-moderation plugin

`submission.ts` controller replaces `ctx.state?.user` (users-permissions pattern) with:

```ts
const session = await strapi.betterAuth.api.getSession({
  headers: ctx.request.headers,
})
if (!session?.user) return ctx.unauthorized()
const userId = session.user.id
```

---

## Database Tables

The plugin creates these tables automatically on first run (via Better Auth schema):

| Table             | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `ba_user`         | User identity (email, name, image, emailVerified)                |
| `ba_session`      | Active sessions (token, userId, expiresAt, ipAddress, userAgent) |
| `ba_account`      | OAuth account links (providerId, accountId, userId)              |
| `ba_verification` | Email/magic-link verification tokens                             |

Existing `users-permissions` users (`up_users_permissions_user`) are unrelated — since this is a local dev environment with no real users, the old table can be left as-is and ignored.

---

## Non-Code Setup Instructions

### 1. Install the plugin

```bash
cd apps/strapi
yarn add @strapi-community/plugin-better-auth
```

### 2. Environment variables — `apps/strapi/.env`

Add the following (remove from `apps/ui/.env.local` if present):

```env
# Better Auth
BETTER_AUTH_SECRET=ba_w3sxgbbfo14351ogc85t0wpcr215z75w
BETTER_AUTH_BASE_URL=https://<STRAPI_NGROK_SUBDOMAIN>.ngrok.io/api/better-auth

# Next.js public origin (for trustedOrigins)
APP_PUBLIC_URL=https://<UI_NGROK_SUBDOMAIN>.ngrok.io

# OAuth credentials
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### 3. Environment variables — `apps/ui/.env.local`

```env
# Points to Strapi (already set)
NEXT_PUBLIC_STRAPI_URL=https://<STRAPI_NGROK_SUBDOMAIN>.ngrok.io

# Remove these — no longer needed in Next.js:
# BETTER_AUTH_SECRET=...
# GITHUB_CLIENT_ID=...
# GITHUB_CLIENT_SECRET=...
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
```

### 4. GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → "OAuth Apps"
2. Edit (or create) your app:
   - **Homepage URL:** `https://<UI_NGROK_SUBDOMAIN>.ngrok.io`
   - **Authorization callback URL:** `https://<STRAPI_NGROK_SUBDOMAIN>.ngrok.io/api/better-auth/callback/github`
3. Copy Client ID and Client Secret into `apps/strapi/.env`

### 5. Google OAuth App

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID:
   - **Authorized JavaScript origins:** `https://<STRAPI_NGROK_SUBDOMAIN>.ngrok.io`
   - **Authorized redirect URIs:** `https://<STRAPI_NGROK_SUBDOMAIN>.ngrok.io/api/better-auth/callback/google`
3. Copy Client ID and Client Secret into `apps/strapi/.env`

### 6. ngrok setup

Run two ngrok tunnels (two terminal windows or a config file):

```bash
# Terminal 1 — Strapi
ngrok http 1337

# Terminal 2 — Next.js UI
ngrok http 3000
```

Update `BETTER_AUTH_BASE_URL`, `APP_PUBLIC_URL`, and `NEXT_PUBLIC_STRAPI_URL` in both `.env` files whenever ngrok subdomains change (they change on free tier each restart).

### 7. Strapi email plugin

Magic link and password reset emails require a working Strapi email provider. For local dev, configure `sendgrid`, `nodemailer`, or use the `fake-email` provider that logs to console:

In `apps/strapi/.env`:

```env
EMAIL_PROVIDER=nodemailer
EMAIL_SMTP_HOST=smtp.example.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=...
EMAIL_SMTP_PASS=...
EMAIL_DEFAULT_FROM=noreply@libraries.global
```

Or for quick local testing with console output only, leave as default (Strapi logs emails to terminal when no provider is configured in dev mode).

### 8. Verify plugin tables created

After starting Strapi for the first time with the plugin enabled, check the database for `ba_user`, `ba_session`, `ba_account`, `ba_verification` tables. If they are missing, run:

```bash
cd apps/strapi
yarn strapi develop --reset-db
```

> Warning: `--reset-db` drops and recreates the database. Only use in local dev with no important data.

---

## File Changes Summary

| Action  | Path                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| Install | `apps/strapi` → `yarn add @strapi-community/plugin-better-auth`                    |
| Update  | `apps/strapi/config/plugins.ts`                                                    |
| Delete  | `apps/ui/src/lib/auth.ts`                                                          |
| Delete  | `apps/ui/src/app/api/auth/[...all]/route.ts`                                       |
| Delete  | `apps/ui/src/app/[locale]/auth/strapi-oauth/` (entire directory)                   |
| Delete  | `apps/ui/src/types/better-auth.d.ts`                                               |
| Rewrite | `apps/ui/src/lib/auth-client.ts`                                                   |
| Create  | `apps/ui/src/lib/auth-server.ts`                                                   |
| Update  | `apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx` (magic link tab) |
| Update  | `apps/ui/src/app/[locale]/auth/register/_components/RegisterForm.tsx`              |
| Update  | `apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx`                   |
| Create  | `apps/ui/src/app/[locale]/auth/magic-link-sent/page.tsx`                           |
| Create  | `apps/ui/src/app/[locale]/auth/magic-link/page.tsx`                                |
| Update  | `apps/ui/src/hooks/useUserMutations.ts`                                            |
| Update  | `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts`      |

---

## Success Criteria

- Strapi starts cleanly with the `better-auth` plugin and creates four `ba_*` tables
- `POST {STRAPI_URL}/api/better-auth/sign-in/email` returns a session and sets cookie
- OAuth sign-in via GitHub and Google completes and returns to Next.js with session
- Magic link email is sent (or logged to console); clicking the link creates a session
- Password reset email is sent when requested
- RSC pages can retrieve session via `getSessionSSR()` cookie-forwarding fetch
- Content-moderation submission controller correctly identifies authenticated users via `strapi.betterAuth.api.getSession()`
- No `auth.ts`, `[...all]/route.ts`, `strapi-oauth/` or `better-auth.d.ts` remain in `apps/ui`
- No `BETTER_AUTH_SECRET` in `apps/ui/.env.local`
