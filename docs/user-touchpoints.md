# User Touchpoints & User Stories

A complete map of every surface where a user identity intersects with the platform — what is wired, what is missing, and what is planned.

---

## 1. Account & Auth

### Signup

- Email/password registration and Google OAuth are wired.
- GitHub OAuth is referenced in UI but not configured.
- After registration, Better Auth syncs the new user to Strapi (`databaseHooks.user.create.after` → `syncUserToStrapi`).
- **GAP**: The register form's `callbackUrl` defaults to `/` — new users are never redirected to onboarding.

### Sign-in

- Email/password, Google OAuth, and magic link are wired.
- **GAP**: After sign-in, there is no check for whether the user has completed onboarding.

### Onboarding (resolved)

- Route: `/profile/onboarding` — auth-gated, single scrollable form.
- Captures: username (required), name, avatar, pronouns, bio, city, country, timezone, affiliation type, library claim search (for librarians/researchers), interests, languages, external links, visibility.
- **Signal**: `username === null` on the Strapi profile means the user needs onboarding.
- **Required behaviour**: After every sign-in, check if `username` is null. If so, redirect to `/profile/onboarding?next={callbackUrl}` before completing the login redirect.
- Onboarding is skippable. Username is the only hard requirement (needed for the public profile URL).
- The "I represent a library" path (librarian / researcher affiliation types) shows a library claim search inline so stewards are routed to the Claim flow immediately.

### Session

- Better Auth session carries `strapiJWT` for authenticated Strapi calls.
- **GAP**: `contributorRole` is stored in Strapi `user-profile` but is NOT in the session. Wiki API routes read `session.user.contributorRole` and will always get `undefined` — all wiki editing API calls return 403 for everyone. **Fix**: extend the session via a BA plugin that fetches `contributorRole` from Strapi on login and caches it (refreshes within 24 hours via `updateAge`).

---

## 2. User Profile

### Public profile (`/profile/[username]`)

- Fully wired. Fetches from Strapi via `/api/user-profiles/by-username/{username}`.
- Displays: avatar, name, username, bio, tier badge, points, streak, contribution heatmap, recent contributions list, claimed libraries, followed libraries grid, earned badges.
- Tabs: Overview, Contributions, Activity, Following, Collections, Badges — all routed.

### Profile visibility (wired)

