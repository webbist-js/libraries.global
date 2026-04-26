# Settings Enhancements, Onboarding Flow & Profile Moderation — Design Spec

**Date:** 2026-04-26
**Scope:** Settings form improvements, `/onboarding` first-login route, library affiliation claims, topics taxonomy plugin, and content-moderation plugin extensions.

---

## 1. Overview

The current settings page has free-text fields for country and timezone, no avatar upload, and no library affiliation claim. This spec covers:

1. **Settings page enhancements** — country searchable dropdown, timezone searchable dropdown, avatar upload, pronouns, social links (ORCID, Mastodon, LinkedIn), profile visibility 3-card selector, interests chips, incomplete-profile CTA banner.
2. **`/onboarding` route** — a full-screen first-login flow covering identity, affiliation (library claim), interests & languages, and external links.
3. **Library affiliation claim flow** — MeiliSearch library lookup by country, email-domain auto-verification, vouching by verified librarian, and "contact us" fallback; claims stored as pending in content-moderation plugin.
4. **Topics taxonomy Strapi plugin** — `plugin::topics.topic` content type; M2M relations to user-profile, wiki-article, blog-article; user-suggested topics go through moderation.
5. **Content-moderation plugin extensions** — add `topic_suggestion` to submissionType; add `verificationMethod` field for library claims; enhance admin dashboard with type-specific detail panels.
6. **User-profile schema additions** — pronouns, affiliationType, claimed library fields, verification status/method, interests relation, languages JSON, social links, `profileVisibility: "limited"`.
7. **New Next.js API routes** — avatar upload proxy, username availability check, claim-library, suggest-topic.

---

## 2. Data Model Changes

### 2.1 User Profile Schema (`apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`)

New fields added to existing schema:

| Field                           | Type        | Notes                                                                          |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `pronouns`                      | enumeration | he_him, she_her, they_them, other, prefer_not_to_say                           |
| `affiliationType`               | enumeration | reader, librarian, researcher, archivist, educator, other                      |
| `claimedLibraryEntityRef`       | string      | e.g. `GB-BL-001` — stable entityRef                                            |
| `claimedLibraryName`            | string      | display name cached at claim time                                              |
| `claimedLibraryRole`            | string      | e.g. "Reference Librarian"                                                     |
| `claimedLibraryDepartment`      | string      | e.g. "Rare Books"                                                              |
| `affiliationVerificationStatus` | enumeration | unclaimed (default), pending, verified, rejected                               |
| `affiliationVerificationMethod` | enumeration | email_domain, vouching, contact_us                                             |
| `languages`                     | json        | array of `{ code: string, proficiency: "native"\|"fluent"\|"conversational" }` |
| `orcid`                         | string      | ORCID iD URL                                                                   |
| `mastodon`                      | string      | Mastodon/Bluesky handle                                                        |
| `linkedin`                      | string      | LinkedIn profile URL                                                           |
| `profileVisibility`             | enumeration | **add** `limited` to existing public/private                                   |
| `interests`                     | relation    | manyToMany to `plugin::topics.topic` (via join table)                          |
| `avatarStrapiId`                | string      | Strapi media ID (stored alongside existing `avatarUrl`)                        |

`profileVisibility: "limited"` means: username and avatar visible, bio/location/links hidden.

### 2.2 Content-Moderation Submission Schema

Modify `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json`:

- **Add** `topic_suggestion` to `submissionType` enum.
- **Add** `verificationMethod` field: `enumeration`, values `email_domain | vouching | contact_us`.
- **Add** `targetEntityType` value: `user_profile` (for topic suggestions and claim context).

The existing `fields` JSON column carries library claim specifics: `{ entityRef, name, role, department }`.

### 2.3 Topics Plugin (`apps/strapi/src/plugins/topics/`)

New Strapi plugin (minimal — content type + service + routes + admin list):

**Content type** (`plugin::topics.topic`):

| Field               | Type                     | Notes                                            |
| ------------------- | ------------------------ | ------------------------------------------------ |
| `name`              | string, required, unique | Display name                                     |
| `slug`              | uid from name            | URL-safe identifier                              |
| `status`            | enumeration              | approved (default for seeded), pending, rejected |
| `suggestedByUserId` | string                   | baUserId of suggester (null for seeded topics)   |
| `suggestedByEmail`  | string                   |                                                  |

Relations back from user-profile, wiki-article, blog-article are manyToMany — defined on the target content types, not on the topic itself.

