# Strapi Role & Permissions Setup Guide

This is a step-by-step reference for configuring permissions after a fresh Strapi install or when adding new roles. Work through the three systems in order.

---

## Before you start: understand the three auth paths

Every request to Strapi is evaluated against exactly one of these — they never mix:

| Caller                                      | How it authenticates                                        | Permission system                             |
| ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| Next.js RSC / server functions              | `Authorization: Bearer <STRAPI_API_TOKEN>`                  | API token's own permission set                |
| Logged-in user (browser)                    | Better Auth session cookie (strapiJWT resolved server-side) | Users-permissions role                        |
| Unauthenticated browser                     | No header                                                   | `public` role                                 |
| Auth-bridge calls (Next.js server → Strapi) | `X-Service-Secret` header                                   | Route has `auth: false` — bypasses everything |

---

## Critical: `auth: false` routes — checkboxes have no effect

The following custom routes are hardcoded with `auth: false` in their route definitions. They are **always publicly accessible regardless of what you check in the permissions UI**. Do not waste time configuring these — leave their checkboxes unchecked.

| Content type                    | Actions that are `auth: false`                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin-panel-config              | `find` (internal bootstrap — ignore entirely)                                                                                                                                                                                            |
| Area                            | `detail`, `mapPins`, `slugs`                                                                                                                                                                                                             |
| Auth-bridge                     | **All routes** — `syncUser`, `upsertProfile`, `deleteProfile`, `followStatus`, `toggleFollow`, `createAffiliation`, `affiliationCount`, `claimStatus`, `getUserAffiliations`, `computeQuickWins`, `toggleFollowUser`, `userFollowStatus` |
| Blog-article                    | `detail`, `slugs`                                                                                                                                                                                                                        |
| Category                        | `nav`                                                                                                                                                                                                                                    |
| **content-moderation (plugin)** | **All routes** — `create`, `stats`, `findByDocumentId`, `findByUsername`, `findMine`, `saveDraft`, `finalize`, `findDraft` — all `auth: false`, user validated internally via Better Auth session                                        |
| Continent                       | `detail`, `homepage`, `mapPins`, `slugs`                                                                                                                                                                                                 |
| Country                         | `detail`, `mapPins`, `slugs`                                                                                                                                                                                                             |
| Health                          | `find`                                                                                                                                                                                                                                   |
| Library                         | `mapPins`                                                                                                                                                                                                                                |
| Region                          | `detail`, `mapPins`, `slugs`                                                                                                                                                                                                             |
| **rewards (plugin)**            | `leaderboard`, `myStanding`, `myHistory`, `howItWorks` — public routes with internal validation                                                                                                                                          |
| Wiki-article                    | `detail`, `slugs`                                                                                                                                                                                                                        |
| Wiki-section                    | `nav`                                                                                                                                                                                                                                    |
| User-profile                    | `findByUsername`, `findByDocumentId`, `findBadgesByUsername`, `findBadgesByDocumentId` — all four are hardcoded `auth: false`; only `update` and standard CRUD appear in the permissions panel                                           |
| **events (plugin)**             | **All content-API routes** — `library`, `location`, `global`, `thisWeek`, `stats`, `providerBreakdown`, `topLibraries`, `categoryBreakdown`, `heatmap`, `featured`, `event`, `relatedEvents`, `icsGlobal`, `icsLibrary`                  |
| **saved-event**                 | `find`, `create`, `delete` — all `auth: false`; auth enforced in controller via `ctx.state.user`                                                                                                                                         |
| **topics (plugin)**             | `findApproved` — `auth: false`. `findAll` and `updateStatus` use `auth: { scope: [] }` — requires API token, not users-permissions                                                                                                       |

When you open Area in the permissions UI and see `detail`, `mapPins`, `slugs` — leave them unchecked. They work regardless.

---

## System 1 — API Tokens

**Where:** Settings → API Tokens → Create new token

This token is used exclusively by Next.js server components and RSC data fetching. It is never exposed to the browser.

### Setup

| Field          | Value        |
| -------------- | ------------ |
| Name           | `nextjs-ssr` |
| Token duration | Unlimited    |
| Token type     | **Custom**   |

### What to grant

Grant `find` only for single types (they have no `findOne`). Grant `find` + `findOne` for collection types. No writes — all content mutations go through the auth-bridge service secret.

