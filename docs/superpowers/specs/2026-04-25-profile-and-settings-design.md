# Profile & Settings — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the public contributor profile page and authenticated settings pages, backed by a new `user-profile` Strapi content type linked to Better Auth.

**Architecture:** A separate `user-profile` Strapi content type holds all extended profile data, linked to `ba_user` by `baUserId`. The public profile page lives at `/contributors/[username]`. Settings are split across sub-routes under `/settings/*`, each with isolated save behaviour. Mutations flow through Next.js API routes that verify the session before touching data.

**Tech Stack:** Next.js 15 App Router, Better Auth (Strapi plugin), Strapi v5, TypeScript, Tailwind CSS v4, design tokens (`T`), existing DS components.

---

## Scope note — future subsystems

This spec covers **Spec A: Profile & Settings** only. Subsequent specs will cover:

- **Spec B:** Social layer — follow users, favourite/save libraries
- **Spec C:** Contribution engine — add/edit libraries, moderation submissions
- **Spec D:** Editorial contributions — blog and wiki authoring

Contribution stats, activity graph, recent contributions, collections, and badges are all **present as zero-state/placeholder UI** in this spec with `// TODO: Spec C` markers. They are not wired to real data.

---

## Data Model

### `user-profile` Strapi content type

- `draftAndPublish: false` — no publishing workflow needed
- `i18n: false` — profile data is not localised
- Auto-created by a Strapi lifecycle hook after Better Auth registers a new `ba_user`

| Field                     | Strapi type                       | Constraints                             | Notes                                                                                                                                                                       |
| ------------------------- | --------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baUserId`                | string                            | unique, required                        | FK into `ba_user.id` (Better Auth UUID)                                                                                                                                     |
| `username`                | string                            | unique, required                        | Slug-safe handle, e.g. `amelie`. Auto-generated from name on sign-up, user-editable                                                                                         |
| `firstName`               | string                            | —                                       | Synced from `ba_user.name` split on first sign-up                                                                                                                           |
| `lastName`                | string                            | —                                       | —                                                                                                                                                                           |
| `bio`                     | text                              | max 300 chars                           | Shown on public profile                                                                                                                                                     |
| `affiliation`             | string                            | —                                       | Organisation/institution name                                                                                                                                               |
| `jobRole`                 | string                            | —                                       | Job title                                                                                                                                                                   |
| `country`                 | relation → `api::country.country` | manyToOne                               | Powers country picker dropdown                                                                                                                                              |
| `timezone`                | string                            | —                                       | IANA timezone string, e.g. `Europe/Paris`. Auto-suggested from country, user-editable                                                                                       |
| `website`                 | string                            | —                                       | Full URL                                                                                                                                                                    |
| `notificationPreferences` | JSON                              | —                                       | `{ weeklyDigest: bool, editsReviewed: bool, newFollowers: bool, editorialBoard: bool, soundOn: bool, marketing: bool }` — all default `false` except `editorialBoard: true` |
| `profileVisibility`       | enum                              | `public` \| `private`, default `public` | Private profiles show minimal info to non-owners                                                                                                                            |
| `verifiedLibrarian`       | boolean                           | default `false`                         | Admin-set only; shown as badge on profile                                                                                                                                   |

**Avatar:** stored in `ba_user.image` (Better Auth). Updated via the Better Auth `update-user` endpoint, not Strapi upload. No separate media field on `user-profile`.

### Username generation

On sign-up, auto-generate username from `ba_user.name`:

1. Lowercase, replace spaces with nothing, strip non-alphanumeric: `Amelie Rault` → `amelierault`
2. If taken, append a 4-digit random suffix: `amelierault4821`
3. Store on `user-profile.username`

---

## Routes & Page Structure

### Public profile

| Route                               | Access | Page                                                                                                                                  |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/[locale]/contributors/[username]` | Anyone | Public profile. If `profileVisibility === "private"` and viewer is not the owner, show minimal view (name, avatar, member since only) |

Breadcrumb: `ATLAS > CONTRIBUTORS > {displayName}`

### Settings (all auth-required — redirect to `/auth/signin` if unauthenticated)