**Admin page:** Simple table listing topics with Approve/Reject actions. Pending topics appear first. Approved topics are available as chips in onboarding/settings.

---

## 3. Library Affiliation Claim Flow

### 3.1 User Journey

1. User opens `/onboarding` (or Settings → Public Profile → "Claim a library" CTA).
2. Selects their `affiliationType` (reader/librarian/researcher/archivist/educator/other).
3. If librarian/archivist/researcher — claim section appears.
4. **Step 1 — Find library:** Dropdown of countries (static list). On country select: MeiliSearch query to `library` index filtered by `country_slug`. Results shown as a searchable list with library name, city, type.
5. **Step 2 — Role details:** Free-text role and department fields.
6. **Step 3 — Verification method:** System checks email domain against library's `website` field. Three outcomes:
   - **Auto-verified:** user email domain matches library website domain → `affiliationVerificationStatus: "verified"`, `affiliationVerificationMethod: "email_domain"`. No submission created.
   - **Vouching offered:** Library has ≥1 verified librarian. User can request vouching → submission created as `library_claim / pending / verificationMethod: vouching`. Toast: "Your claim is pending verification by a verified librarian at this institution."
   - **Contact us:** No verified librarians and no domain match → `verificationMethod: contact_us`. Submission created. Toast: "Your claim has been submitted. Our team will verify and get back to you."
7. User continues — profile remains fully usable while pending.

### 3.2 Email Domain Matching

- Extract domain from `user.email` (everything after `@`).
- Extract domain from library `website` field (strip protocol, `www.`, path).
- If `emailDomain === libraryWebsiteDomain` → auto-verify.
- Logic lives server-side in the `/api/profile/me/claim-library` Next.js route handler.

### 3.3 Vouching Flow

When a claim with `verificationMethod: vouching` is submitted:

- Moderators (and verified librarians at the same library, if we expose an endpoint) can see the pending claim in the content-moderation admin dashboard.
- Approving sets `affiliationVerificationStatus: "verified"` on the user profile via the upsert-profile bridge.
- Rejecting sets `affiliationVerificationStatus: "rejected"`.
- For now, only Strapi admins approve via the moderation dashboard. Peer-librarian vouching UX is deferred.

### 3.4 MeiliSearch Library Lookup

`meiliClient.index("library").search(query, { filter: "country_slug = 'gb'" })`.

The `country_slug` attribute must be listed in MeiliSearch filterableAttributes for the `library` index. This is added in a Strapi bootstrap or migration step.

---

## 4. `/onboarding` Route

### 4.1 Structure

Route: `app/[locale]/onboarding/page.tsx` — RSC shell, auth guard (redirect to sign-in if no session), full-screen layout (no GlobalHeader chrome — custom back/skip).

The onboarding state is client-side only (not persisted until "Finish" is clicked per section, or final submit). Each section submits independently via `PUT /api/profile/me`.

**Sections (linear wizard, each on its own screen):**

1. **Identity** — Avatar upload, Display name (firstName + lastName), Username (with real-time availability check), Pronouns dropdown, City + Country.
2. **Affiliation** — 4 role type cards (Reader / Librarian/Archivist / Researcher / Other). Conditional library claim search (only for Librarian/Archivist/Researcher). Claim flow inline (country dropdown → library search → role + dept → verification outcome).
3. **Interests & Languages** — Topic chips (load approved topics from Strapi). Language picker with proficiency selector. User can type to suggest a new topic (fires `POST /api/profile/me/suggest-topic`).
4. **External Links** — Website, ORCID, Mastodon/Bluesky, LinkedIn. All optional.
5. **Profile Visibility** — Three large cards: Public (all visible), Limited (name/avatar only), Private (only you). Selecting auto-saves.
6. **Done** — Confirmation with "Enter your profile" CTA → `/profile/[username]`.

### 4.2 Skip Behaviour

- Each section has "Skip for now" — advances to next section without saving that section.
- Header has "Finish later" → saves whatever has been entered so far and redirects to home.
- Onboarding is considered "complete" when `firstName` AND `username` are set (already handled by auto-generation at registration, so the CTA is optional).

### 4.3 Incomplete Profile CTA in Settings

In `PublicProfileSection.tsx`, if `profile.firstName` is empty OR `profile.affiliationType` is null → render a top-of-form banner:

> "Complete your profile to connect with libraries and the community. [Complete profile →]" linking to `/onboarding`.

---

## 5. Settings Page Enhancements

