# Strapi Role & Permissions Setup Guide

A reference for who may do what, and where each of those decisions is configured. Contributor trust lives in **Role Grants**; Strapi's own permission systems (API tokens, Users & Permissions and admin RBAC) only cover reads, the browser's public role and the admin panel.

Spec: `docs/superpowers/specs/2026-09-29-community-moderation-and-audit-design.md` §3, §5 and §9.1. Decision: `docs/adr/0005-moderation-runs-in-the-frontend.md`.

---

## Before you start: who decides what

| Caller                                                    | How it authenticates                                                                   | What decides                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Next.js RSC reads                                         | `Authorization: Bearer <STRAPI_REST_READONLY_API_KEY>`                                 | The API token's own permission set                                                                                              |
| Next.js server acting for a signed-in user (bridge calls) | `X-Service-Secret: <STRAPI_BRIDGE_SECRET>` plus `X-Ba-User-Id` on `auth: false` routes | The route's own checks: `submission-policy` (Role Grants, Library Claims, quotas) and the moderation controller (`canModerate`) |
| Unauthenticated browser calling Strapi directly           | No header                                                                              | Users & Permissions `public` role                                                                                               |
| Strapi admin panel                                        | Admin login                                                                            | Admin RBAC (Settings → Administration panel → Roles)                                                                            |
| Import scripts                                            | An API token named `ingest-…` or `import-…`                                            | The token's permission set; Change Records class its writes as `source: "import"`                                               |

Two rules follow from this:

- **Contributor Roles are not Strapi roles.** Every account holds the Users & Permissions `Authenticated` role, which guards nothing, and contributors have no admin accounts. Roles are rows in the `role-grant` collection (below).
- **Money never buys trust.** No Plan, Entitlement, Tier or Points value feeds a Role Grant, a Moderation Scope or review order (`packages/access/tests/invariants.test-d.ts`).

---

## Role Grants: contributor roles

**Where:** Content Manager → Role Grant (`api::role-grant.role-grant`). Admin-only: `routes: []`, so there is no REST API. Read by the `session-profile` bridge and by `submission-policy`.

One row gives one person one Contributor Role. A person's roles are the union of their unexpired grants; with none they are a `reader`.

| Field         | Value                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baUserId`    | The person's Better Auth id (copy it from their `user-profile.baUserId`)                                                                             |
| `role`        | `contributor`, `verified_librarian`, `wiki_editor`, `journal_editor`, `moderator` or `editorial_board`                                               |
| `queue`       | `all` (default), `index`, `knowledge`, `journal` or `applications`. Read only for `moderator`                                                        |
| `scopeLocale` | Empty for every locale, or one locale code such as `fr`. Read for `moderator`, `wiki_editor` and `journal_editor`. (`locale` is reserved by Strapi.) |
| `source`      | `admin` for grants you add. Code uses `claim` (Library Claims), `application` (Role Applications) and `migration`                                    |
| `grantedBy`   | Your email                                                                                                                                           |
| `reason`      | Why, in a sentence                                                                                                                                   |
| `expiresAt`   | Optional. Strapi stops counting a grant once it expires; the session follows within 60 seconds                                                       |

### What each role gives

| Role                 | Capabilities                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reader` (no grants) | Every signed-in user can submit corrections, new libraries, claims, Knowledge suggestions, Journal pitches, topic suggestions, Role Applications and Location Requests. A Library Claim adds `library_edit` and event feeds for that library |
| `contributor`        | A displayed trust label; no extra capabilities                                                                                                                                                                                               |
| `verified_librarian` | A displayed trust label (`isVerifiedLibrarian`); library edits come from the Library Claim itself                                                                                                                                            |
| `wiki_editor`        | `docs.directEdit`: Knowledge edits publish on approval, in the grant's locale (or every locale)                                                                                                                                              |
| `journal_editor`     | `journal.directEdit`: Journal edits publish on approval, in the grant's locale (or every locale)                                                                                                                                             |
| `moderator`          | `moderate.queue`: reviews Submissions in the grant's queue and locale at `/contribute/moderation`. Nothing else                                                                                                                              |
| `editorial_board`    | Both editor roles in every locale, moderates every queue and locale, and alone decides option suggestions                                                                                                                                    |

`wiki_editor`, `journal_editor`, `moderator` and `editorial_board` also get Curator contribution quotas (`contributionLimits`).

### Examples

| Purpose                            | `role`            | `queue`        | `scopeLocale` |
| ---------------------------------- | ----------------- | -------------- | ------------- |
| Moderator for everything           | `moderator`       | `all`          | empty         |
| French Knowledge moderator         | `moderator`       | `knowledge`    | `fr`          |
| Reviews Role Applications only     | `moderator`       | `applications` | empty         |
| Knowledge editor in every language | `wiki_editor`     | `all`          | empty         |
| Journal editor in French           | `journal_editor`  | `all`          | `fr`          |
| Editorial board                    | `editorial_board` | `all`          | empty         |

