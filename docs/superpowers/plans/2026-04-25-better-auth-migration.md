# Better Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom Next.js Better Auth + Strapi users-permissions bridge with `@strapi-community/plugin-better-auth`, adding magic link sign-in alongside credentials and OAuth.

**Architecture:** The Strapi plugin becomes the single auth authority — all auth endpoints live at `/api/better-auth/*` on the Strapi origin. Next.js drops its local `auth.ts` instance entirely and becomes a thin consumer via `better-auth/react` client pointing at Strapi. SSR session retrieval forwards the incoming cookie header to Strapi's `get-session` endpoint.

**Tech Stack:** `@strapi-community/plugin-better-auth` (Strapi v5), `better-auth` (client + `magicLink` plugin), Next.js App Router, `@t3-oss/env-nextjs`, Strapi email plugin, Strapi Document Service

---

## File Map

| Action  | File                                                                          |
| ------- | ----------------------------------------------------------------------------- |
| Modify  | `apps/strapi/config/plugins.ts`                                               |
| Modify  | `apps/ui/src/env.mjs`                                                         |
| Delete  | `apps/ui/src/lib/auth.ts`                                                     |
| Delete  | `apps/ui/src/app/api/auth/[...all]/route.ts`                                  |
| Delete  | `apps/ui/src/app/[locale]/auth/strapi-oauth/` (directory)                     |
| Delete  | `apps/ui/src/types/better-auth.d.ts`                                          |
| Rewrite | `apps/ui/src/lib/auth-client.ts`                                              |
| Create  | `apps/ui/src/lib/auth-server.ts`                                              |
| Modify  | `apps/ui/src/hooks/useUserMutations.ts`                                       |
| Modify  | `apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx`              |
| Modify  | `apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx`             |
| Create  | `apps/ui/src/app/[locale]/auth/magic-link-sent/page.tsx`                      |
| Create  | `apps/ui/src/app/[locale]/auth/magic-link/page.tsx`                           |
| Modify  | `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts` |

---

## Task 1: Install Strapi Plugin

**Files:**

- Modify: `apps/strapi/package.json` (via yarn add)

- [ ] **Step 1: Install the package**

```bash
cd apps/strapi
yarn add @strapi-community/plugin-better-auth
```

- [ ] **Step 2: Verify installation**

```bash
grep "@strapi-community/plugin-better-auth" apps/strapi/package.json
```

Expected output: a line like `"@strapi-community/plugin-better-auth": "^x.y.z"`

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/package.json apps/strapi/yarn.lock
git commit -m "chore: install @strapi-community/plugin-better-auth"
```

---

## Task 2: Configure Strapi Plugin

**Files:**

- Modify: `apps/strapi/config/plugins.ts`

The existing `plugins.ts` exports a default function that takes `{ env }`. We add the `better-auth` entry alongside the existing plugins. We also remove the stale `users-permissions` JWT comment (the `expiresIn: "30d"` comment said it was synced with Better Auth session maxAge — no longer relevant as users-permissions is not the auth layer).

The `magicLink` import comes from `better-auth/plugins`. The `global.strapi.plugin("email").provider.send()` call is safe at runtime — the callback only fires when an auth action occurs, at which point Strapi is fully bootstrapped.

For `sendResetPassword`: the `url` parameter Better Auth generates is based on `baseURL` (the Strapi origin). We override it to point to the Next.js reset-password page using `APP_PUBLIC_URL` env var, since that's where the user's browser will submit the new password.

- [ ] **Step 1: Update `apps/strapi/config/plugins.ts`**

Replace the entire file content with the following (preserving all existing plugins, only adding `better-auth` and removing the users-permissions JWT sync comment):

```ts
import { magicLink } from "better-auth/plugins"