All changes are to `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`:

### 5.1 Country Dropdown

- Replace free-text `country` field with a searchable combobox (Radix Popover + Command).
- Data source: static JSON list of ISO countries (`{ code: string, name: string }[]`). Extract from existing Strapi country data or bundle a lightweight static list (`lib/data/countries.ts`, ~250 entries, ~8 KB).
- Stores ISO2 code in `profile.country`.

### 5.2 Timezone Dropdown

- Replace free-text `timezone` field with a searchable combobox.
- Options built from `Intl.supportedValuesOf('timeZone')` (browser API, ~600 values).
- Grouped by region prefix (Africa/, America/, Asia/, etc.).
- Stores IANA timezone string.

### 5.3 Avatar Upload

- Avatar area becomes a clickable upload target (hidden `<input type="file" accept="image/*">`).
- On file select: POST to `/api/profile/me/avatar` (new route).
- `/api/profile/me/avatar` proxies the file to Strapi's `POST /api/upload` (multipart/form-data, `X-Service-Secret` header), receives the upload response, extracts `[0].url`, then calls `upsert-profile` with `{ avatarUrl: url, avatarStrapiId: id }`.
- Show upload progress (simple loading state). On success, update the preview in-place.
- Max size enforced client-side: 5 MB. Accept: image/jpeg, image/png, image/webp.

### 5.4 Pronouns, Social Links, Profile Visibility

- Add `pronouns` select (he/him, she/her, they/them, other, prefer not to say) below username.
- Add ORCID, Mastodon, LinkedIn string fields in an "External links" section below website.
- Replace the single `profileVisibility` select with 3 clickable cards: Public / Limited / Private.

### 5.5 Interests Chips

- New "Interests" section with chip-style multi-select.
- Load approved topics from `GET /api/topics` (new Next.js route that proxies Strapi plugin endpoint).
- Selected topics stored as topic IDs on the user profile via `interests` relation.
- "Suggest a topic" text input at the end of the chip list — fires `POST /api/profile/me/suggest-topic`.

---

## 6. Content-Moderation Admin Enhancements

Modify `apps/strapi/src/plugins/content-moderation/admin/src/pages/ModerationDashboard.tsx`:

- Add `topic_suggestion` filter tab.
- For `library_claim` rows: expand panel shows claimed library name, entityRef, role, department, verification method, submitter email, and domain comparison result.
- For `topic_suggestion` rows: show suggested topic name, submitter.
- Approval action for `library_claim`: calls a new Strapi service method that updates the target user-profile's `affiliationVerificationStatus` to `verified`.
- Approval action for `topic_suggestion`: calls topics service to set status `approved`.

A new internal Strapi service method `approveClaim(submissionDocumentId)` in the content-moderation plugin controller handles the profile update via `strapi.documents("api::user-profile.user-profile")`.

---

## 7. New Next.js API Routes

| Route                           | Method | Purpose                                               |
| ------------------------------- | ------ | ----------------------------------------------------- |
| `/api/profile/me/avatar`        | POST   | Upload avatar — multipart proxy to Strapi /api/upload |
| `/api/profile/check-username`   | GET    | `?username=foo` — check uniqueness against Strapi     |
| `/api/profile/me/claim-library` | POST   | Submit library affiliation claim                      |
| `/api/profile/me/suggest-topic` | POST   | Submit topic suggestion to moderation                 |
| `/api/topics`                   | GET    | List approved topics (for chips)                      |

All routes require a valid Better Auth session. `claim-library` and `suggest-topic` create content-moderation submissions via the Strapi bridge with `X-Service-Secret`.

---

## 8. New Strapi Endpoints

### 8.1 Topics Plugin Routes

| Route                  | Method | Auth         | Purpose                          |
| ---------------------- | ------ | ------------ | -------------------------------- |
| `GET /topics/approved` | public | none         | List approved topics (for chips) |
| `GET /topics`          | admin  | Strapi admin | All topics (moderation)          |

### 8.2 Content-Moderation Bridge Route

New Strapi route in auth-bridge (or content-moderation plugin):

`POST /api/auth-bridge/approve-claim` — accepts `{ submissionDocumentId }`, validates `X-Service-Secret`, calls `approveClaim()` service, returns updated profile snippet.

---

## 9. Component Architecture

### New components