A person can hold several rows, for example a French Knowledge editor who also moderates the Journal queue.

### What happens when you save

- The `role-grant` lifecycle (`src/lifeCycles/roleGrant.ts`) runs `syncDerivedRole`, which writes the profile's `contributorRole` (the highest unexpired grant, for display only) and `isVerifiedLibrarian`. Nothing else writes those two fields; never edit them on the profile.
- It then posts to the site's `POST /api/internal/session/invalidate` (needs `APP_PUBLIC_URL` and `STRAPI_BRIDGE_SECRET`), so the change usually shows on the person's next request. That call is best effort and per instance: the 60-second session-profile cache is the guarantee.
- To revoke a role, delete the row or set `expiresAt` to now. A daily cron (`resyncExpiredRoleGrants`) re-derives the profile of anyone whose grant expired by itself.

### Grants written by code

- An approved Library Claim, or an email-domain auto-verification, creates a `verified_librarian` grant (`grantVerifiedLibrarian`, `source: "claim"`) if the user has none. It never removes one.
- An approved Role Application creates `wiki_editor` or `journal_editor` grants (`source: "application"`, `grantedBy` the reviewer), one per requested locale, or one for every locale.
- At boot, `migrateContributorRolesToGrants` turned every pre-grant `contributorRole` into a global grant (`source: "migration"`), once, behind a core-store flag.
- Erasing an account deletes its grants (`utils/erase-account.ts`).

---

## The two moderation surfaces

|                     | On the site: `/contribute/moderation`                                                                                                                           | In Strapi admin: Plugins → Content moderation                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Who                 | Community users with a `moderator` or `editorial_board` grant                                                                                                   | Admin users whose role has the plugin's permissions (the owner)                                        |
| Scope               | Their Moderation Scopes, re-read from their grants by Strapi on every request (`canModerate`)                                                                   | Every queue and locale                                                                                 |
| API                 | Content API `/api/content-moderation/moderation/*`: `auth: false`, bridge secret plus `X-Ba-User-Id`, called only by the Next proxies in `app/api/moderation/*` | Admin routes `/content-moderation/*`, behind `admin::isAuthenticatedAdmin` and `admin::hasPermissions` |
| Out of scope        | 404, the same answer as a missing submission, so scope can't be probed                                                                                          | n/a                                                                                                    |
| Own submissions     | Refused (403), matched by Better Auth id                                                                                                                        | Refused, matched by email                                                                              |
| Reviewer id stored  | `ba:<Better Auth id>`                                                                                                                                           | `admin:<admin user id>`                                                                                |
| Publish on approval | **Approve and publish** for `new_library` and for article suggestions and new articles from non-editors (`wiki_edit`, `blog_submission`)                        | No: publish from the Content Manager                                                                   |
| Option suggestions  | `/contribute/moderation/suggestions`, editorial board only                                                                                                      | Suggestions tab                                                                                        |

Both surfaces call the same service methods, write the same Review Events and send the same notifications. Moderators don't need, and shouldn't get, a Strapi admin account.

---

## Admin panel RBAC (the owner)

**Where:** Settings → Administration panel → Roles

Only the owner has admin access today, as Super Admin, which holds every permission below. If you ever add another admin role, configure it like this.

### Plugin permissions

| Plugin             | Permission (UID)                                                  | Grants                                                    |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------------- |
| content-moderation | "Access the moderation queue" (`plugin::content-moderation.read`) | The admin queue, relation labels, option suggestions list |
| content-moderation | "Update submission status" (`plugin::content-moderation.update`)  | Decisions and option suggestion decisions                 |
| rewards            | "View rewards data" (`read`)                                      | The rewards dashboard                                     |
| rewards            | "Manually award or deduct points" (`award`)                       | Point adjustments                                         |

### Collection types

| Collection                                                                 | Who                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Role Grant, Entitlement Grant, Pro Verification                            | Super Admin only. These grant trust and plans                                         |
| Library Change, Article Change                                             | **Read only** for every role except Super Admin. Never grant create, update or delete |
| Review Event (`plugin::content-moderation.review-event`)                   | Hidden from the Content Manager; nothing to configure                                 |
| Submission                                                                 | Read only; decide submissions through a moderation queue, never by editing the row    |
| User-profile                                                               | Read only; `contributorRole` and `isVerifiedLibrarian` are derived from Role Grants   |
| Library, Region, Country, Area, Continent, articles, sections and landings | Editors: full CRUD plus publish                                                       |