export default ({ env }) => {
  const awsS3Config = prepareAwsS3Config(env)
  if (!awsS3Config) {
    console.warn(
      "AWS S3 upload configuration is not complete. Local file storage will be used."
    )
  }

  return {
    upload: {
      config: awsS3Config ?? localUploadConfig,
    },

    "config-sync": {
      enabled: true,
    },

    meilisearch: {
      enabled: true,
      config: {
        host: env("MEILISEARCH_HOST", "http://localhost:7700"),
        apiKey: env("MEILISEARCH_ADMIN_API_KEY", ""),
        library: {
          settings: {
            searchableAttributes: [
              "name",
              "shortName",
              "summary",
              "city",
              "district",
              "country_name",
              "region_name",
            ],
            filterableAttributes: [
              "libraryType",
              "operationalStatus",
              "continent_slug",
              "country_slug",
              "region_slug",
              "featured",
            ],
            sortableAttributes: ["name"],
          },
          // Flatten nested relations so they are searchable/filterable
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            const continent = entry.continent as Record<string, unknown> | null
            const country = entry.country as Record<string, unknown> | null
            const region = entry.region as Record<string, unknown> | null

            return {
              ...entry,
              continent_slug: continent?.slug ?? null,
              continent_name: continent?.name ?? null,
              country_slug: country?.slug ?? null,
              country_name: country?.name ?? null,
              region_slug: region?.slug ?? null,
              region_name: region?.name ?? null,
            }
          },
        },
      },
    },

    seo: {
      enabled: true,
    },

    "users-permissions": {
      config: {
        jwt: {
          expiresIn: "30d",
        },
      },
    },

    sentry: {
      enabled: true,
      config: {
        dsn: env("NODE_ENV") === "production" ? env("SENTRY_DSN") : null,
        sendMetadata: true,
      },
    },

    email: {
      config: prepareEmailConfig(env),
    },

    "content-moderation": {
      enabled: true,
      resolve: "./src/plugins/content-moderation",
    },

    "better-auth": {
      enabled: true,
      config: {
        betterAuthOptions: {
          secret: env("BETTER_AUTH_SECRET"),
          baseURL: env("BETTER_AUTH_BASE_URL"),
          trustedOrigins: [env("APP_PUBLIC_URL")],
          emailAndPassword: {
            enabled: true,
            sendResetPassword: async ({ user, token }) => {
              const nextjsUrl = env("APP_PUBLIC_URL")
              const resetUrl = `${nextjsUrl}/auth/reset-password?token=${encodeURIComponent(token)}`
              await global.strapi.plugin("email").provider.send({
                to: user.email,
                subject: "Reset your libraries.global password",
                html: `<p>Reset your libraries.global password: <a href="${resetUrl}">${resetUrl}</a></p>`,
                text: `Reset your libraries.global password: ${resetUrl}`,
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
                  text: `Sign in to libraries.global: ${url}`,
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
  }
}

const localUploadConfig: Record<string, unknown> = {
  sizeLimit: 250 * 1024 * 1024,
}

const prepareAwsS3Config = (env) => {
  const awsAccessKeyId = env("AWS_ACCESS_KEY_ID")
  const awsAccessSecret = env("AWS_ACCESS_SECRET")
  const awsRegion = env("AWS_REGION")
  const awsBucket = env("AWS_BUCKET")
  const awsRequirements = [
    awsAccessKeyId,
    awsAccessSecret,
    awsRegion,
    awsBucket,
  ]
  const awsRequirementsOk = awsRequirements.every(
    (req) => req != null && req !== ""
  )

  if (awsRequirementsOk) {
    return {
      provider: "aws-s3",
      providerOptions: {
        baseUrl: env("CDN_URL"),
        rootPath: env("CDN_ROOT_PATH"),
        s3Options: {
          credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsAccessSecret,
          },
          region: awsRegion,
          params: {
            ACL: env("AWS_ACL", "public-read"),
            signedUrlExpires: env("AWS_SIGNED_URL_EXPIRES", 15 * 60),
            Bucket: awsBucket,
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    }
  }
}

const prepareEmailConfig = (env) => {
  const hasMailgunCreds = env("MAILGUN_API_KEY") && env("MAILGUN_DOMAIN")
  const hasMailtrapCreds = env("MAILTRAP_USER") && env("MAILTRAP_PASS")

  if (hasMailgunCreds) {
    return {
      provider: "mailgun",
      providerOptions: {
        key: env("MAILGUN_API_KEY"),
        domain: env("MAILGUN_DOMAIN"),
        url: env("MAILGUN_HOST", "https://api.eu.mailgun.net"),
      },
      settings: {
        defaultFrom: env("MAILGUN_EMAIL") || "noreply@example.com",
        defaultReplyTo: env("MAILGUN_EMAIL") || "noreply@example.com",
      },
    }
  }

  if (hasMailtrapCreds) {
    return {
      provider: "nodemailer",
      providerOptions: {
        host: env("MAILTRAP_HOST", "sandbox.smtp.mailtrap.io"),
        port: Number.parseInt(env("MAILTRAP_PORT", "2525"), 10),
        auth: {
          user: env("MAILTRAP_USER"),
          pass: env("MAILTRAP_PASS"),
        },
      },
      settings: {
        defaultFrom: env("MAILTRAP_EMAIL") || "noreply@example.com",
        defaultReplyTo: env("MAILTRAP_EMAIL") || "noreply@example.com",
      },
    }
  }

  console.warn(
    "⚠️  No email provider is configured. Email functionality will not work."
  )

  return null
}
```

- [ ] **Step 2: Add env vars to `apps/strapi/.env`**

Open `apps/strapi/.env` in a text editor and add these entries (fill in actual ngrok values):

```
BETTER_AUTH_SECRET=ba_w3sxgbbfo14351ogc85t0wpcr215z75w
BETTER_AUTH_BASE_URL=https://<STRAPI_NGROK_SUBDOMAIN>.ngrok.io/api/better-auth
APP_PUBLIC_URL=https://<UI_NGROK_SUBDOMAIN>.ngrok.io
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

- [ ] **Step 3: Start Strapi and verify plugin loads**

```bash
cd apps/strapi
yarn develop
```

Expected: Strapi starts without errors. In the startup logs look for `better-auth` in the plugin list. Tables `ba_user`, `ba_session`, `ba_account`, `ba_verification` should be created in the database (check with a SQLite browser or psql if using Postgres).

- [ ] **Step 4: Verify auth endpoint is reachable**

In a separate terminal (Strapi must be running):

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:1337/api/better-auth/get-session
```

Expected: `200` (returns `null` since no session cookie is present — that's correct)

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/config/plugins.ts
git commit -m "feat(strapi): configure @strapi-community/plugin-better-auth with email, OAuth, magic link"
```

---

## Task 3: Add `NEXT_PUBLIC_STRAPI_URL` to Next.js env schema

**Files:**

- Modify: `apps/ui/src/env.mjs`

The Better Auth client runs in the browser and needs the Strapi URL. Currently `STRAPI_URL` is server-only. We add `NEXT_PUBLIC_STRAPI_URL` (public, baked into the client bundle) and remove `BETTER_AUTH_SECRET` from the Next.js env schema entirely — it moves to Strapi.

- [ ] **Step 1: Update `apps/ui/src/env.mjs`**

Make these two changes:

**Remove** from the `server` section:

```ts
BETTER_AUTH_SECRET: z.string().optional(),
```

**Add** to the `client` section (after `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY`):

```ts
NEXT_PUBLIC_STRAPI_URL: z.string().url().optional(),
```

**Remove** from `runtimeEnv`:

```ts
BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
```

**Add** to `runtimeEnv` (client block):

```ts
NEXT_PUBLIC_STRAPI_URL: process.env.NEXT_PUBLIC_STRAPI_URL,
```

The final `client` section in env.mjs should be:

```ts
client: {
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_PREVENT_UNUSED_FUNCTIONS_ERROR_LOGS: optionalZodBoolean(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MEILISEARCH_HOST: z.string().optional(),
  NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY: z.string().optional(),
  NEXT_PUBLIC_STRAPI_URL: z.string().url().optional(),
},
```

- [ ] **Step 2: Add `NEXT_PUBLIC_STRAPI_URL` to `apps/ui/.env.local`**

Open `apps/ui/.env.local` and ensure this entry exists (it should already — same value as `STRAPI_URL`):

```
NEXT_PUBLIC_STRAPI_URL=http://127.0.0.1:1337
```

Also remove `BETTER_AUTH_SECRET` from `apps/ui/.env.local` if it is present.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/ui
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors about `BETTER_AUTH_SECRET` or `NEXT_PUBLIC_STRAPI_URL`.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/env.mjs
git commit -m "feat(ui/env): add NEXT_PUBLIC_STRAPI_URL, remove BETTER_AUTH_SECRET"
```

---

## Task 4: Create `auth-server.ts` (SSR session helper)

**Files:**

- Create: `apps/ui/src/lib/auth-server.ts`

RSC pages and layouts that need auth context call `getSessionSSR()`. It forwards the incoming request's cookie header to Strapi's Better Auth `get-session` endpoint. There is no local Better Auth instance in Next.js anymore.

The return type is a standard Better Auth session object: `{ user: { id, email, name, emailVerified, ... }, session: { id, userId, expiresAt, token, ... } } | null`.

- [ ] **Step 1: Create `apps/ui/src/lib/auth-server.ts`**

```ts
import "server-only"

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers"

export type BetterAuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: string
  updatedAt: string
}

export type BetterAuthSession = {
  id: string
  userId: string
  expiresAt: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type AuthSessionResult = {
  user: BetterAuthUser
  session: BetterAuthSession
} | null

/**
 * Retrieve the current Better Auth session from Strapi's auth endpoint.
 * Forwards the incoming request's cookie so the session cookie is included.
 * Must only be called from Server Components or Route Handlers.
 */
export async function getSessionSSR(
  headers: ReadonlyHeaders
): Promise<AuthSessionResult> {
  const strapiUrl = process.env.STRAPI_URL
  if (!strapiUrl) return null

  try {
    const res = await fetch(`${strapiUrl}/api/better-auth/get-session`, {
      headers: { cookie: headers.get("cookie") ?? "" },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    // Better Auth returns null when no session
    if (!data || !data.user) return null
    return data as AuthSessionResult
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
cd apps/ui
npx tsc --noEmit 2>&1 | grep auth-server
```

Expected: No output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/auth-server.ts
git commit -m "feat(ui/auth): add auth-server.ts with cookie-forwarding getSessionSSR"
```

---

## Task 5: Rewrite `auth-client.ts`

**Files:**

- Rewrite: `apps/ui/src/lib/auth-client.ts`

Replace the entire file. Remove the custom Strapi plugins and the old `getSessionCSR`. The new client points `baseURL` at Strapi and adds the `magicLinkClient()` plugin so `authClient.signIn.magicLink()` is available.

`NEXT_PUBLIC_STRAPI_URL` is available on the client via the env schema we added in Task 3.

- [ ] **Step 1: Rewrite `apps/ui/src/lib/auth-client.ts`**

```ts
import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"

export const authClient = createAuthClient({
  baseURL: `${strapiUrl}/api/better-auth`,
  plugins: [magicLinkClient()],
})
```

- [ ] **Step 2: Check that TypeScript accepts the new file**

```bash
cd apps/ui
npx tsc --noEmit 2>&1 | grep auth-client
```

Expected: No output. (There WILL be errors from other files that still import old symbols — those are fixed in subsequent tasks.)

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/auth-client.ts
git commit -m "feat(ui/auth): rewrite auth-client to point at Strapi Better Auth"
```

---

## Task 6: Update `useUserMutations.ts`

**Files:**

- Modify: `apps/ui/src/hooks/useUserMutations.ts`

Replace all custom Strapi mutations with standard Better Auth client calls:

| Old                                             | New                                                  |
| ----------------------------------------------- | ---------------------------------------------------- |
| `authClient.signInStrapi()`                     | `authClient.signIn.email()`                          |
| `authClient.registerStrapi()`                   | `authClient.signUp.email()`                          |
| `authClient.updatePasswordStrapi()`             | `authClient.changePassword()`                        |
| `authClient.forgotPasswordStrapi()`             | `authClient.forgetPassword()`                        |
| `authClient.resetPasswordStrapi({ code, ... })` | `authClient.resetPassword({ newPassword, token })`   |
| `authClient.syncOauthStrapi()`                  | deleted — OAuth is now handled server-side by Strapi |

`changePassword` in Better Auth takes `{ currentPassword, newPassword, revokeOtherSessions }`.
`forgetPassword` takes `{ email, redirectTo }`.
`resetPassword` takes `{ newPassword, token }` where `token` is extracted from the URL query param.

- [ ] **Step 1: Rewrite `apps/ui/src/hooks/useUserMutations.ts`**

```ts
"use client"

import { useMutation } from "@tanstack/react-query"

import { useCreateSubmission } from "@/hooks/useSubmissions"
import { authClient } from "@/lib/auth-client"

export function useUserMutations() {
  const signInMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: "/",
      })
      return unwrapBetterAuth(result)
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.email,
        callbackURL: "/",
      })
      return unwrapBetterAuth(result)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (values: {
      currentPassword: string
      password: string
      passwordConfirmation: string
    }) => {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.password,
        revokeOtherSessions: false,
      })
      return unwrapBetterAuth(result)
    },
  })

  const forgotPasswordMutation = useMutation({
    mutationFn: async (values: { email: string }) => {
      const result = await authClient.forgetPassword({
        email: values.email,
        redirectTo: "/auth/reset-password",
      })
      return unwrapBetterAuth(result)
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (values: { password: string; token: string }) => {
      const result = await authClient.resetPassword({
        newPassword: values.password,
        token: values.token,
      })
      return unwrapBetterAuth(result)
    },
  })

  const claimLibraryMutation = useCreateSubmission()

  return {
    signInMutation,
    registerMutation,
    changePasswordMutation,
    forgotPasswordMutation,
    resetPasswordMutation,
    claimLibraryMutation,
  }
}

/**
 * Throws if the Better Auth result contains an error, otherwise returns data.
 */
function unwrapBetterAuth<T>(result: {
  data: T | null
  error: unknown | null
}): T {
  if (result.error) {
    throw result.error
  }
  return result.data as T
}
```

- [ ] **Step 2: Update the reset-password form to pass `token` instead of `code`**

The reset-password form at `apps/ui/src/app/[locale]/auth/reset-password/_components/ResetPasswordForm.tsx` currently reads a `code` query param and calls `resetPasswordStrapi({ code, password, passwordConfirmation })`. Update it to read `token` and call `resetPasswordMutation.mutate({ password, token })`.

Open the file and make these changes:

Find the `useSearchParams()` usage (or wherever the code/token is extracted from the URL) and update the param name from `code` to `token`.

Find the mutation call and change from:

```ts
resetPasswordMutation.mutate({ code: token, password, passwordConfirmation })
```

to:

```ts
resetPasswordMutation.mutate({ password, token })
```

Remove `passwordConfirmation` from the mutation call (validation stays in the form schema — the mutation no longer needs it).

- [ ] **Step 3: Check for any remaining references to removed mutations**

```bash
grep -r "signInStrapi\|registerStrapi\|updatePasswordStrapi\|forgotPasswordStrapi\|resetPasswordStrapi\|syncOauthStrapi\|syncOauthStrapiMutation" apps/ui/src --include="*.ts" --include="*.tsx"
```

Expected: No output.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/hooks/useUserMutations.ts apps/ui/src/app/
git commit -m "feat(ui/auth): update useUserMutations to use standard Better Auth client calls"
```

---

## Task 7: Update `AuthOAuthButtons.tsx`

**Files:**

- Modify: `apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx`

Replace the Strapi users-permissions connect redirect with `authClient.signIn.social()`. The `strapiUrl` prop is no longer needed and can be removed from the component signature. The caller (`SignInForm`, `RegisterForm`) passes `strapiUrl` but we just ignore it in this component — cleaning up the prop threading from the pages is a separate concern.

- [ ] **Step 1: Update `apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx`**

```ts
// apps/ui/src/app/[locale]/auth/_components/AuthOAuthButtons.tsx
"use client"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

interface AuthOAuthButtonsProps {
  mode: "signin" | "register"
}

const oauthBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,.04)",
  color: T.ink.dim,
  fontSize: "13px",
  fontFamily: T.font.sans,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 150ms, border-color 150ms",
  textDecoration: "none",
  width: "100%",
} as const

export function AuthOAuthButtons({ mode }: AuthOAuthButtonsProps) {
  const handleOAuth = async (provider: "google" | "github") => {
    await authClient.signIn.social({
      provider,
      callbackURL: "/",
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Google + GitHub row */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}
      >
        <button
          type="button"
          style={oauthBtnStyle}
          className="hover:border-[rgba(255,255,255,.24)] hover:bg-[rgba(255,255,255,.08)]"
          onClick={() => handleOAuth("google")}
        >
          {/* Google icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>

        <button
          type="button"
          style={oauthBtnStyle}
          className="hover:border-[rgba(255,255,255,.24)] hover:bg-[rgba(255,255,255,.08)]"
          onClick={() => handleOAuth("github")}
        >
          {/* GitHub icon */}
          <svg
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          GitHub
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          margin: "4px 0",
        }}
      >
        <span
          style={{
            flex: 1,
            height: "1px",
            background: T.border.line,
            display: "block",
          }}
        />
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {mode === "signin" ? "or with email" : "or register with email"}
        </span>
        <span
          style={{
            flex: 1,
            height: "1px",
            background: T.border.line,
            display: "block",
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update callers to remove `strapiUrl` prop**

`SignInForm.tsx` passes `<AuthOAuthButtons strapiUrl={strapiUrl} mode="signin" />`. Remove the `strapiUrl` prop from both the `AuthOAuthButtons` call in `SignInForm.tsx` and `RegisterForm.tsx`, and remove the `strapiUrl` parameter from their own function signatures if it is used only to thread into `AuthOAuthButtons`.

In `apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx`:

- Remove `{ strapiUrl }: { strapiUrl?: string }` from function signatures
- Change `<AuthOAuthButtons strapiUrl={strapiUrl} mode="signin" />` to `<AuthOAuthButtons mode="signin" />`

In `apps/ui/src/app/[locale]/auth/register/_components/RegisterForm.tsx`:

- Remove `{ strapiUrl }: { strapiUrl?: string }` from function signature
- Change `<AuthOAuthButtons strapiUrl={strapiUrl} mode="register" />` to `<AuthOAuthButtons mode="register" />`

Then find the page components that render these forms and remove `strapiUrl` from the props they pass:

```bash
grep -r "strapiUrl" apps/ui/src --include="*.tsx" -l
```

For each file found, remove the `strapiUrl` prop from component props and the variable that holds the Strapi URL (if it was only used for OAuth).

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/
git commit -m "feat(ui/auth): update AuthOAuthButtons to use authClient.signIn.social"
```

---

## Task 8: Update `SignInForm.tsx` — add magic link tab

**Files:**

- Modify: `apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx`

Add a two-tab layout: "Password" and "Magic Link". The magic link tab shows only an email field. On submit it calls `authClient.signIn.magicLink({ email, callbackURL: "/auth/magic-link-sent" })` and then redirects to the magic-link-sent confirmation page.

The password tab is the existing form content (already cleaned up of `strapiUrl` in Task 7).

- [ ] **Step 1: Rewrite `apps/ui/src/app/[locale]/auth/signin/_components/SignInForm.tsx`**

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { AuthLeftPanel } from "@/app/[locale]/auth/_components/AuthLeftPanel"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import GlobalLink from "@/components/global/GlobalLink"
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { useUserMutations } from "@/hooks/useUserMutations"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,.04)",
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.mono,
  fontSize: "9px",
  letterSpacing: ".18em",
  textTransform: "uppercase" as const,
  color: T.ink.low,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "6px",
}

const PasswordFormSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
})

const MagicLinkFormSchema = z.object({
  email: z.string().min(1).email(),
})

export function SignInForm() {
  return (
    <UseSearchParamsWrapper>
      <SuspensedSignInForm />
    </UseSearchParamsWrapper>
  )
}

function SuspensedSignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const { signInMutation } = useUserMutations()
  const [tab, setTab] = useState<"password" | "magic">("password")
  const [magicLinkPending, setMagicLinkPending] = useState(false)

  const passwordForm = useForm<z.infer<typeof PasswordFormSchema>>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { email: "", password: "" },
  })

  const magicLinkForm = useForm<z.infer<typeof MagicLinkFormSchema>>({
    resolver: zodResolver(MagicLinkFormSchema),
    defaultValues: { email: "" },
  })

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    signInMutation.mutate(values, {
      onSuccess: () => {
        globalThis.location.href = callbackUrl
      },
      onError: (error) => {
        const msg = (error as { message?: string })?.message ?? "Sign in failed"
        const display = msg.includes("identifier or password")
          ? "Incorrect email or password."
          : msg
        toast.error(display)
      },
    })
  })

  const onMagicLinkSubmit = magicLinkForm.handleSubmit(async (values) => {
    setMagicLinkPending(true)
    try {
      const result = await authClient.signIn.magicLink({
        email: values.email,
        callbackURL: callbackUrl,
      })
      if (result.error) {
        toast.error(result.error.message ?? "Failed to send magic link")
        return
      }
      globalThis.location.href = "/auth/magic-link-sent"
    } catch {
      toast.error("Failed to send magic link. Please try again.")
    } finally {
      setMagicLinkPending(false)
    }
  })

  const tabBtnStyle = (active: boolean) => ({
    flex: 1,
    padding: "8px",
    borderRadius: "8px",
    border: "none",
    background: active ? "rgba(255,255,255,.08)" : "transparent",
    color: active ? T.ink.base : T.ink.faint,
    fontFamily: T.font.mono,
    fontSize: "9px",
    letterSpacing: ".16em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    transition: "background 150ms, color 150ms",
  })

  return (
    <>
      <AuthLeftPanel mode="signin" />

      {/* Right panel */}
      <div
        className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16"
        style={{ background: "#050816" }}
      >
        {/* Top nav */}
        <div className="mb-10 flex items-center justify-between">
          <GlobalLink
            href="/"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            className="transition-colors hover:text-white"
          >
            ← Back to atlas
          </GlobalLink>
          <GlobalLink
            href="/auth/register"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              textDecoration: "none",
            }}
            className="transition-colors hover:text-white"
          >
            New here?{" "}
            <span style={{ color: T.accent.aurora }}>Create account</span>
          </GlobalLink>
        </div>

        <div style={{ maxWidth: "380px", width: "100%", margin: "0 auto" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
              marginBottom: "12px",
            }}
          >
            § 01 · Authentication
          </p>

          {/* Heading */}
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2rem,4vw,2.8rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: T.ink.base,
              margin: "0 0 8px",
            }}
          >
            Welcome <em style={{ fontStyle: "italic" }}>back.</em>
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: T.ink.low,
              marginBottom: "28px",
              fontWeight: 300,
              lineHeight: "1.6",
            }}
          >
            Sign in to continue contributing to the global library index.
          </p>

          {/* OAuth */}
          <AuthOAuthButtons mode="signin" />

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "4px",
              borderRadius: "10px",
              background: "rgba(255,255,255,.04)",
              border: `1px solid ${T.border.line}`,
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              style={tabBtnStyle(tab === "password")}
              onClick={() => setTab("password")}
            >
              Password
            </button>
            <button
              type="button"
              style={tabBtnStyle(tab === "magic")}
              onClick={() => setTab("magic")}
            >
              Magic Link
            </button>
          </div>

          {/* Password tab */}
          {tab === "password" && (
            <form
              onSubmit={onPasswordSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={labelStyle} htmlFor="email">
                  <span>Email address</span>
                  <span style={{ color: T.accent.aurora, fontSize: "9px" }}>
                    *
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@library.org"
                  style={inputStyle}
                  className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                  {...passwordForm.register("email")}
                />
                {passwordForm.formState.errors.email && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: T.accent.danger,
                      marginTop: "4px",
                    }}
                  >
                    {passwordForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle} htmlFor="password">
                  <span>Password</span>
                  <GlobalLink
                    href="/auth/forgot-password"
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                      textDecoration: "none",
                    }}
                    className="transition-colors hover:text-[#7fdfff]"
                  >
                    Forgot?
                  </GlobalLink>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  style={inputStyle}
                  className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: T.accent.danger,
                      marginTop: "4px",
                    }}
                  >
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  signInMutation.isPending ||
                  passwordForm.formState.isSubmitting
                }
                style={{
                  marginTop: "6px",
                  width: "100%",
                  padding: "13px",
                  borderRadius: "10px",
                  background: T.ink.base,
                  color: "#030511",
                  fontFamily: T.font.sans,
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "opacity 150ms",
                  opacity:
                    signInMutation.isPending ||
                    passwordForm.formState.isSubmitting
                      ? 0.6
                      : 1,
                }}
              >
                {signInMutation.isPending ? "Signing in…" : "Sign in →"}
              </button>
            </form>
          )}

          {/* Magic link tab */}
          {tab === "magic" && (
            <form
              onSubmit={onMagicLinkSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={labelStyle} htmlFor="magic-email">
                  <span>Email address</span>
                  <span style={{ color: T.accent.aurora, fontSize: "9px" }}>
                    *
                  </span>
                </label>
                <input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@library.org"
                  style={inputStyle}
                  className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                  {...magicLinkForm.register("email")}
                />
                {magicLinkForm.formState.errors.email && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: T.accent.danger,
                      marginTop: "4px",
                    }}
                  >
                    {magicLinkForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <p
                style={{
                  fontSize: "12px",
                  color: T.ink.faint,
                  lineHeight: "1.6",
                  margin: "0",
                }}
              >
                We&apos;ll send a one-time sign-in link to your inbox. No
                password required.
              </p>

              <button
                type="submit"
                disabled={magicLinkPending}
                style={{
                  marginTop: "6px",
                  width: "100%",
                  padding: "13px",
                  borderRadius: "10px",
                  background: T.ink.base,
                  color: "#030511",
                  fontFamily: T.font.sans,
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "opacity 150ms",
                  opacity: magicLinkPending ? 0.6 : 1,
                }}
              >
                {magicLinkPending ? "Sending link…" : "Send sign-in link →"}
              </button>
            </form>
          )}

          <p
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "13px",
              color: T.ink.faint,
            }}
          >
            Don&apos;t have an account?{" "}
            <GlobalLink
              href="/auth/register"
              style={{ color: T.accent.aurora, textDecoration: "none" }}
              className="hover:underline"
            >
              Create one — it&apos;s free
            </GlobalLink>
          </p>

          {/* Footer */}
          <div
            style={{
              marginTop: "40px",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.ghost,
            }}
          >
            <span>Secured by TLS 1.3</span>
            <div style={{ display: "flex", gap: "12px" }}>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors in SignInForm**

