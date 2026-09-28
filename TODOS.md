# libraries.global — Open TODOs & Unfinished Work

_Last audited: 2026-09-28_

The v2 light/accessible UI rework is **done** across all routes (homepage, find-a-library `/libraries`, library detail, atlas pages, profile, journal, knowledge, events, auth, contribute, settings, map). Strapi is on 5.55.1. The monorepo typechecks with zero errors.

**Phases done:** P-A security hardening (A1–A13), P-B access model and session (`@repo/access`, session capabilities and entitlements, the Strapi `submission-policy`, the 60 s bridge cache, the role-matrix E2E) and P-D0 Pro without payments (admin grants, verifications and earned Pro; `/pro`; Atlas export). What remains:

---

## HIGH — Blocks or degrades launch (target: 15 Oct 2026)

### 1. LibraryOn full ingest (~3,800 UK records)

The source dies when the British Library shuts libraryOn down on 15 Oct. Dry run done (`ingest-dry-log.json`); the full resumable run has not completed. See `docs/pre-golive-checklist.md` §2a. **Run this before anything else.**

### 2. MeiliSearch — secondary indexes + post-ingest scaling

- Local instance is `librariesglobal-meilisearch` on **:7701** (the :7700 container belongs to a different project). `library` index seeded via `apps/strapi/scripts/seed-meilisearch.mjs`.
- `blog-article` and `wiki-article` indexes not yet seeded on the new instance (blog/wiki search returns errors until then).
- After the UK ingest (>1,000 records), `/libraries`' client-side "Open now" / "Has digital collections" / "Most complete first" computations hit MeiliSearch's fetch ceiling — index a completeness score and a filterable open-now-friendly schedule encoding, then move those to real facets.

### 3. CMS content tasks (Strapi admin)

- ~~Populate homepage `featuredLibraries`~~ — done (populated in the local CMS)
- ~~Add Wiki/knowledge-base link to a footer section~~ — done ("Knowledge" under Contribute; "Plans & Pro" added under Explore on 2026-09-28)
- ~~Optionally set homepage heroTitle to the POC copy~~ — resolved: heroTitle is set to its own copy; code still falls back to the POC line if emptied

### 4. Production deploy

Vercel (UI) + Strapi Cloud (backend) + production MeiliSearch. Full list: `docs/pre-golive-checklist.md` §4–6 (env rotation, OAuth callbacks, sitemap/robots checks).

---

## MEDIUM — Post-POC functional gaps

### 5. ~~Revision history on library pages~~ — done

The content-moderation plugin serves `GET /libraries/:documentId/revisions`, and the library page's Sources section lists "Recent changes". P-A (A10) keeps rejected submissions and private or limited profiles out of public history.

### 6. ~~Profile privacy toggles~~ — done

`user-profile.publicPrefs` (location, verified affiliation, activity graph, libraries followed) is live, with the owner-only "Manage what's public" fieldset on the profile. Strapi enforces it (`applyPublicPrefs`, `isActivityPublic`). On top of `profileVisibility`, a `limited` profile hides activity and badges from anyone who doesn't share a library with the owner (P-A A10 and P-B, decision I8).

### 7. Schema nice-to-haves from the POC

Done: `nearestStation` and `wikidataId` (schema and library page). Still open: a steward-user relation on Library (record status is hardcoded "Community maintained"), and a "contributed to" relation for the profile Libraries tab.

### 8. Real-browser WebGL check

Headless screenshots can't verify: map Voyager tiles + indigo pins, drill-down shelf, homepage/atlas globe canvases (dark-disc treatment on light bg — consider a lighter globe variant).

---

## Deferred to P-C (from the P-B review)

- `topContributors` slices before it filters out hidden profiles; also the owner's own history path (M7)
- `/api/upload`: a Strapi-side gate and the `uploadsPerDay` quota (M11)
- A library-scoped `hasCapability`, and a `{ user } | { response }` route helper (M12)
- I6: the wiki editor still sends a numeric `submissionId`
- The event-feed page checks `isVerifiedLibrarian` instead of the `events.feed` capability
- The access E2E leaves one reader draft per run
- The fixture writer should fall back to `PGHOST` before `localhost` when the host is empty
- `--project=access` detection is case-sensitive

---

## LOW — Polish / cleanup

- Blog card components still use the `--font-fraunces` alias (maps to Newsreader) — remove alias with their next restyle
- Wiki + contribute retain dense mono-uppercase micro-labels — optional typography polish toward POC restraint
- `/profile/[username]/contributions` sub-page micro-labels — same
- Old Collections stub route reachable by URL only (`/profile/[username]/collections`)
- Deprecated `auroraCta*` constants in `lib/styles.ts` still used by 3 contribute wizard components — replace with indigo pills, then delete constants
- `strapi-plugin-meilisearch` lifecycle hooks vs seed script: confirm hooks index on publish against :7701 (plugin store may need re-enabling in admin)

---

## Feature backlog (unchanged priorities)

| Feature                          | Status                                                                     |
| -------------------------------- | -------------------------------------------------------------------------- |
| Events (sync-worker + UI)        | Sync-worker phase 1 done, typechecks; not launched                         |
| Collections content type         | Not started                                                                |
| IIIF viewer on library detail    | Not started (external links shipped)                                       |
| 2FA (Better Auth twoFactor)      | Not started                                                                |
| i18n expansion (FR, ES, AR, JA)  | Not started                                                                |
| Notification email delivery      | Prefs saved, no delivery mechanism                                         |
| Visit log / annotations          | Not started                                                                |
| Pro checkout (Stripe, P-D1)      | Not started; Pro comes only from grants, verification and earned Archivist |
| Self-serve Pro verification (C5) | Not started; staff create `pro-verification` rows by hand                  |