**Single types** — `find` only (no `findOne` exists):

| Content type | find |
| ------------ | ---- |
| Blog-landing | ✓    |
| Footer       | ✓    |
| Homepage     | ✓    |
| Navbar       | ✓    |
| Wiki-landing | ✓    |

**Collection types** — `find` + `findOne`:

| Content type                    | find | findOne | Notes                                                                                                                          |
| ------------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Accessibility                   | ✓    | ✓       |                                                                                                                                |
| Amenity                         | ✓    | ✓       |                                                                                                                                |
| Area                            | ✓    | ✓       | custom actions are `auth: false` — no need to grant them                                                                       |
| Blog-article                    | ✓    | ✓       | `detail`/`slugs` are `auth: false`                                                                                             |
| Blog-section                    | ✓    | ✓       |                                                                                                                                |
| Category                        | ✓    | ✓       | `nav` is `auth: false`                                                                                                         |
| Continent                       | ✓    | ✓       | custom actions are `auth: false`                                                                                               |
| Country                         | ✓    | ✓       | custom actions are `auth: false`                                                                                               |
| Library                         | ✓    | ✓       | `mapPins` is `auth: false`                                                                                                     |
| Page                            | ✓    | ✓       |                                                                                                                                |
| Redirect                        | ✓    | ✓       | read by Next.js middleware for redirect rules                                                                                  |
| Region                          | ✓    | ✓       | custom actions are `auth: false`                                                                                               |
| Service                         | ✓    | ✓       |                                                                                                                                |
| Subscriber                      | —    | —       | newsletter sign-up only — no SSR need                                                                                          |
| User-profile                    | ✓    | ✓       | server-side profile reads by `baUserId` filter                                                                                 |
| Wiki-article                    | ✓    | ✓       | custom actions are `auth: false`                                                                                               |
| Wiki-section                    | ✓    | ✓       | `nav` is `auth: false`                                                                                                         |
| **content-moderation (plugin)** | —    | —       | all routes are `auth: false`, not token-gated                                                                                  |
| **events (plugin)**             | —    | —       | all content-API routes are `auth: false`, not token-gated                                                                      |
| **topics (plugin)**             | —    | —       | `findApproved` is `auth: false`; `findAll`/`updateStatus` use `auth: { scope: [] }` — token-gated but no explicit grant needed |
| Saved-event                     | —    | —       | all routes are `auth: false`, controller enforces user session                                                                 |
| Event-provider                  | ✓    | ✓       | `create` open to public (feed submission form); reads restricted                                                               |

---

## System 2 — Users-Permissions Roles

**Where:** Settings → Users & Permissions plugin → Roles

This controls what logged-in and anonymous browser requests can access. Configure in this order: Public → Authenticated → Verified Librarian → Wiki Editor.

---

### Role 1: Public

Unauthenticated visitors. Most SSR data fetching uses the API token, so this role primarily covers direct browser requests: map interactions and client-side content lookups.

**Content types — check `find` + `findOne` for all collection types, `find` only for single types:**

| Content type  | find | findOne | Kind                      |
| ------------- | ---- | ------- | ------------------------- |
| Accessibility | ✓    | ✓       | collection                |
| Amenity       | ✓    | ✓       | collection                |
| Area          | ✓    | ✓       | collection                |
| Blog-article  | ✓    | ✓       | collection                |
| Blog-landing  | ✓    | —       | **single type**           |
| Blog-section  | ✓    | ✓       | collection                |
| Category      | ✓    | ✓       | collection                |
| Continent     | ✓    | ✓       | collection                |
| Country       | ✓    | ✓       | collection                |
| Footer        | ✓    | —       | **single type**           |
| Homepage      | ✓    | —       | **single type**           |
| Library       | ✓    | ✓       | collection                |
| Navbar        | ✓    | —       | **single type**           |
| Page          | ✓    | ✓       | collection                |
| Region        | ✓    | ✓       | collection                |
| Service       | ✓    | ✓       | collection                |
| Subscriber    | —    | —       | `create` only (see below) |
| Wiki-article  | ✓    | ✓       | collection                |
| Wiki-landing  | ✓    | —       | **single type**           |
| Wiki-section  | ✓    | ✓       | collection                |