---

## Append-only collections

The audit trail is written only by code, never by hand:

| Collection                         | Written by                                                                                                               | Read through                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `library-change` (Change Records)  | The document-service middleware `src/documentMiddlewares/change-records.ts`: one row per changed field per library write | `GET /api/content-moderation/libraries/:documentId/history` and `/history/stats`; the Content Manager |
| `article-change` (Article Changes) | The same middleware: one row per Knowledge or Journal write                                                              | `GET /api/content-moderation/articles/:kind/:documentId/history`; the Content Manager                 |
| `review-event` (Review Events)     | `content-moderation`'s status updates and `finalize`, inside the decision's transaction                                  | `GET /api/content-moderation/moderation/submissions/:documentId/events` (Moderators only)             |

- None has a REST route, and none has an update or delete route. `library-change` and `article-change` are `routes: []`.
- Inserts run inside the write's transaction when it has one, so an approval whose record can't be written rolls back.
- The actor comes from `src/utils/change-context.ts`: an approved submission (the contributor, with the reviewer), the admin user, the API token by name, or `system`. Name import tokens `ingest-…` or `import-…` so their writes are classed as imports.
- `CHANGE_RECORDS_ENABLED=false` (`apps/strapi/.env.example`) switches recording off in an emergency and logs a warning at boot.

---

## Critical: `auth: false` routes — checkboxes have no effect

The following custom routes are hardcoded with `auth: false` in their route definitions. They are **always reachable regardless of what you check in the permissions UI**; they check identity themselves where they need it. Leave their checkboxes unchecked.

| Content type                    | Actions that are `auth: false`                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin-panel-config              | `find` (internal bootstrap — ignore entirely)                                                                                                                                                                                                                                                                                                                       |
| Area                            | `detail`, `mapPins`, `slugs`                                                                                                                                                                                                                                                                                                                                        |
| Auth-bridge                     | **All routes**, bridge secret required — `syncUser`, `upsertProfile`, `deleteProfile`, `followStatus`, `createAffiliation`, `affiliationCount`, `claimStatus`, `toggleFollow`, `getUserAffiliations`, `sessionProfile`, `computeQuickWins`, `toggleFollowUser`, `userFollowStatus`                                                                                  |
| Blog-article                    | `detail`, `slugs`                                                                                                                                                                                                                                                                                                                                                   |
| Category                        | `nav`                                                                                                                                                                                                                                                                                                                                                               |
| **content-moderation (plugin)** | **All content-API routes.** Contributor routes (`create`, `findMine`, `saveDraft`, `finalize`, `findDraft`, uploads, option-suggestion votes) take the bridge secret plus `X-Ba-User-Id`; the `moderation/*` routes also re-check Moderation Scopes; `locales`, `stats`, `findByUsername` and the history routes are public (history values need the bridge secret) |
| Continent                       | `detail`, `homepage`, `mapPins`, `slugs`                                                                                                                                                                                                                                                                                                                            |
| Country                         | `detail`, `mapPins`, `slugs`                                                                                                                                                                                                                                                                                                                                        |
| Health                          | `find`                                                                                                                                                                                                                                                                                                                                                              |
| Library                         | `mapPins`                                                                                                                                                                                                                                                                                                                                                           |
| Region                          | `detail`, `mapPins`, `slugs`                                                                                                                                                                                                                                                                                                                                        |
| **rewards (plugin)**            | `leaderboard`, `myStanding`, `myHistory`, `howItWorks` — public routes with internal validation                                                                                                                                                                                                                                                                     |
| Wiki-article                    | `detail`, `slugs`                                                                                                                                                                                                                                                                                                                                                   |
| Wiki-section                    | `nav`                                                                                                                                                                                                                                                                                                                                                               |
| User-profile                    | `findByUsername`, `findByDocumentId`, `findBadgesByUsername`, `findBadgesByDocumentId` — all four are hardcoded `auth: false`; only `update` and standard CRUD appear in the permissions panel                                                                                                                                                                      |
| **events (plugin)**             | **All content-API routes** — `library`, `location`, `global`, `thisWeek`, `stats`, `providerBreakdown`, `topLibraries`, `categoryBreakdown`, `heatmap`, `featured`, `event`, `relatedEvents`, `icsGlobal`, `icsLibrary`                                                                                                                                             |
| **saved-event**                 | `find`, `create`, `delete` — all `auth: false`; auth enforced in controller via `ctx.state.user`                                                                                                                                                                                                                                                                    |
| **topics (plugin)**             | `findApproved` — `auth: false`. `findAll` and `updateStatus` use `auth: { scope: [] }` — requires API token, not users-permissions                                                                                                                                                                                                                                  |

---

## API tokens