```bash
cd apps/ui
npx tsc --noEmit 2>&1 | grep SignInForm
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/
git commit -m "feat(ui/auth): add magic link tab to SignInForm"
```

---

## Task 9: Create magic-link-sent page

**Files:**

- Create: `apps/ui/src/app/[locale]/auth/magic-link-sent/page.tsx`

Simple confirmation page shown after a magic link is sent. Matches the atlas dark aesthetic.

- [ ] **Step 1: Create `apps/ui/src/app/[locale]/auth/magic-link-sent/page.tsx`**

```tsx
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export default async function MagicLinkSentPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: T.ink.faint,
          marginBottom: "16px",
        }}
      >
        § 02 · Check your inbox
      </p>

      <h1
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(2.5rem,6vw,4rem)",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: T.ink.base,
          margin: "0 0 16px",
          maxWidth: "18ch",
        }}
      >
        Link <em style={{ fontStyle: "italic" }}>sent.</em>
      </h1>

      <p
        style={{
          fontSize: "15px",
          color: T.ink.dim,
          lineHeight: "1.7",
          maxWidth: "38ch",
          marginBottom: "32px",
          fontWeight: 300,
        }}
      >
        We&apos;ve emailed you a sign-in link. Click it to access your account —
        it expires in 10 minutes.
      </p>

      <GlobalLink
        href="/auth/signin"
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
          textDecoration: "none",
        }}
        className="transition-colors hover:text-white"
      >
        ← Back to sign in
      </GlobalLink>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/
git commit -m "feat(ui/auth): add magic-link-sent confirmation page"
```