| Visibility | Who sees what                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public`   | All fields (except `baUserId`, `notifPrefs`, `contributorNumber`)                                                                                                          |
| `limited`  | Hides `website`, `orcid`, `mastodon`, `linkedin`, `city`, `country`, `timezone` — unless viewer is the owner or a fellow library member (affiliated with the same library) |
| `private`  | 403 for everyone except the owner                                                                                                                                          |

Followed profiles surfaced on a public profile are always filtered to `public` visibility only — `limited` and `private` profiles are never exposed via another user's following list.

### Profile settings (`/profile/settings`)

- Fully wired sections: public profile, notifications, appearance (theme), security (password), connections (OAuth — Google wired, GitHub stubbed), danger zone (account deletion).

### Own profile redirect (`/profile`)

- Fetches `username` from Strapi, redirects to `/@{username}`. Wired.

---

## 3. Library Detail Page — User Actions

### Follow / Save Library (wired)

- `LibraryFollowButton` in the hero. Toggles `followedLibraries` relation on the user profile via `/api/profile/me/follow`.
- Not logged in → "Sign in to follow" link with `callbackUrl` back to the library page.
- **Planned downstream effects** (not yet built):
  - (A) Saved libraries surface in a "Your libraries" filter on the Events browse and Library index.
  - (B) In-app and email notifications when significant data changes are approved for that library (status change, opening hours, new events).

### Claim / Manage Library (wired)

- `LibraryClaimButton` in the hero. Checks `/api/profile/me/affiliations` for matching `entityRef`.
- Not logged in → "Sign in to claim this library" (redirects to signin with claim URL as callback).
- Logged in, no claim → "Claim this library" → `/contribute/claim?...` (pre-filled).
- Logged in, claimed → "You manage this library" → `/contribute/edit/{slug}`.

### Suggest a Correction (missing — to be built)

Two entry points to add:

1. **Contact/metadata panel**: a small text link — "Spot an error? Suggest a correction →" — visible to all users, routes to a correction form pre-filled with the library.
2. **`LocationContributeCTA` banner**: replace the generic contribute banner at the bottom of library pages with a library-specific version naming the library and linking directly to the correction form.

**Correction form** (to be built): category picker (wrong opening hours / wrong address / wrong status / other) + freetext "What's wrong?" field. Submits as `submissionType: "correction"`. No claim required. Not logged in → "Sign in to suggest a correction" prompt.

Library stewards (users with a claim on this library) see the full edit diff flow instead; they do not need the correction CTA.

---

## 4. Contributions

### Add Library (`/contribute/add`)

- Multi-step wizard, auth-gated. Auto-saves drafts, resumes from draft on return.
- Validates against existing libraries via search gate.
- On finalize: creates `submissionType: "new_library"` with `status: pending`.
- On approval: library is published + submitter auto-gains a `library-affiliation` record + `contributorRole` is set to `verified_librarian`.
- Points: 50 on approval.

### Edit Library (`/contribute/edit/[slug]`)

- Diff editor showing current vs. proposed values.
- **Gated**: `/api/auth-bridge/claim-status` must confirm the user has an affiliation for this library. Non-stewards are redirected to the claim flow.
- On submit: creates `submissionType: "library_edit"`.
- Points on approval: 5 (1–3 fields changed), 15 (4+ fields changed).

### Claim Library (`/contribute/claim`)

- Form with affiliation role, department, verification method (email domain / vouching / contact us), evidence URL.
- On approval: creates `library-affiliation` record + sets `isVerifiedLibrarian: true` + `contributorRole: "verified_librarian"` on profile.
- Points: 10 on approval.
- **Note**: `contributorRole: "verified_librarian"` does not grant wiki editing access — that requires `wiki_editor` or `editorial_board`, assigned manually by staff.

### Correct Library (to be built)

- Entry: inline CTA on library detail page (contact panel + footer banner).
- No claim required. Any logged-in user.
- Form: category picker + freetext.
- Submits as `submissionType: "correction"`.
- Points: 2 on approval.

### My Submissions (`/contribute/submissions`)

- Lists all of the current user's submissions by type, status, and target. Wired.

### Community Leaderboard (`/contribute/community`)

- Ranks contributors by points. Wired.

---

## 5. Wiki

### Reading articles

- Fully wired. Static generation with 5-minute revalidation.
- **GAP**: `article.author` is a plain freetext string — no link to a user profile. This is correct for historical/guest authors (Wiki Author). Wiki Contributors (users whose edits have been approved) are not yet displayed.

### Editing articles (partially built — UI exists, backend gaps remain)

- Gated to `contributorRole: wiki_editor` or `editorial_board`.
- **GAP**: The gate is broken. API routes at `/api/contribute/wiki/[slug]` read `session.user.contributorRole` which is always `undefined` (not in the session). **Fix**: same session extension as above (Q5 resolution).
- UI: `WikiArticleEditContext` fetches `contributorRole` from `/api/profile/me` correctly on the client — this part works.
- Edit mode toggle, draft save, and finalize flow are built.
- On approval (`applyWikiEdit`): updates `title` and `body` on the Strapi article. Points: 5 (edit) or 15 (translation).
- **GAP**: `applyWikiEdit` uses `strapi.db.query` (Strapi v4 pattern) — must be updated to `strapi.documents()`.
- **GAP**: `applyWikiEdit` does not add the contributor to a `contributors` relation on the article. Both the schema field and the approval side-effect need to be added.

### Wiki attribution model (resolved)

- **Wiki Author**: original editorial author — freetext string on the article. For guest writers and historical attributions. Not linked to user profiles.
- **Wiki Contributor**: any user whose `wiki_edit` has been approved. Stored as a many-to-many relation (`wiki-article` → `user-profile`). Additive — every approved editor is added, never removed. Displayed on the article as a linked avatar list.
- **To build**: add `contributors` relation field to `wiki-article` schema; update `applyWikiEdit` to connect the submitter on approval; update `WikiArticlePage` to render the contributors list with profile links.

---

## 6. Points, Tiers & Badges

### Points (wired, with gaps)

Points are awarded on submission approval by the rewards plugin:

| Action                            | Points | Status                    |
| --------------------------------- | ------ | ------------------------- |
| `correction` approved             | 2      | **Not yet wired**         |
| `library_edit` minor (1–3 fields) | 5      | Wired                     |
| `library_edit` major (4+ fields)  | 15     | Wired                     |
| `library_claim` approved          | 10     | **Not yet wired**         |
| `wiki_edit` approved              | 5      | Wired                     |
| `wiki_edit` translation           | 15     | Wired                     |
| `new_library` approved            | 50     | Wired                     |
| `photo_licensed_cc`               | TBD    | Defined, no triggering UI |
| `hours_verified`                  | TBD    | Defined, no triggering UI |
| `status_verified`                 | TBD    | Defined, no triggering UI |

### Tiers (wired)

Reader (0) → Indexer (100) → Cartographer (500) → Archivist (1,500) → Scholar (4,000) → Curator (9,000). Computed from all-time points total. Currently cosmetic.

### Streak (wired)

Consecutive calendar days with an approved contribution. Tracked via `lastActivityDate` on profile. Resets if a day is missed.

### Badges (wired)

Checked and awarded after every point event via `rewards.badges.checkAndAward`. Defined in code; new badges require a deploy.

---

## 7. Contributor Role

Values (ascending privilege): `reader` → `contributor` → `verified_librarian` → `wiki_editor` → `editorial_board`.

| Role                 | How acquired                                   | What it unlocks                             |
| -------------------- | ---------------------------------------------- | ------------------------------------------- |
| `reader`             | Default on signup                              | Nothing beyond browsing                     |
| `contributor`        | Manual staff assignment                        | No current functional difference            |
| `verified_librarian` | Library Claim approved OR new library approved | Full edit diff access for claimed libraries |
| `wiki_editor`        | Manual staff assignment                        | Wiki article editing                        |
| `editorial_board`    | Manual staff assignment                        | Wiki article editing                        |

**Note**: `verified_librarian` does NOT grant wiki editing access. These are orthogonal tracks.

---

## 8. Gaps Summary

| #   | Gap                                                                        | Location                                            | Severity      |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------- |
| 1   | No onboarding redirect after signup/login                                  | `auth/register`, `auth/signin`                      | High          |
| 2   | `contributorRole` missing from BA session — wiki API gates always 403      | `lib/auth.ts`, `/api/contribute/wiki/*`             | High          |
| 3   | `correction` submissions don't award points (should be 2pts)               | `plugins/content-moderation/services/submission.ts` | Medium        |
| 4   | `library_claim` approvals don't award points (should be 10pts)             | `plugins/content-moderation/services/submission.ts` | Medium        |
| 5   | No "Suggest a correction" CTA on library detail pages                      | `LibraryHero`, `LibraryDetailPage`                  | Medium        |
| 6   | No `correction` submission form or route                                   | `/contribute/`                                      | Medium        |
| 7   | `applyWikiEdit` uses `strapi.db.query` (v4 pattern)                        | `plugins/content-moderation/services/submission.ts` | Medium        |
| 8   | `applyWikiEdit` doesn't add contributor to `contributors` relation         | Same file                                           | Medium        |
| 9   | `wiki-article` schema has no `contributors` relation field                 | `apps/strapi/src/api/wiki-article/`                 | Medium        |
| 10  | `WikiArticlePage` doesn't render Wiki Contributors                         | `components/wiki/WikiArticlePage.tsx`               | Low           |
| 11  | Following a library has no downstream effects (events feed, notifications) | Multiple                                            | Low (planned) |
| 12  | `SocialButtons.tsx` orphaned Strapi-OAuth remnant (never imported)         | `auth/signin/_components/SocialButtons.tsx`         | Resolved ✓    |
| 13  | `pendingReview` on Event — NOT dead code; used by sync-worker + admin ctrl | N/A                                                 | N/A           |