| Route                              | Purpose                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `/[locale]/settings`               | Redirects to `/settings/profile`                                  |
| `/[locale]/settings/profile`       | Avatar + public profile fields                                    |
| `/[locale]/settings/account`       | Name, email, username                                             |
| `/[locale]/settings/notifications` | Notification preference toggles                                   |
| `/[locale]/settings/security`      | Active sessions, change password; 2FA + passkeys as "coming soon" |
| `/[locale]/settings/privacy`       | Coming soon placeholder                                           |
| `/[locale]/settings/connections`   | OAuth connected accounts (connect/disconnect)                     |
| `/[locale]/settings/api-tokens`    | Coming soon placeholder                                           |
| `/[locale]/settings/danger`        | Export data, deactivate account, delete account                   |

---

## Backend — Strapi

### `user-profile` content type

**Schema** (`apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`):
Full field list as per data model above. `draftAndPublish: false`, `i18n: false`.

**Routes** (`apps/strapi/src/api/user-profile/routes/user-profile.ts`):

| Method  | Path                                       | Auth                       | Purpose                                                                                                |
| ------- | ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/user-profiles/by-username/:username` | Public                     | Fetch profile for public profile page. Returns safe fields only (no email, no `baUserId` in response). |
| `GET`   | `/api/user-profiles/me`                    | Better Auth session cookie | Fetch the current user's own profile                                                                   |
| `PATCH` | `/api/user-profiles/me`                    | Better Auth session cookie | Update the current user's own profile                                                                  |

No admin-panel CRUD routes exposed publicly. Standard Strapi admin access remains for editorial use.

**Controller** (`apps/strapi/src/api/user-profile/controllers/user-profile.ts`):

- `findByUsername`: query by `username`, populate `country` relation, strip internal fields (`baUserId`) from response
- `findMe`: read `baUserId` from Better Auth session (via `strapi.betterAuth.api.getSession`), return own profile
- `updateMe`: verify session, update only allowed fields (not `verifiedLibrarian`, not `baUserId`)

**Lifecycle hook** (`apps/strapi/src/extensions/better-auth/strapi-server.ts` or via a custom bootstrap):
After `ba_user` creation (triggered by sign-up or first OAuth), create a `user-profile` row:

- `baUserId` = new user's BA id
- `username` = generated from name (see username generation above)
- `firstName` / `lastName` = split from `ba_user.name`
- All other fields empty/default

This hook must fire for **both** sign-up paths:

- **Email/password sign-up** — fires immediately on account creation
- **First-time OAuth sign-in** — OAuth users have no sign-up event; the hook must check whether a `user-profile` already exists for the `baUserId` before creating one, so it can safely run on every sign-in without creating duplicates

Implementation: wrap the Better Auth `after:signUp` and `after:signIn` events (or poll in bootstrap). On each auth event, call `strapi.documents('api::user-profile.user-profile').findMany({ filters: { baUserId } })` — create only if the result is empty.

### Public field exposure

The `GET /by-username/:username` response includes:

- `username`, `firstName`, `lastName`, `bio`, `affiliation`, `jobRole`, `website`, `timezone`, `profileVisibility`, `verifiedLibrarian`
- `country` (populated: `name`, `iso2`, `slug`)
- Does **not** include: `baUserId`, `notificationPreferences`, `profileVisibility` value leaking private emails

The companion safe-public `ba_user` fields (name, image, createdAt) are returned by a separate lightweight endpoint or merged server-side in the Next.js page before render.

---

## Frontend — Next.js

### Data fetching helpers (`apps/ui/src/lib/strapi-api/content/server.ts`)

```ts
getUserProfileByUsername(username: string): Promise<UserProfile | null>
getMyUserProfile(sessionCookie: string): Promise<UserProfile | null>
```

### Next.js API routes (`apps/ui/src/app/api/profile/`)

All routes read the session via `getSessionSSR` and reject unauthenticated requests with 401.

| Route                               | Method   | Purpose                                                             |
| ----------------------------------- | -------- | ------------------------------------------------------------------- |
| `update/route.ts`                   | `PATCH`  | Update `user-profile` fields in Strapi (profile + account sections) |
| `avatar/route.ts`                   | `PATCH`  | Update `ba_user.image` via Better Auth `update-user`                |
| `sessions/route.ts`                 | `GET`    | List active sessions from Better Auth                               |
| `sessions/route.ts`                 | `DELETE` | Sign out all other sessions                                         |
| `sessions/[id]/route.ts`            | `DELETE` | Revoke single session by token                                      |
| `connections/route.ts`              | `GET`    | List linked OAuth accounts from Better Auth                         |
| `connections/[providerId]/route.ts` | `DELETE` | Unlink OAuth account                                                |

### Public profile page (`app/[locale]/contributors/[username]/`)

**`page.tsx`** — RSC:

1. `getUserProfileByUsername(username)` — 404 if not found
2. Fetch `ba_user` public fields (name, image, createdAt) from Strapi custom endpoint by `baUserId`
3. If `profileVisibility === "private"` and viewer ≠ owner, render `PrivateProfileView`
4. Otherwise render `ProfileHero` + `ProfileTabNav` + tab content

**Components:**

| Component                    | Responsibility                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProfileHero`                | Avatar, full name, `@username`, verified badge, bio, affiliation, website link, Follow + Message buttons (Follow = TODO Spec B, Message = TODO), share button |
| `ProfileTabNav`              | Tab links: Overview, Contributions, Following, Collections, Badges, Activity. Shows counts (all zero/empty for MVP)                                           |
| `ProfileOverviewTab`         | Composes stats grid, activity graph, recent contributions, following libraries                                                                                |
| `ProfileStatsGrid`           | Four stat cells: Contributions (0), Libraries Indexed (0), Reputation (—), Streak (0 days). Zeroed with `// TODO: Spec C`                                     |
| `ProfileActivityGraph`       | Empty heatmap grid (182 days × 7 rows). Renders grid structure with all cells at zero opacity. `// TODO: Spec C — wire contribution data`                     |
| `ProfileRecentContributions` | Empty state: "No contributions yet". `// TODO: Spec C`                                                                                                        |
| `ProfileFollowingLibraries`  | Empty state: "Not following any libraries yet". `// TODO: Spec B`                                                                                             |
| `ProfileFactsSidebar`        | Location (flag + country name), Affiliation, Role, Member Since (from `ba_user.createdAt`), Timezone, rendered as mono-label + value rows                     |
| `ProfileBadgesSidebar`       | Empty state: "No badges earned yet". `// TODO: Spec C`                                                                                                        |
| `ProfileLinksSidebar`        | Website, renders links array from `website` field. `// TODO: add ORCID, GitHub, institutional email fields in Spec B`                                         |