---

## Task 10: Create magic-link verification page

**Files:**

- Create: `apps/ui/src/app/[locale]/auth/magic-link/page.tsx`

When the user clicks the magic link in their email, the browser goes to the Strapi endpoint `{STRAPI_URL}/api/better-auth/magic-link/verify?token=...&callbackURL=/`. Strapi verifies the token, sets the session cookie, and redirects to the `callbackURL` on Next.js.

The `callbackURL` we pass in the `authClient.signIn.magicLink()` call in Task 8 is `callbackUrl` (the original redirect destination, e.g. `/`). So the magic link verification is fully handled by Strapi and Next.js just receives the user already authenticated.

However, if the magic link token is invalid or expired, Strapi may redirect to an error URL. We add a `/auth/magic-link` page as a landing spot for direct token verification scenarios and to display a friendly error state.

- [ ] **Step 1: Create `apps/ui/src/app/[locale]/auth/magic-link/page.tsx`**

```tsx
"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

export default function MagicLinkPage() {
  return (
    <UseSearchParamsWrapper>
      <MagicLinkVerify />
    </UseSearchParamsWrapper>
  )
}

function MagicLinkVerify() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const callbackURL = searchParams.get("callbackURL") ?? "/"
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying"
  )
  const [errorMsg, setErrorMsg] = useState<string>("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setErrorMsg("No token provided.")
      return
    }

    authClient.magicLink
      .verify({ query: { token, callbackURL } })
      .then((result) => {
        if (result?.error) {
          setStatus("error")
          setErrorMsg(result.error.message ?? "Verification failed.")
        } else {
          setStatus("success")
          globalThis.location.href = callbackURL
        }
      })
      .catch(() => {
        setStatus("error")
        setErrorMsg("An unexpected error occurred.")
      })
  }, [token, callbackURL])

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      {status === "verifying" && (
        <>
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
              marginBottom: "16px",
            }}
          >
            § 02 · Verifying
          </p>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2rem,5vw,3.5rem)",
              fontWeight: 400,
              color: T.ink.base,
              margin: "0 0 12px",
            }}
          >
            Signing you <em style={{ fontStyle: "italic" }}>in…</em>
          </h1>
          <p style={{ fontSize: "14px", color: T.ink.faint }}>
            Verifying your magic link, one moment.
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2rem,5vw,3.5rem)",
              fontWeight: 400,
              color: T.ink.base,
              margin: "0 0 12px",
            }}
          >
            <em style={{ fontStyle: "italic" }}>Welcome.</em>
          </h1>
          <p style={{ fontSize: "14px", color: T.ink.faint }}>
            Redirecting you now…
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.accent.danger,
              marginBottom: "16px",
            }}
          >
            § Error
          </p>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2rem,5vw,3.5rem)",
              fontWeight: 400,
              color: T.ink.base,
              margin: "0 0 12px",
            }}
          >
            Link <em style={{ fontStyle: "italic" }}>expired.</em>
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: T.ink.dim,
              marginBottom: "24px",
              maxWidth: "38ch",
            }}
          >
            {errorMsg || "This link is no longer valid. Request a new one."}
          </p>
          <GlobalLink
            href="/auth/signin"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
            }}
          >
            Back to sign in →
          </GlobalLink>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/
git commit -m "feat(ui/auth): add magic-link verification page"
```

