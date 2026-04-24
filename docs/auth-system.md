# Auth System — libraries.global

## Overview

Authentication is handled by **Better Auth** (session layer) backed by **Strapi users-permissions** (user store and OAuth). The session is stateless — a JWE-encrypted cookie that includes the Strapi JWT. Every request validates the Strapi JWT server-side.

---

## Sign-in Flow (Credentials)

```mermaid
sequenceDiagram
    participant Browser
    participant BetterAuth as Better Auth (/api/auth/sign-in-strapi)
    participant Strapi as Strapi (/api/auth/local)

    Browser->>BetterAuth: POST {email, password}
    BetterAuth->>Strapi: POST /auth/local {identifier, password}
    Strapi-->>BetterAuth: {jwt, user}
    BetterAuth->>Browser: Set JWE session cookie (includes strapiJWT)
    Browser->>Browser: location.href = callbackUrl
```

## OAuth Flow (GitHub / Google)

```mermaid
sequenceDiagram
    participant Browser
    participant Strapi as Strapi OAuth
    participant BetterAuth as Better Auth (/api/auth/sync-oauth-strapi)

    Browser->>Strapi: GET /api/connect/{provider}
    Strapi->>Provider: Redirect to OAuth consent
    Provider-->>Strapi: Callback with access_token
    Strapi-->>Browser: Redirect to /auth/strapi-oauth/{provider}?access_token=...
    Browser->>BetterAuth: POST {accessToken, provider}
    BetterAuth->>Strapi: GET /auth/{provider}/callback?access_token=...
    Strapi-->>BetterAuth: {jwt, user}
    BetterAuth->>Browser: Set JWE session cookie
    Browser->>Browser: location.href = /{locale}
```

## Registration Flow

```mermaid
sequenceDiagram
    participant Browser
    participant BetterAuth as Better Auth (/api/auth/register-strapi)
    participant Strapi as Strapi (/api/auth/local/register)

    Browser->>BetterAuth: POST {username, email, password}
    BetterAuth->>Strapi: POST /auth/local/register
    Strapi-->>BetterAuth: {jwt, user}
    BetterAuth->>Browser: Set JWE session cookie
    Browser->>Browser: location.href = /
```

## Session Validation on Every Request

```mermaid
sequenceDiagram
    participant RSC as Next.js RSC / API Route
    participant BetterAuth as Better Auth (strapiSessionPlugin)
    participant Strapi as Strapi (/users/me)

    RSC->>BetterAuth: getSession(headers)
    BetterAuth->>Strapi: GET /users/me (Authorization: Bearer strapiJWT)
    alt JWT valid
        Strapi-->>BetterAuth: {id, email, username, blocked, provider}
        BetterAuth-->>RSC: {user, session}
    else JWT expired / blocked
        Strapi-->>BetterAuth: 401 / user.blocked = true
        BetterAuth->>Browser: Clear session cookie
        BetterAuth-->>RSC: {user: null, session: null}
    end
```

## Submission Flow (Authenticated User)

```mermaid
sequenceDiagram
    participant Browser
    participant NextAPI as Next.js (proxies or direct)
    participant StrapiPlugin as Strapi content-moderation plugin
    participant Moderator

    Browser->>StrapiPlugin: POST /api/content-moderation/submissions (JWT cookie)
    StrapiPlugin->>StrapiPlugin: Validate user session (ctx.state.user)
    StrapiPlugin->>StrapiPlugin: Create submission {status: pending}
    StrapiPlugin-->>Browser: {data: submission}
    Moderator->>StrapiPlugin: PATCH /submissions/:id/status {approved/rejected}
    StrapiPlugin-->>Moderator: {data: updated}
```

---

## Strapi User Roles & Permissions

Strapi users-permissions plugin defines these roles. **Set these in Strapi Admin → Settings → Users & Permissions → Roles.**

### Authenticated (default logged-in role)

| Permission                       | Endpoint                                     | Notes                             |
| -------------------------------- | -------------------------------------------- | --------------------------------- |
| Read libraries                   | `GET /api/libraries`                         | browse the atlas                  |
| Read countries / regions / areas | `GET /api/countries`, etc.                   | browse hierarchy                  |
| Create submissions               | `POST /api/content-moderation/submissions`   | submit corrections, claims, edits |
| Read own submissions             | `GET /api/content-moderation/submissions/my` | view submission status            |