Other tabs (Contributions, Following, Collections, Badges, Activity) render a consistent empty state component.

### Settings shell (`app/[locale]/settings/layout.tsx`)

- Server component: calls `getSessionSSR`. If no session, `redirect('/auth/signin')`
- Renders `SettingsSidebar` + `{children}`
- Sidebar items: Profile, Account, Notifications, Security, Privacy _(coming soon)_, Connections, API Tokens _(coming soon)_, Danger zone
- Page title: "Account settings." (serif italic suffix matching the mockup)

### Settings sections

**Profile (`settings/profile/page.tsx`)**

- Avatar: circular display with "Upload new photo" + "Remove" buttons. Upload proxies via `/api/profile/avatar`.
- Fields: First name, Last name, Username (with `@` preview), Bio (char counter at 300), Affiliation, Role, Country (dropdown from Strapi countries list), Timezone (IANA timezone select, filtered/suggested by country), Website
- Save / Discard buttons. Optimistic update pattern.

**Account (`settings/account/page.tsx`)**

- Name, email (read-only — email changes require re-verification, out of scope for MVP — shown with "Contact support to change" note), username

**Notifications (`settings/notifications/page.tsx`)**

- Toggle list matching mockup sections:
  - **Email:** Weekly digest, Edits reviewed, New followers, Editorial-board messages
  - **In-product:** Sound on new notifications, Marketing emails
- Each toggle fires `PATCH /api/profile/update` immediately (no save button)

**Security (`settings/security/page.tsx`)**