---

## Task 11: Delete old Next.js auth files

**Files:**

- Delete: `apps/ui/src/lib/auth.ts`
- Delete: `apps/ui/src/app/api/auth/[...all]/route.ts`
- Delete: `apps/ui/src/app/[locale]/auth/strapi-oauth/` (directory)
- Delete: `apps/ui/src/types/better-auth.d.ts`

Before deleting, ensure nothing still imports from these files.

- [ ] **Step 1: Check for remaining imports**

```bash
grep -r "from.*@/lib/auth\"" apps/ui/src --include="*.ts" --include="*.tsx"
grep -r "from.*@/types/better-auth" apps/ui/src --include="*.ts" --include="*.tsx"
```

Expected: No output. If there are still references, fix them before proceeding.

- [ ] **Step 2: Delete the files**

```bash
rm apps/ui/src/lib/auth.ts
rm apps/ui/src/app/api/auth/\[...all\]/route.ts
rm -rf "apps/ui/src/app/[locale]/auth/strapi-oauth"
rm apps/ui/src/types/better-auth.d.ts
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd apps/ui
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to deleted files or missing imports.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(ui/auth): delete legacy Next.js auth server, API route, strapi-oauth callback, and types"
```

---

## Task 12: Update content-moderation submission controller

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts`

The current controller reads `ctx.state?.user` (users-permissions pattern). With Better Auth on Strapi, the authenticated session is retrieved via `strapi.betterAuth.api.getSession({ headers: ctx.request.headers })`. The session user shape is `{ id, email, name, emailVerified }` — no `username` field, so we use `name` as the fallback display name.

- [ ] **Step 1: Rewrite `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts`**

```ts
export default ({ strapi }: { strapi: any }) => ({
  // POST /api/content-moderation/submissions
  async create(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    const user = session?.user
    if (!user) {
      return ctx.unauthorized("You must be signed in to submit.")
    }

    const {
      submissionType,
      targetEntityType,
      targetDocumentId,
      targetSlug,
      fields,
      note,
    } = ctx.request.body as Record<string, unknown>

    if (!submissionType) {
      return ctx.badRequest("submissionType is required")
    }

    const submission = await strapi
      .plugin("content-moderation")
      .service("submission")
      .create({
        submissionType,
        targetEntityType,
        targetDocumentId,
        targetSlug,
        fields,
        note,
        submittedByUserId: String(user.id),
        submittedByEmail: user.email,
        submittedByName: user.name ?? user.email,
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/my
  async findMine(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    const user = session?.user
    if (!user) {
      return ctx.unauthorized("You must be signed in.")
    }

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(String(user.id))

    ctx.body = { data: submissions }
  },

  // PATCH /api/content-moderation/submissions/:id/status  (admin only)
  async updateStatus(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    const user = session?.user
    // For admin-only operations, check role via Strapi admin or a custom flag.
    // Since Better Auth users are separate from Strapi admin users, we use
    // a simple approach: check for a role field if the plugin adds one,
    // otherwise gate by whether the user is in the ba_user table with admin role.
    // TODO: Implement proper admin role check once roles are configured in Better Auth.
    if (!user) {
      return ctx.forbidden("Moderator access required.")
    }

    const { id } = ctx.params
    const { status, reviewNote } = ctx.request.body as {
      status: string
      reviewNote?: string
    }

    const updated = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, String(user.id), reviewNote)

    ctx.body = { data: updated }
  },
})
```

- [ ] **Step 2: Verify Strapi TypeScript compiles**

```bash
cd apps/strapi
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors from the submission controller.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts
git commit -m "feat(strapi/moderation): replace users-permissions session with strapi.betterAuth.api.getSession"
```

---

## Task 13: End-to-End Verification

No code changes — manual verification that all auth flows work.

- [ ] **Step 1: Start Strapi with valid env vars**

```bash
cd apps/strapi
yarn develop
```

Confirm in logs: `[better-auth] plugin initialized` (or similar). Confirm no startup errors.

- [ ] **Step 2: Test email + password sign-up**

```bash
curl -s -X POST http://127.0.0.1:1337/api/better-auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User"}' | jq .
```

Expected: JSON with `user` object including `id`, `email`, `emailVerified: false`.

- [ ] **Step 3: Test email + password sign-in**

```bash
curl -s -c /tmp/ba-cookies.txt -X POST http://127.0.0.1:1337/api/better-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | jq .
```

Expected: JSON with `user` and `session`. Cookie saved to `/tmp/ba-cookies.txt`.

- [ ] **Step 4: Test session retrieval**

```bash
curl -s -b /tmp/ba-cookies.txt http://127.0.0.1:1337/api/better-auth/get-session | jq .
```

Expected: JSON with `user.email === "test@example.com"` and `session.token`.

- [ ] **Step 5: Start Next.js and open sign-in page in browser**

```bash
cd apps/ui
yarn dev
```

Open `http://localhost:3000/auth/signin`. Verify:

- The split-screen layout renders (AuthLeftPanel on left, form on right)
- The "Password" / "Magic Link" tab switcher is visible
- Entering credentials and clicking "Sign in" triggers a request to `http://127.0.0.1:1337/api/better-auth/sign-in/email` (check browser Network tab)
- Successful sign-in redirects to `/`

- [ ] **Step 6: Test magic link tab**

Switch to "Magic Link" tab in the sign-in form. Enter `test@example.com`. Click "Send sign-in link →". Verify redirect to `/auth/magic-link-sent`. Check Strapi terminal logs — if no email provider is configured, Strapi will log a warning. If email is configured, an email is sent.

- [ ] **Step 7: Test OAuth button (ngrok required)**

> Skip this step if ngrok is not running. OAuth requires the Strapi callback URL to be reachable from GitHub/Google.

Click "GitHub" button. Verify redirect to GitHub OAuth page. Complete sign-in. Verify redirect back to Next.js `/` with session established.

- [ ] **Step 8: Commit verification notes**

```bash
git commit --allow-empty -m "chore: end-to-end auth verification passed"
```

---

## Setup Checklist (non-code, one-time)

These must be completed before OAuth works:

**GitHub OAuth App**

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Edit your app (or create one):
   - Homepage URL: `https://<UI_NGROK>.ngrok.io`
   - Callback URL: `https://<STRAPI_NGROK>.ngrok.io/api/better-auth/callback/github`
3. Add Client ID and Secret to `apps/strapi/.env` as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

**Google OAuth App**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID:
   - Authorized origins: `https://<STRAPI_NGROK>.ngrok.io`
   - Redirect URIs: `https://<STRAPI_NGROK>.ngrok.io/api/better-auth/callback/google`
3. Add Client ID and Secret to `apps/strapi/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

**ngrok**

```bash
# Two terminals:
ngrok http 1337   # → STRAPI_NGROK subdomain
ngrok http 3000   # → UI_NGROK subdomain
```

Update `apps/strapi/.env`:

```
BETTER_AUTH_BASE_URL=https://<STRAPI_NGROK>.ngrok.io/api/better-auth
APP_PUBLIC_URL=https://<UI_NGROK>.ngrok.io
```

Update `apps/ui/.env.local`:

```
NEXT_PUBLIC_STRAPI_URL=https://<STRAPI_NGROK>.ngrok.io
```