| Component               | Path                                               | Purpose                               |
| ----------------------- | -------------------------------------------------- | ------------------------------------- |
| `CountryCombobox`       | `components/ui/CountryCombobox.tsx`                | Searchable country select             |
| `TimezoneCombobox`      | `components/ui/TimezoneCombobox.tsx`               | Searchable timezone select            |
| `AvatarUpload`          | `settings/_components/AvatarUpload.tsx`            | Click-to-upload avatar with preview   |
| `VisibilityCards`       | `settings/_components/VisibilityCards.tsx`         | 3-card profile visibility selector    |
| `InterestsChips`        | `settings/_components/InterestsChips.tsx`          | Topic chips + suggest input           |
| `OnboardingShell`       | `onboarding/_components/OnboardingShell.tsx`       | Wizard navigation + skip/finish-later |
| `OnboardingIdentity`    | `onboarding/_components/OnboardingIdentity.tsx`    | Step 1                                |
| `OnboardingAffiliation` | `onboarding/_components/OnboardingAffiliation.tsx` | Step 2 + library claim                |
| `LibraryClaimSearch`    | `onboarding/_components/LibraryClaimSearch.tsx`    | Country → MeiliSearch flow            |
| `OnboardingInterests`   | `onboarding/_components/OnboardingInterests.tsx`   | Step 3                                |
| `OnboardingLinks`       | `onboarding/_components/OnboardingLinks.tsx`       | Step 4                                |
| `OnboardingVisibility`  | `onboarding/_components/OnboardingVisibility.tsx`  | Step 5                                |

### Modified components

- `PublicProfileSection.tsx` — add incomplete CTA, country/timezone comboboxes, avatar upload, pronouns, social links, visibility cards, interests chips.
- `GlobalLoggedUserMenu.tsx` — no changes needed.
- `ModerationDashboard.tsx` — add topic_suggestion tab + claim detail panel.

---

## 10. Static Data

- `apps/ui/src/lib/data/countries.ts` — `{ code: string, name: string }[]` for all ISO-3166-1 alpha-2 countries. ~250 entries, bundled (not fetched). Used in CountryCombobox and onboarding.
- `apps/ui/src/lib/data/timezones.ts` — thin wrapper: `export const TIMEZONES = Intl.supportedValuesOf('timeZone')`. Grouped by first path segment.

---

## 11. Parallel Agent Decomposition

This work decomposes into four independent streams:

| Stream                        | Work                                                                                                                                                           | Dependencies                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **A — Strapi backend**        | User-profile schema additions; topics plugin; content-moderation extensions; auth-bridge approve-claim route                                                   | None                                                      |
| **B — Settings enhancements** | CountryCombobox, TimezoneCombobox, AvatarUpload, VisibilityCards, InterestsChips; update PublicProfileSection; new API routes (avatar, check-username, topics) | Needs Stream A Strapi schema deployed first (or can mock) |
| **C — Onboarding route**      | /onboarding wizard; all step components; LibraryClaimSearch (MeiliSearch + email domain check); claim-library and suggest-topic API routes                     | Needs Stream A Strapi schema deployed first               |
| **D — Moderation admin**      | ModerationDashboard topic_suggestion tab; library_claim detail panel; approve-claim action                                                                     | Needs Stream A content-moderation schema changes          |

Stream A ships first (schema changes gating all UI). B, C, D can proceed in parallel after A.

---

## 12. Error Handling & Edge Cases

- **Username taken during onboarding:** real-time debounced `GET /api/profile/check-username?username=X`. Show inline availability indicator. Auto-suggest `username_1` etc.
- **Avatar upload failure:** toast error, keep existing avatar, no form submission blocking.
- **MeiliSearch unavailable:** show "Search unavailable" message with fallback text field for library name.
- **Email domain match false positives:** domain matching is advisory only — it auto-verifies but does not prevent future claims. Admin can reject via moderation dashboard.
- **Duplicate claim:** if user already has a pending or verified claim, the claim section in onboarding and settings shows current claim status ("Pending verification" / "Verified at [Library Name]") instead of the claim form.
- **Topics relation not yet on wiki/blog:** The `interests` relation is added to user-profile only in this spec. Attaching topics to wiki-article and blog-article is deferred — the topic content type is designed for it but no migration to those content types in this delivery.

---

## 13. Out of Scope

- Document/file uploads for verification (explicitly excluded).
- Peer-librarian vouching UI (deferred — claims handled by admins via moderation dashboard only).
- Topics on wiki-article / blog-article (deferred).
- Events or contribution tracking (separate future pillars).
- Email notifications for claim status changes (infrastructure exists, wiring deferred).