- **Two-factor authentication** — "Coming soon" pill badge, toggle disabled
- **Passkeys** — "Coming soon" pill badge, toggle disabled
- **Active sessions** — list fetched from `/api/profile/sessions`. Each session shows: device icon, browser/OS, IP, last active, "This device" badge on current session. Revoke button per non-current session.
- **Actions:** "Sign out all other sessions" button, "Change password" button (links to `/auth/change-password`)

**Connections (`settings/connections/page.tsx`)**

- Lists all Better Auth OAuth accounts from `/api/profile/connections`
- Each row: provider icon, provider name, connected email/username, "Connected X ago", Disconnect button
- Unconnected providers show a Connect button
- Providers: Google, GitHub (expandable to more in future)
- Guard: cannot disconnect the last provider if no password is set (show warning)

**Danger zone (`settings/danger/page.tsx`)**

- **Export my data** — "Request export" button. MVP: shows a toast "Export requested — you'll receive an email when ready". Actual export is a `// TODO` backend job.
- **Deactivate account** — confirmation modal before firing. MVP: calls Better Auth `sign-out` + sets a `deactivated: true` flag on `user-profile`. `// TODO: hide profile from public, prevent sign-in`
- **Delete account** — two-step confirmation (type username to confirm). MVP: `// TODO: Spec C — requires anonymising contributions before deletion`. For now shows: "Account deletion will be available once contribution archiving is in place."

---

## Styling & Design conventions

- All pages follow the established page shell pattern: `T.bg.space` background, `T.ink.base` text
- Settings sidebar uses `T.accent.aurora` for the active nav item underline
- Form inputs: dark glass inputs matching existing auth form style (`inputStyle` pattern from auth components)
- Section headers use `SectionHeader` DS component
- Section wrappers use a consistent `SettingsSection` container (title, description paragraph, bordered content area)
- Mono labels (`T.font.mono`, `letterSpacing: ".12em"`, uppercase) for field labels
- Verified librarian badge: gold chip (`T.accent.gold`), mono text "VERIFIED LIBRARIAN"
- Profile hero title: `T.font.serif` at ~64px for the name, italic suffix style matching `HeroTitle`

---

## Auth & session handling

- Settings pages: `layout.tsx` does the auth gate — all child routes inherit protection
- All Next.js API routes call `getSessionSSR(headers())` and return `401` if no session
- Strapi `/api/user-profiles/me` and `PATCH` endpoints call `strapi.betterAuth.api.getSession` and reject if no session
- No `baUserId` is ever passed from the client — the server resolves it from the session

---

## What is explicitly out of scope (with TODO markers)

| Feature                                                | Marker                                            | Future spec |
| ------------------------------------------------------ | ------------------------------------------------- | ----------- |
| Contribution stats on profile                          | `// TODO: Spec C`                                 | Spec C      |
| Activity heatmap data                                  | `// TODO: Spec C`                                 | Spec C      |
| Recent contributions list                              | `// TODO: Spec C`                                 | Spec C      |
| Follow/unfollow users                                  | `// TODO: Spec B`                                 | Spec B      |
| Following libraries                                    | `// TODO: Spec B`                                 | Spec B      |
| Collections tab                                        | `// TODO: Spec B`                                 | Spec B      |
| Badges                                                 | `// TODO: Spec C`                                 | Spec C      |
| 2FA / TOTP enrollment                                  | `// TODO: Better Auth twoFactor plugin`           | Future      |
| Passkeys / WebAuthn                                    | `// TODO: Better Auth passkey plugin`             | Future      |
| Privacy settings page                                  | Coming soon placeholder                           | Future      |
| API tokens page                                        | Coming soon placeholder                           | Future      |
| ORCID / GitHub / institutional email fields on profile | `// TODO: Spec B`                                 | Spec B      |
| Real data export                                       | `// TODO: backend export job`                     | Future      |
| Account deactivation (full)                            | `// TODO: hide from public, block sign-in`        | Future      |
| Account deletion (full)                                | `// TODO: Spec C — anonymise contributions first` | Spec C      |
| Message button on profile                              | `// TODO: messaging system`                       | Future      |