**Subscriber — check `create` only** (newsletter sign-up form — public can submit, not read).

**Do not check for Public:**

- `create`, `update`, `delete` on any content type (except Subscriber `create`)
- `detail`, `mapPins`, `slugs`, `nav`, `homepage` on any content type — these are `auth: false`, checkboxes do nothing
- Auth-bridge (all `auth: false`)
- User-profile `find`/`findOne` — public profiles go through `findByUsername` (auth: false, visibility-enforced); server-side profile reads use the API token
- Redirect — server-side only, handled via API token
- content-moderation — all routes are `auth: false`

**Users-permissions plugin — AUTH section (Public):**

Better Auth handles all auth flows. These actions must remain enabled for OAuth callbacks and email confirmation links to function:

| Action                  | Check?                 |
| ----------------------- | ---------------------- |
| `callback`              | ✓                      |
| `connect`               | ✓                      |
| `emailConfirmation`     | ✓                      |
| `forgotPassword`        | ✓                      |
| `refresh`               | ✓                      |
| `register`              | ✓                      |
| `resetPassword`         | ✓                      |
| `sendEmailConfirmation` | ✓                      |
| `changePassword`        | — (authenticated only) |
| `logout`                | — (authenticated only) |

**Users-permissions plugin — PERMISSIONS, ROLE, USER sections (Public):** leave all unchecked. Never expose role or user management to the public role.

---

### Role 2: Authenticated

Default role for all signed-in users.

**Everything in Public — no additional content-type actions required.**

Content-moderation routes (`create`, `findMine`, `saveDraft`, `findDraft`) are `auth: false` and validate the user via Better Auth session internally. They do not appear in this UI and cannot be configured here.

**Grant in addition to Public:**

| Content type   | Action   | Reason                                  |
| -------------- | -------- | --------------------------------------- |
| `user-profile` | `update` | User updates their own profile settings |

**Do not grant:**

- `user-profile: create` — profile created via auth-bridge on registration
- `library: create/update`, `wiki-article: create/update` — go through the submission workflow
- Redirect `find`/`findOne` — server-side only

**Users-permissions plugin — AUTH section (Authenticated):**

Everything checked in Public, plus:

| Action           | Check? |
| ---------------- | ------ |
| `changePassword` | ✓      |
| `logout`         | ✓      |

**Users-permissions plugin — USER section (Authenticated):**

| Action                                                                 | Check? |
| ---------------------------------------------------------------------- | ------ |
| `me`                                                                   | ✓      |
| all others (`find`, `findOne`, `count`, `create`, `update`, `destroy`) | —      |

**Users-permissions plugin — ROLE and PERMISSIONS sections:** all unchecked.

---

### Role 3: Verified Librarian

**Permissions: identical to Authenticated.** Do not add any additional content-type permissions.

The distinction between Authenticated and Verified Librarian is enforced in the service layer (claim approval flow) and the frontend UI, not in API permissions. When a `library_claim` submission is approved, the content-moderation service promotes the user's role to `verified_librarian` in users-permissions.

> **Note when creating this role:** Keep the description field under 255 characters. The `up_roles` table enforces `varchar(255)` on the description column — a longer description will throw a database error. Suggested description: `Verified library staff. Identical API access to Authenticated.`

---

### Role 4: Wiki Editor

**All Authenticated permissions, plus the following.**

Wiki editors never write directly to `wiki-article`. All edits are submitted via the content-moderation plugin and applied by the service on approval. The role only needs read access to wiki content and the ability to upload media.

**User-profile:**

`findByUsername`, `findByDocumentId`, `findBadgesByUsername`, and `findBadgesByDocumentId` are all hardcoded `auth: false` — they do not appear as checkboxes in the permissions panel and work regardless. The only user-profile permission to tick here is:

| Action              | Check? | Reason                         |
| ------------------- | ------ | ------------------------------ |
| `update`            | ✓      | User updates their own profile |
| `find` / `findOne`  | —      | Admin-level listing            |
| `create` / `delete` | —      | Never for a user role          |

> `update` should also be ticked on the base **Authenticated** role — every signed-in user needs it.

**Wiki-article:**

`detail` and `slugs` are both hardcoded `auth: false` — checkboxes have no effect. The permissions panel only controls standard CRUD:

| Action            | Check? | Reason                                                      |
| ----------------- | ------ | ----------------------------------------------------------- |
| `find`            | ✓      | List articles                                               |
| `findOne`         | ✓      | Fetch article                                               |
| `create`/`update` | —      | Writes go through content-moderation plugin, not direct API |
| `delete`          | —      | Admin only                                                  |
| `detail`/`slugs`  | —      | `auth: false` — checkboxes do nothing here                  |

**Wiki-section:**

| Action                     | Check? |
| -------------------------- | ------ |
| `find`                     | ✓      |
| `nav`                      | ✓      |
| `findOne`                  | —      |
| `create`/`update`/`delete` | —      |

**Wiki-landing:** leave all unchecked (public reads via API token, writes are admin only).

**Media Library (upload plugin):**

| Action    | Check? | Reason                                              |
| --------- | ------ | --------------------------------------------------- |
| `upload`  | ✓      | Attach images to wiki articles via the editor       |
| `find`    | ✓      | Browse previously uploaded media to avoid re-upload |
| `findOne` | ✓      | Load specific media item                            |
| `destroy` | —      | Admin only                                          |

**Users-permissions — AUTH section:** Do not check anything here. AUTH actions (`register`, `callback`, `forgotPassword`, etc.) are unauthenticated flows that belong on the **Public** role. A wiki editor is already authenticated — these have no effect for this role.

**Users-permissions — USER section:** `me` only (inherited from Authenticated).

**Users-permissions — PERMISSIONS and ROLE sections:** all unchecked.

---

## System 3 — Admin Panel RBAC

**Where:** Settings → Administration panel → Roles

Controls access to the Strapi admin panel itself. Completely separate from users-permissions.

### Rewards plugin

| Permission UID           | Display name                    | Who should have it |
| ------------------------ | ------------------------------- | ------------------ |
| `plugins::rewards.read`  | View rewards data               | Editors, admins    |
| `plugins::rewards.award` | Manually award or deduct points | Admins only        |

---

### Admin Role: Moderator

Triages the submission queue. Cannot directly edit or publish content.

**Plugins tab:**

| Plugin             | Permissions to check                                      |
| ------------------ | --------------------------------------------------------- |
| content-moderation | `Access the moderation queue`, `Update submission status` |
| rewards            | `View rewards data`                                       |
| Users permissions  | Roles → `read`; Users → `read`                            |

> Moderators need to see which role a user holds to triage claims correctly. They cannot change roles.

**Collection types — Read only (no create/update/delete/publish):**

- Library, Region, Country, Area, Continent
- Wiki-article, Blog-article
- User-profile
- Submission (the content-moderation content type)

---

### Admin Role: Editor

Full editorial control plus moderation.

**Plugins tab:**

| Plugin             | Permissions to check                                      |
| ------------------ | --------------------------------------------------------- |
| content-moderation | `Access the moderation queue`, `Update submission status` |
| rewards            | `View rewards data`, `Manually award or deduct points`    |
| Users permissions  | Roles → `read`, `update`; Users → `read`, `update`        |

> Editors need role update access to promote users to Verified Librarian when approving library claims (until the content-moderation service handles this automatically).

**Collection types — full CRUD + publish/unpublish:**

- Library, Region, Country, Area, Continent
- Wiki-article, Wiki-section, Wiki-landing
- Blog-article, Blog-section, Blog-landing
- Category, Service, Amenity, Accessibility
- Page, Navbar, Footer, Homepage

**Collection types — Read only:**

- User-profile (no direct edits — use auth-bridge)
- Redirect

---

## Full permission matrix