**Where:** Settings → API Tokens → Create new token

### `nextjs-ssr` (read only)

Used by Next.js server components for public reads (`STRAPI_REST_READONLY_API_KEY`). Never exposed to the browser. Token type **Custom**, duration Unlimited.

Grant `find` only for single types (they have no `findOne`) and `find` + `findOne` for collection types. No writes: contributor writes go through the bridge-secret routes above, and are applied by the moderation service on approval.

**Single types** — `find`: Blog-landing, Footer, Homepage, Navbar, Wiki-landing.

**Collection types** — `find` + `findOne`: Accessibility, Amenity, Area, Blog-article, Blog-section, Category, Continent, Country, Library, Page, Redirect (read by Next.js middleware), Region, Service, User-profile (server-side profile reads by `baUserId`), Wiki-article, Wiki-section, Event-provider.

**Do not grant:** Subscriber; Role Grant, Entitlement Grant, Pro Verification, Library Change and Article Change (they have no REST routes anyway); content-moderation, events and saved-event (`auth: false`); topics (`auth: { scope: [] }` needs a token but no explicit grant).

### Import tokens

Bulk scripts in `apps/strapi/scripts/` write with their own token. Name it `ingest-<purpose>` (for example `ingest-world-countries`) so every write it makes is recorded with `source: "import"` and the token's name as the actor.

---

## Users & Permissions roles (vestigial)

**Where:** Settings → Users & Permissions plugin → Roles

Better Auth owns accounts; Strapi users exist only through the auth-bridge, and self-registration is switched off at every boot. Only two roles matter. **Don't create Verified Librarian, Wiki Editor or Moderator roles here, and don't move users between U&P roles:** contributor roles are Role Grants.

### Public

Unauthenticated browser requests (map interactions and client-side content lookups; most SSR reads use the API token).

- `find` + `findOne` on the public collection types (Accessibility, Amenity, Area, Blog-article, Blog-section, Category, Continent, Country, Library, Page, Region, Service, Wiki-article, Wiki-section) and `find` on the single types (Blog-landing, Footer, Homepage, Navbar, Wiki-landing).
- Subscriber: `create` only (newsletter sign-up).
- Users-permissions AUTH: leave `callback`, `connect`, `emailConfirmation`, `forgotPassword`, `refresh`, `register`, `resetPassword` and `sendEmailConfirmation` as they are; PERMISSIONS, ROLE and USER sections unchecked.

**Do not check for Public:** any `create`, `update` or `delete` (except Subscriber `create`); User-profile `find`/`findOne`; Redirect; Role Grant, Entitlement Grant, Pro Verification, Library Change or Article Change; the `auth: false` actions listed above.

### Authenticated

Every signed-in account holds this role. Same content permissions as Public, plus `user-profile: update`, `changePassword`, `logout` and USER `me`. Nothing else: no library or article writes (they go through Submissions), no role or user management.

---

## Security decisions — do not revert these

### user-profile: no `find`/`findOne` on Public or Authenticated

Public profile pages go through `findByUsername` (`auth: false`, enforces `profileVisibility`, scrubs internal fields). Server-side profile reads use the API token (`STRAPI_REST_READONLY_API_KEY`). Granting `find`/`findOne` to Public would expose the full collection, including private profiles and internal fields.

### `findByUsername` enforces visibility and strips fields

- `private` → 404 (no information leak)
- `limited` → strips contact and location fields (`website`, `orcid`, `mastodon`, `linkedin`, `city`, `country`, `timezone`)

Always stripped regardless of visibility: `baUserId`, `notifPrefs`, `affiliationVerificationStatus`, `affiliationVerificationMethod`, `claimedLibraryEntityRef/Name/Role/Department`, `contributorNumber`.

### Trust fields are never user-writable

The auth-bridge `upsertProfile` endpoint accepts only user-controlled settings. Excluded on purpose:

- `contributorRole` and `isVerifiedLibrarian` — derived from Role Grants by `syncDerivedRole`. Change a role by adding, expiring or deleting a grant.
- `affiliationVerificationStatus` / `affiliationVerificationMethod`, `claimedLibraryEntityRef` / `claimedLibraryName` / `claimedLibraryRole` / `claimedLibraryDepartment` — written by the claim approval flow in `content-moderation/server/services/submission.ts`.

**Plugin-only fields (never writable by `upsertProfile`):** `points`, `pointsThisMonth`, `tier`, `streak`, `lastActivityDate` — written exclusively by the `rewards` plugin service. See `docs/community-and-points-system.md`.

### No reviewer id from a client

Moderation routes take the reviewer from the bridge headers (site) or the admin session (admin panel), never from a request body, and Strapi refuses a decision on your own submission on both surfaces.