### Editor (moderator role — assign manually in Strapi admin)

All Authenticated permissions plus:

| Permission               | Endpoint                                               | Notes                      |
| ------------------------ | ------------------------------------------------------ | -------------------------- |
| Update submission status | `PATCH /api/content-moderation/submissions/:id/status` | approve / reject           |
| Read all submissions     | `GET /api/content-moderation/submissions` (admin)      | moderation dashboard       |
| Update library entries   | `PUT /api/libraries/:id`                               | apply approved corrections |

### Public (unauthenticated)

| Permission               | Endpoint                                               | Notes           |
| ------------------------ | ------------------------------------------------------ | --------------- |
| Read published libraries | `GET /api/libraries`                                   | atlas browsing  |
| Read published locations | `GET /api/countries`, `regions`, `areas`, `continents` |                 |
| Read map pins            | `/api/map/*`                                           | interactive map |

---

## Environment Variables

| Variable                 | Where              | Purpose                                   |
| ------------------------ | ------------------ | ----------------------------------------- |
| `BETTER_AUTH_SECRET`     | `apps/ui/.env`     | Signs the JWE session cookie              |
| `APP_PUBLIC_URL`         | `apps/ui/.env`     | Better Auth base URL                      |
| `STRAPI_URL`             | `apps/ui/.env`     | Private Strapi URL (server-side)          |
| `NEXT_PUBLIC_STRAPI_URL` | `apps/ui/.env`     | Public Strapi URL (client OAuth redirect) |
| `GITHUB_CLIENT_ID`       | `apps/strapi/.env` | GitHub OAuth app                          |
| `GITHUB_CLIENT_SECRET`   | `apps/strapi/.env` | GitHub OAuth app                          |
| `GOOGLE_CLIENT_ID`       | `apps/strapi/.env` | Google OAuth app                          |
| `GOOGLE_CLIENT_SECRET`   | `apps/strapi/.env` | Google OAuth app                          |

---

## Key Files

| File                                                     | Responsibility                         |
| -------------------------------------------------------- | -------------------------------------- |
| `apps/ui/src/lib/auth.ts`                                | Better Auth config, Strapi plugins     |
| `apps/ui/src/lib/auth-client.ts`                         | Client-side auth instance              |
| `apps/ui/src/hooks/useUserMutations.ts`                  | React Query mutations for auth actions |
| `apps/ui/src/hooks/useSubmissions.ts`                    | React Query for submission CRUD        |
| `apps/strapi/src/plugins/content-moderation/`            | Submission content type + API + admin  |
| `apps/ui/src/app/[locale]/auth/signin/`                  | Sign-in page                           |
| `apps/ui/src/app/[locale]/auth/register/`                | Register page                          |
| `apps/ui/src/app/[locale]/auth/strapi-oauth/[provider]/` | OAuth callback handler                 |

---

## Future: Adding More OAuth Providers

To add Apple or Microsoft:

1. Configure the provider in Strapi Admin → Settings → Users & Permissions → Providers
2. Add the provider's OAuth app credentials to `apps/strapi/.env`
3. Add a button in `AuthOAuthButtons.tsx` calling `handleOAuth("apple")` / `handleOAuth("microsoft")`

The Better Auth + Strapi OAuth flow handles all providers identically once Strapi is configured.

---

## Library Claim Process

```mermaid
flowchart TD
    A[User views LibraryDetailPage] --> B{Authenticated?}
    B -- No --> C[Show: Sign in to claim]
    B -- Yes --> D[Show: Claim this library button]
    D --> E[User fills in role / verification note]
    E --> F[POST /api/content-moderation/submissions\ntype: library_claim]
    F --> G[Submission status: pending]
    G --> H[Moderator reviews in Strapi admin]
    H -- Approved --> I[Moderator assigns library relation\nto user in Strapi]
    H -- Rejected --> J[User notified via submission status]
    I --> K[User can now submit data updates\nfor this library]
```
