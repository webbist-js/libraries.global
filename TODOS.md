# libraries.global — Open TODOs & Unfinished Work

_Last audited: 2026-09-24_

The v2 light/accessible UI rework is **done** across all routes (homepage, find-a-library `/index`, library detail, atlas pages, profile, blog/journal, wiki, events, auth, contribute, settings, map). Strapi is on 5.55.1. The monorepo typechecks with zero errors. What remains:

---

## HIGH — Blocks or degrades launch (target: 15 Oct 2026)

### 1. LibraryOn full ingest (~3,800 UK records)

The source dies when the British Library shuts libraryOn down on 15 Oct. Dry run done (`ingest-dry-log.json`); the full resumable run has not completed. See `docs/pre-golive-checklist.md` §2a. **Run this before anything else.**

### 2. MeiliSearch — secondary indexes + post-ingest scaling

- Local instance is `librariesglobal-meilisearch` on **:7701** (the :7700 container belongs to a different project). `library` index seeded via `apps/strapi/scripts/seed-meilisearch.mjs`.
- `blog-article` and `wiki-article` indexes not yet seeded on the new instance (blog/wiki search returns errors until then).
- After the UK ingest (>1,000 records), `/index`'s client-side "Open now" / "Has digital collections" / "Most complete first" computations hit MeiliSearch's fetch ceiling — index a completeness score and a filterable open-now-friendly schedule encoding, then move those to real facets.

### 3. CMS content tasks (Strapi admin)

- Populate homepage `featuredLibraries` — "Libraries worth knowing" is hidden while empty
- Add Wiki/knowledge-base link to a footer section (nav dropped it by design)
- Optionally set homepage heroTitle to the POC copy ("Every library has a story. _Find yours._") — code falls back to it if the field is emptied

### 4. Production deploy

Vercel (UI) + Strapi Cloud (backend) + production MeiliSearch. Full list: `docs/pre-golive-checklist.md` §4–6 (env rotation, OAuth callbacks, sitemap/robots checks).

---

## MEDIUM — Post-POC functional gaps

### 5. Revision history on library pages

POC's "Recent changes" list (Edit/Steward/Import badges) needs a per-library submissions read endpoint in the content-moderation plugin. UI slot exists (Sources section covers provenance meanwhile).

### 6. Profile privacy toggles

POC's "Manage what's public" fieldset needs a `publicPrefs` JSON field on `user-profile` (only the coarse `profileVisibility` enum exists). Banner currently links to settings.

### 7. Schema nice-to-haves from the POC

`nearestStation` (using `transitInfo` meanwhile), `wikidataId` (using `sourceUrl`), steward-user relation on Library (record status hardcoded "Community maintained"), "contributed to" relation for profile Libraries tab.

### 8. Real-browser WebGL check

Headless screenshots can't verify: map Voyager tiles + indigo pins, drill-down shelf, homepage/atlas globe canvases (dark-disc treatment on light bg — consider a lighter globe variant).

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

| Feature                         | Status                                             |
| ------------------------------- | -------------------------------------------------- |
| Events (sync-worker + UI)       | Sync-worker phase 1 done, typechecks; not launched |
| Collections content type        | Not started                                        |
| IIIF viewer on library detail   | Not started (external links shipped)               |
| 2FA (Better Auth twoFactor)     | Not started                                        |
| i18n expansion (FR, ES, AR, JA) | Not started                                        |
| Notification email delivery     | Prefs saved, no delivery mechanism                 |
| Visit log / annotations         | Not started                                        |