| Action                            | Public | Authenticated | Verified Librarian | Wiki Editor | API Token | Moderator (admin) | Editor (admin) |
| --------------------------------- | :----: | :-----------: | :----------------: | :---------: | :-------: | :---------------: | :------------: |
| Browse atlas / read content       |   ✓    |       ✓       |         ✓          |      ✓      |     ✓     |       read        |   read+write   |
| Subscribe (newsletter)            |   ✓    |       ✓       |         ✓          |      ✓      |     —     |         —         |       —        |
| View public profiles              |   ✓    |       ✓       |         ✓          |      ✓      |     ✓     |         —         |       —        |
| Update own profile                |   —    |       ✓       |         ✓          |      ✓      |     —     |         —         |       —        |
| Upload media                      |   —    |       —       |         —          |      ✓      |     —     |         —         |       ✓        |
| Submit correction / new library   |   —    |       ✓       |         ✓          |      ✓      |     —     |         —         |       —        |
| Submit library edit               |   —    |       ✓       |  ✓ (elevated UI)   |      ✓      |     —     |         —         |       —        |
| Claim a library                   |   —    |       ✓       |         —          |      —      |     —     |         —         |       —        |
| Follow / unfollow library         |   —    |       ✓       |         ✓          |      ✓      |     —     |         —         |       —        |
| Save submission draft             |   —    |       ✓       |         ✓          |      ✓      |     —     |         —         |       —        |
| Submit wiki edit (via moderation) |   —    |       —       |         —          |      ✓      |     —     |         —         |       —        |
| Read wiki articles for editing    |   ✓    |       ✓       |         ✓          |      ✓      |     ✓     |         ✓         |       ✓        |
| Write wiki-article directly       |   —    |       —       |         —          |      —      |     —     |         —         |       ✓        |
| View moderation queue             |   —    |       —       |         —          |      —      |     —     |         ✓         |       ✓        |
| Approve / reject submissions      |   —    |       —       |         —          |      —      |     —     |         ✓         |       ✓        |
| Directly edit content in Strapi   |   —    |       —       |         —          |      —      |     —     |         —         |       ✓        |
| Publish / unpublish entries       |   —    |       —       |         —          |      —      |     —     |         —         |       ✓        |

---

## Role promotion: when a library claim is approved

When a moderator approves a `library_claim` submission, the content-moderation service must update the user's users-permissions role:

```ts
// apps/strapi/src/plugins/content-moderation/server/services/submission.ts
// Add inside the library_claim approval block:

const verifiedRole = await strapi
  .query("plugin::users-permissions.role")
  .findOne({ where: { name: "verified_librarian" } })

if (verifiedRole) {
  const upUser = await strapi
    .query("plugin::users-permissions.user")
    .findOne({ where: { email: submission.submittedByEmail } })
  if (upUser) {
    await strapi
      .query("plugin::users-permissions.user")
      .update({ where: { id: upUser.id }, data: { role: verifiedRole.id } })
  }
}
```

Once this is in place, `isVerifiedLibrarian` and `contributorRole` on `user-profile` can be removed — the users-permissions role becomes the single source of truth.

---

## Security decisions — do not revert these

### user-profile: no `find`/`findOne` on Public or Authenticated roles

Public profile pages go through `findByUsername` (auth: false, enforces `profileVisibility`, scrubs internal fields). Server-side profile reads (settings, onboarding, profile page) use the API token (`STRAPI_REST_READONLY_API_KEY`). Granting `find`/`findOne` to Public would expose the full collection — including private profiles and internal fields — to unauthenticated content API queries.

### `findByUsername` enforces visibility and strips fields

The controller respects `profileVisibility`:

- `private` → returns 404 (no information leak)
- `limited` → strips contact/location fields (`website`, `orcid`, `mastodon`, `linkedin`, `city`, `country`, `timezone`)

Always stripped regardless of visibility: `baUserId`, `notifPrefs`, `affiliationVerificationStatus`, `affiliationVerificationMethod`, `claimedLibraryEntityRef/Name/Role/Department`, `contributorNumber`.

### `upsertProfile` allowlist excludes moderation-only fields

The auth-bridge `upsertProfile` endpoint only accepts user-controlled settings fields. The following are intentionally excluded and must only be written by the moderation service on claim approval:

- `affiliationVerificationStatus` / `affiliationVerificationMethod`
- `contributorRole`
- `claimedLibraryEntityRef` / `claimedLibraryName` / `claimedLibraryRole` / `claimedLibraryDepartment`
- `isVerifiedLibrarian`

If you need to update these for a user, do it through the claim approval flow in `content-moderation/server/services/submission.ts`, not by expanding the `upsertProfile` allowlist.

**Plugin-only fields (never writable by upsertProfile):** `points`, `pointsThisMonth`, `tier`, `streak`, `lastActivityDate` — written exclusively by the `rewards` plugin service. See `docs/community-and-points-system.md`.
