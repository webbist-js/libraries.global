# Strapi Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding from the 2026-09-29 Strapi security, bug and performance review (leaks, privilege escalation, admin XSS, SSRF, the ignored `pagination` option, missing indexes, JS-side aggregation) without changing product behaviour.

**Architecture:** Six work packages, one per subsystem, each touching a disjoint set of files so they can run in parallel in the main working tree. Shared concerns are assigned to exactly one package: all new DB indexes live in one migration (WP-E), `config/cron-tasks.ts` belongs to WP-D, `config/plugins.ts` and `config/middlewares.ts` to WP-A, `auth-bridge.ts` to WP-E. Every task adds or extends a Vitest test that fails before the fix.

**Tech Stack:** Strapi 5.55.1 (Document Service, knex via `strapi.db.connection`), Next.js 16, Vitest, Postgres. Tests use the fake-strapi helper in `apps/strapi/tests/helpers/fake-strapi.ts`.

## Global Constraints

- **Node 22**: run `source ~/.nvm/nvm.sh && nvm use 22` in every shell (the default shell is v20).
- **Do not commit.** The tree holds 51 uncommitted files of in-flight work (option suggestions). Never revert, stash, checkout or reformat files you were not asked to change. Leave your changes in the working tree; the user decides on commits.
- **Strapi v5 rules:** `strapi.documents()` for reads and writes; `strapi.db.connection` (knex) only for aggregates and index DDL. `strapi.documents().findMany` **ignores `pagination: {}`** — use flat `start`/`limit` (or `page`/`pageSize`) and always a stable `sort`.
- **Never add `Co-Authored-By`** lines anywhere.
- **Verification per package:** `cd apps/strapi && pnpm vitest run --exclude tests/app.test.ts` (265 pass at baseline) and `pnpm typecheck`; `cd apps/ui && pnpm test && pnpm typecheck`; `cd apps/sync-worker && pnpm test`; `cd packages/events-crypto && pnpm test`. Run only what your package touches, plus the Strapi suite if you touched `apps/strapi`.
- Bridge-secret checks, `strip-draft-status`, `readStatus`, the record-apply allowlist and the points idempotency index are correct today. Don't restructure them.

---

## WP-A: Config-level leaks (Meilisearch, Sentry, CSP, dead artefacts)

**Files:** `apps/strapi/config/plugins.ts`, `apps/strapi/config/middlewares.ts`, `apps/strapi/strapi-export.tar.gz` (delete), `apps/strapi/src/plugins/topics/` (delete), `apps/strapi/scripts/seed-meilisearch.mjs` (read for the intended shape), `apps/strapi/tests/meilisearch-config.test.ts` (new).

### Task A1: Explicit `entriesQuery` and `displayedAttributes` for every Meilisearch index

Finding: `blog-article` and `wiki-article` have no `entriesQuery`, so the plugin populates `*` and `...entry` copies whole `user-profile` rows (incl. `baUserId`, names, `notifPrefs`, `earnedProUntil`) into the index that the browser's public search key can read. Confirmed live on the local `blog-article` index. The `library` index has no `entriesQuery` either (pulls all components, media and blocks on every reindex).

- [x] Write `apps/strapi/tests/meilisearch-config.test.ts`: import the plugins config with a stub `env`, and assert for each of `blog-article`, `wiki-article`, `library`, `plugin::events.event` that `entriesQuery.fields` is an array, `entriesQuery.populate` is an object whose every relation has a `fields` array, that `contributors` (if present) populates only `["username"]`, and that `settings.displayedAttributes` is a non-empty array not containing `baUserId`, `notifPrefs`, `publicPrefs`, `earnedProUntil`, `firstName`, `lastName`, `createdBy`, `updatedBy`.
- [x] Run it, confirm it fails.
- [x] Add `entriesQuery` to the three entries. Articles: `fields: ["title","slug","summary","author","publishedAt","updatedAt"]`, `populate: { section: { fields: ["slug","name"] }, category: { fields: ["slug","name"] }, heroImage: { fields: ["url","alternativeText","formats"] } }`. Do not populate `contributors`. Library: match what `apps/ui/src/lib/meilisearch.ts` and `scripts/seed-meilisearch.mjs` read (name, slug, libraryType, operationalStatus, city, location, summary, foundedYear, `continent/country/region` with `fields: ["slug","name"]` (+ `iso2` on country), `accessibility/services/amenities` with `fields: ["name"]`, `heroImage` with `fields: ["url","formats"]`). In each `transformEntry`, build the document from an explicit allowlist instead of `...entry`.
- [x] Add `displayedAttributes` to every index's `settings` listing exactly the indexed keys.
- [x] Run the test; run the Strapi suite; `pnpm typecheck`.
- [x] Note in your report: the live indexes must be wiped and reindexed (`node apps/strapi/scripts/seed-meilisearch.mjs` for `library`; the plugin's admin "update" for articles) and the public key must allow only `search` on the four indexes. Don't run these.

### Task A2: Sentry `beforeSend` scrubbing

Finding: `config/plugins.ts:234-241` has no `beforeSend`, so a thrown error in a bridge route ships `X-Service-Secret`, `Authorization`, cookies and the JSON body (email, name, bio) to Sentry.

- [x] Extract the scrubber to `apps/strapi/src/utils/sentry-scrub.ts` exporting `scrubSentryEvent(event)`: deletes `event.request.headers` keys `x-service-secret`, `authorization`, `cookie`, `x-ba-user-email`, `x-ba-user-name` (case-insensitive), deletes `event.request.cookies` and `event.request.data`, and sets `event.user` to `{ id: event.user?.id }` only.
- [x] Test `apps/strapi/tests/sentry-scrub.test.ts` with an event carrying all of those; assert they are gone and `url`/`method` survive.
- [x] Wire `beforeSend: scrubSentryEvent` and `sendDefaultPii: false` into the Sentry `init` config in `config/plugins.ts`.

### Task A3: CSP, export archive, topics plugin

- [x] `config/middlewares.ts:42`: remove the unquoted `"unsafe-inline"` entry from `script-src` (it's parsed as a host named `unsafe-inline` and does nothing). Don't add quotes.
- [x] Delete `apps/strapi/strapi-export.tar.gz` (a Strapi 5.33 export that grants Public `users-permissions.user.find` and `auth.register`). Check `.gitignore`/scripts for references first.
- [x] Delete `apps/strapi/src/plugins/topics/` and its `config/plugins.ts` entry (`enabled: false`, defines the same `topics_topics` collection as `api::topic`, and its array-form routes would register as admin routes with no `hasPermissions`). Remove any workspace reference in `apps/strapi/package.json` and `pnpm-workspace.yaml`; check `packages/strapi-types` and `types/generated/contentTypes.d.ts` for `plugin::topics` and regenerate or hand-remove. Grep the UI for `plugin::topics` / `/api/topics/` to confirm nothing depends on the plugin (the live `api::topic` stays).
- [x] Strapi suite + typecheck.

---

## WP-B: content-moderation plugin

**Files:** everything under `apps/strapi/src/plugins/content-moderation/` (server and `admin/src/components/SubmissionPanels.tsx`), `packages/shared-data/content-safety.ts`, tests under `apps/strapi/tests/content-moderation/`. Do **not** touch `auth-bridge.ts` (WP-E does the session side of B2) or the migrations dir (WP-E adds the vote unique index; write your code to tolerate a unique violation).

### Task B1: Finalize checks what it writes; admin renders only http(s) links

Findings: `controllers/submission.ts:393-405` runs `checkContent` on `existing.fields` while `services/submission.ts:931-937` writes `fields` from the request body. `admin/src/components/SubmissionPanels.tsx:220` renders `<Link href={l.url}>` unchecked (React 18 doesn't block `javascript:`). `services/submission.ts:321-329,415` writes `socialLinks` with only a `platform && url` filter.

- [x] Test (extend `tests/content-moderation/drafts.test.ts` or `content-safety.test.ts`): create a `new_library` draft with clean fields, finalize with a body whose `socialLinks[0].url` is `javascript:alert(1)` and `name` is a blocked term; assert the finalize is refused with the policy verdict and the row stays `draft`.
- [x] Fix `beforeTransition`: build `fields` from the finalize body the same way `finalizeDraft` does (body minus `editSummary`, `evidenceType`, `evidenceUrl`, `note`), fall back to `existing.fields` only when the body carries no library fields, and pass that to `checkContent`. Put the "split body into fields + extras" logic in one exported helper in `services/submission.ts` so both call sites share it.
- [x] `new_library` apply: keep a social link only when `url` matches `/^https?:\/\//i` (reuse the check `utils/library-record.ts:306` uses; export it from there if it isn't). Same for `website`.
- [x] Admin: add `isHttpUrl(url)` in `admin/src/components/submissionMeta.ts` and render `SocialLinksPanel` links (and any other `href` from contributor data in `SubmissionPanels.tsx`, `RecordChangesPanel.tsx`) as plain text when it fails.
- [x] Run the plugin tests.

### Task B2: A proposer affiliation is not a claim

Finding: `services/submission.ts:452-458` records `role: "proposer"`; `services/submission-policy.ts:50-66` treats every affiliation as a claim → `submit.libraryEdit` + `events.feed` without a Library Claim.

- [x] Test in `tests/content-moderation/policy-wiring.test.ts`: a user whose only affiliation has `role: "proposer"` gets `canSubmit("library_edit")` refused; one with `role: "staff"` (or whatever `library_claim` writes — read `utils/affiliations`/`upsertAffiliation`) is allowed.
- [x] In `loadCapabilities`, filter affiliations with `role: { $ne: "proposer" }`. Define `const NON_CLAIM_AFFILIATION_ROLES = ["proposer"]` locally in `submission-policy.ts` (WP-E defines its own copy in `src/utils/affiliations.ts`; do not edit that file).

### Task B3: Apply never publishes unrelated draft changes

Finding: `utils/library-record.ts:466-471`, `utils/library-photo.ts:98-108`, `utils/facility-answers.ts:145-150`, `utils/option-suggestions.ts:254-264`, `utils/article-apply.ts:392-397` call `update({ status: "published" })`, which publishes the whole draft version, including an admin's unfinished CM edits, and publishes `PENDING-` libraries that were never reviewed.

- [x] Add `utils/publish-guard.ts` exporting `async function loadPublishedTarget(strapi, uid, documentId, { locale })` that returns the published row or `null`, and `async function applyToPublished(strapi, uid, documentId, data, { locale })` that: (1) refuses (throws `ApplyRefusedError("not_published")`) when there is no published version; (2) loads draft and published versions with the same `fields` (the allowlisted scalar fields, no relations) and, if they differ on any key outside `data`, writes `data` to the draft only and returns `{ mode: "draft_only", divergentKeys }`; (3) otherwise writes `data` with `status: "published"` and returns `{ mode: "published" }`.
- [x] Tests in `tests/content-moderation/apply-targets.test.ts`: unpublished target → refused, approval reverts to pending with a `reviewNote` telling the moderator; divergent draft → draft-only write and the returned mode; clean → published.
- [x] Route the five apply paths through it. Surface `draft_only` in the approval result / `reviewNote` ("Applied to the draft; the record has unpublished admin edits").

### Task B4: Points never come from contributor-controlled fields

Finding: `services/submission.ts:750-764` awards 25/30 for `fields.kind === "new_article"` and 15 for `fields.isTranslation`; `article-apply.ts:308` branches on `fields.kind`.

- [x] Test in `tests/content-moderation/article-apply.test.ts`: a `wiki_edit` whose `fields.kind = "new_article"` but whose `draftData.kind` is an edit awards the edit amount and takes the edit path.
- [x] Derive "new" from `draftData.kind` only; derive "translation" server-side: target article exists in the source locale and `draftData.locale` has no version yet. Ignore `fields.kind`/`fields.isTranslation` everywhere.

### Task B5: content-safety hardening

Finding: `packages/shared-data/content-safety.ts:196` returns pass past depth 12; `:213` skips any key ending in `Id`/`Ids` (incl. `wikidataId`); `:158` `decodeURIComponent` throws on malformed `%`; `utils/wiki-body.ts:9-23` `clampBlocks` keeps any depth.

- [x] Tests in `tests/content-moderation/content-safety.test.ts`: a blocked term nested 14 levels deep is caught; `wikidataId: "<slur>"` is caught while `targetDocumentId`/`libraryDocumentIds` are still skipped; a `%E0%A4%A` value doesn't throw.
- [x] Depth overflow → return a `too_deep` violation. Replace the suffix rule with an exact allowlist of machine keys (`documentId`, `targetDocumentId`, `libraryDocumentId(s)`, `fileId(s)`, `uploadIds`, `id`, `baUserId`, and the `connect`/`disconnect` id arrays). Wrap decode in try/catch (treat failure as the raw string). Cap block nesting in `sanitizeWikiBody` (drop nodes deeper than 8).

### Task B6: Vote race, queue N+1, votes aggregate, stats

- [x] `utils/option-suggestions.ts:184-198` `toggleVote`: create first and catch the unique violation (Postgres `23505`, or the `UNIQUE constraint` message on sqlite) as "already voted", then toggle to delete. Test: two concurrent `toggleVote` calls for one user leave exactly one vote (simulate the second create throwing 23505 in the fake).
- [x] `utils/option-suggestions.ts:134-138` `listOpen`: replace the 100k-row vote load with `strapi.db.connection("cm_option_votes").select("suggestion_document_id").count("* as votes").groupBy("suggestion_document_id")` plus one `findMany` for the viewer's own votes (`filters: { baUserId }`, `fields: ["suggestionDocumentId"]`). Read the actual table/column names from the schema's `collectionName`.
- [x] `services/submission.ts:189-198` admin queue: batch the `recordReview` library lookups into one `findMany({ filters: { documentId: { $in } } })` and the option lookups into one per list; pass the maps into `recordReview` (add an optional `preloaded` argument, keep the old signature working).
- [x] `controllers/submission.ts:50-89` `stats`: use `strapi.documents().count()`, compute `todayStart` in UTC, memoise for 60 s in module scope, set `Cache-Control: public, max-age=60`.

### Task B7: Small correctness items

- [x] `saveDraft`/`finalizeDraft` (`services/submission.ts:857-882, 938-959`): validate `evidenceType` against the schema enum (read it from `strapi.contentType(uid).attributes.evidenceType.enum`), cap `editSummary` at 255 and `evidenceUrl`/`note` at their schema lengths, drop unknown keys. Test: an unknown `evidenceType` is rejected with a 400-style verdict, not stored.
- [x] Admin `findAll` (`controllers/submission.ts:25`, `services/submission.ts:174-176`): accept `status` only from `["pending","approved","rejected","needs_info"]`; never `draft`; ignore non-strings.
- [x] Public `findPublicByBaUserId` (`services/submission.ts:1051-1108`): show only `approved` items.
- [x] `new_library` apply (`services/submission.ts:388-440`): pass relation ids through `isDocumentId` and drop unknown ones before `connect`.
- [x] `topic_suggestion` review: include the resolved topic name in the admin review payload (`utils/record-review.ts` or the controller's `findOne`) so the moderator sees what `targetDocumentId` points at.
- [x] Self-approval (`controllers/submission.ts:288-301`): keep the email check and also refuse when the admin's email matches the submitter's `submittedByEmail` case-insensitively after trimming. Set `"visible": false` on the submission content type's `content-manager` pluginOptions only if the admin dashboard doesn't rely on the CM edit view (check `ModerationDashboard.tsx` for CM links; if it does, leave visibility and note it).
- [x] Wrap `updateStatus`'s CAS plus the apply side effects (library/article/affiliation/role/marker) in `strapi.db.transaction(async () => { ... })`; keep points and quick-wins outside, after commit. Test in `apply-failures.test.ts`: a throw in the marker update leaves the status `pending` and the library unchanged (the fake's transaction helper — add one to `tests/helpers/fake-strapi.ts` if missing: run the callback, on throw discard the writes recorded during it).
- [x] Replace `pagination: {}` in `controllers/submission.ts:254` with `start`/`limit` + `sort`.
- [x] Plugin tests + Strapi suite + typecheck. Rebuild the plugin if `dist/` is committed (`pnpm --filter content-moderation build` or the repo's `build:plugins`).

---

## WP-C: events plugin, sync-worker, events-crypto

**Files:** `apps/strapi/src/plugins/events/**`, `apps/sync-worker/**`, `packages/events-crypto/**`, a new migration `apps/strapi/database/migrations/2026.09.30T00.00.02.events-unique-external-id.js` (this one file only), `apps/ui/src/components/events/EventsAgenda.tsx` (href scheme only).

### Task C1: Admin RBAC on every events admin route

Finding: `server/routes/admin.ts` uses only `admin::isAuthenticatedAdmin`; `strapi-server.ts:9-16` registers `plugin::events.read` but nothing checks it.

- [x] Register actions `read`, `manage-credentials`, `review` (mirror `rewards/server/routes/admin.ts:1-7` and its bootstrap registration).
- [x] Every route gets `{ name: "admin::hasPermissions", config: { actions: [...] } }`: list/get → `read`; credential create/update/delete/test/sync → `manage-credentials`; approve/delete events → `review`.
- [x] Test `tests/events/admin-routes.test.ts` (new dir; copy the shape of `tests/content-moderation/admin-routes.test.ts`): every admin route has both policies and a non-empty `actions` list.

### Task C2: SSRF guard in the worker

Finding: `apps/sync-worker/src/lib/safe-fetch.ts:59` matches only dotted `::ffff:1.2.3.4`; WHATWG URL normalises `[::ffff:169.254.169.254]` to `::ffff:a9fe:a9fe`. NAT64 `64:ff9b::/96`, 6to4 `2002::/16`, `::a.b.c.d` unblocked. No timeout, no size cap. Spydus (`providers/spydus.ts:72-73`) echoes response bodies into errors.

- [x] Tests in `apps/sync-worker/tests/lib/safe-fetch.test.ts`: `::ffff:7f00:1`, `::ffff:a9fe:a9fe`, `64:ff9b::7f00:1`, `2002:7f00:1::`, `::7f00:1`, `[::ffff:127.0.0.1]` as given to `new URL` — all blocked; a fetch whose body exceeds the cap rejects; a hanging server rejects on timeout (use a local `http.createServer`).
- [x] Add `ipaddr.js` to the worker; parse every address to bytes, unwrap mapped/compat/NAT64/6to4 to the embedded v4, then apply the existing v4/v6 block lists. Pin the resolved IP with an undici `Agent({ connect: { lookup } })` so DNS can't change between check and connect. `AbortSignal.timeout(15_000)`; stream the body and abort past 5 MB. Export `safeFetchText(url, { maxBytes, timeoutMs })` and use it in every provider.
- [x] Never include response bodies in errors: Spydus/Aspen/WeGotTickets/iCal error messages become `` `${provider} feed returned ${status}` ``.

### Task C3: Events schema, pipeline and unique index

Finding: schema has no `libraryEntityRef`; worker `pipeline/upsert.ts:15-46` writes `library_id` and `library_entity_ref` (neither exists), no `document_id`, and `ON CONFLICT (source_provider, external_id)` with no unique index. Controllers filter/select `libraryEntityRef` (`controllers/events.ts:14,76,92,189,366,392,522`) → 500s. ICS `UID:null@`.

- [x] Add `libraryEntityRef` (`string`, indexed) to `event/schema.json` next to the `library` relation; keep the relation.
- [x] Migration `2026.09.30T00.00.02.events-unique-external-id.js` (copy the guard style of `2026.09.26T00.00.00…`): `CREATE UNIQUE INDEX IF NOT EXISTS ev_events_provider_external_uq ON ev_events (source_provider, external_id)` and `CREATE INDEX IF NOT EXISTS ev_events_library_entity_ref_idx ON ev_events (library_entity_ref)`. Add the same statements to a `ensureEventIndexes` called from the events plugin bootstrap (fresh-DB fallback, same reasoning as `src/utils/ensure-unique-indexes.ts`).
- [x] Worker upsert: generate `document_id` with `@paralleldrive/cuid2` (Strapi's format) on insert, write `library_entity_ref`, drop `library_id`, and write the `ev_events_library_lnk` row (read the link table/column names from the local DB or Strapi metadata: `strapi.db.metadata.get("plugin::events.event").attributes.library.joinTable`). Set `published_at`, `created_at`, `updated_at`, `locale`.
- [x] Tests in `apps/sync-worker/tests/pipeline/upsert.test.ts` with a knex mock (or better-sqlite in memory): a new event gets a cuid `document_id` and a link row; a second run with the same `(source_provider, external_id)` updates in place.

### Task C4: Public event queries

Finding: only `featured` filters `pendingReview: false`; `event()`/`relatedEvents()` return full rows (`credentialId`, `syncHash`, `externalId`); ICS ignores `status`; `limit` goes straight to `pageSize` (no cap; `?type[]=x` crashes on `.split`); `location`/`topLibraries` read draft libraries; `pagination:` ignored at `events.ts:24,63,81,138,182,242,349,397,412` and `admin.ts:108,158`.

- [x] Add `server/utils/query.ts` exporting `publicEventFilters(extra)` (`pendingReview: false`, `status: { $in: ["scheduled","rescheduled"] }` — read the enum), `PUBLIC_EVENT_FIELDS`, and `clampInt(value, { def, min, max })` (non-numeric → `def`, NaN-safe). Tests for `clampInt` (`"abc"`, `-1`, `1e9`, arrays) and that `publicEventFilters` always carries `pendingReview: false`.
- [x] Apply to every public handler; replace `pagination:` with `start`/`limit` + `sort: ["startTime:asc","id:asc"]`; validate `from`/`to` with `Date.parse`; `type` must be a string; library lookups pass `status: "published"`.
- [x] `services/stats.ts:32-33` and the `heatmap` handler (`events.ts:320-321`): replace `strftime` with `EXTRACT(DOW FROM start_time)`/`EXTRACT(HOUR FROM start_time)` (keep a sqlite branch keyed on `strapi.db.config.connection.client` if tests run on sqlite); log inside the `catch` blocks; collapse the five counts into one `COUNT(*) FILTER (WHERE …)` query.

### Task C5: Credentials: secrets, `hasActiveFeed`, `testRaw`, crypto

- [x] `services/credentials.ts:37-43`: after `update`, `publish` the library (or update both statuses); populate `libraries` in `update()` before reading `result.libraries`; on deactivate/delete recompute `hasActiveFeed` from the remaining active credentials. Test: deactivating the only credential clears the flag on the published row.
- [x] Remove `testRaw` (`controllers/admin.ts:85-89`) and its route and admin button (it always 401s).
- [x] Strip query strings/userinfo from any URL that reaches `last_error_message`/`failed_credentials` (`write-run.ts:105,121`): add `redactUrl(url)` in the worker's `lib/` with a test.
- [x] `packages/events-crypto/src/index.ts:60-61`: `createDecipheriv(..., { authTagLength: 16 })`, reject `tag.length !== 16`, add AAD = the credential `documentId` (new optional `aad` param on encrypt/decrypt; callers in the worker and the plugin pass the credential documentId), and a leading version byte. Tests in `packages/events-crypto/tests/crypto.test.ts`: 15-byte tag rejected; blob decrypted with another documentId's AAD rejected; roundtrip ok.
- [x] Point-event style hygiene for events: nothing else.

### Task C6: ICS and worker hygiene

- [x] `utils/ics.ts`: `escapeIcs` strips `\r` and `\n` (→ `\\n`), `URL:` is escaped and only emitted for `https?:` URLs, `foldLine` folds at 75 **octets** (`Buffer.byteLength`), `icsLibrary` sanitises the filename to `[A-Za-z0-9_-]`. Tests in `tests/events/ics.test.ts`: CRLF injection in `title`/`url` produces no extra lines; a multibyte line folds correctly; `UID` is never `null@`.
- [x] `apps/ui/src/components/events/EventsAgenda.tsx:65`: render `href` only when it starts with `http(s)`.
- [x] Worker `load-credentials.ts:44-54`: one `whereIn` for all libraries.
- [x] Events suite, worker suite, crypto suite, Strapi suite, typecheck. Rebuild the plugin dist if committed.

---

## WP-D: rewards plugin and cron

**Files:** `apps/strapi/src/plugins/rewards/**`, `apps/strapi/config/cron-tasks.ts`, `apps/strapi/tests/rewards/**`. Indexes are WP-E's migration; write code to tolerate `23505` on the unique badge/snapshot indexes it adds (`rw_badge_awards (ba_user_id, badge_id)`, `rw_leaderboard_snapshots (period, period_type)`).

### Task D1: `award()` in a transaction, month-boundary race, contributorNumber

Finding: `services/points.ts:130-234` does five separate writes; a failure after the event insert burns the idempotency key while `user_profiles.points` never increments. Month reset (`:198-200`) races. Fallback profile uses `count+1` (`:162-172`).

- [x] Test in `tests/rewards/`: with the fake's transaction helper, a throw in the tier update leaves no `rw_point_events` row and the same key can be retried successfully.
- [x] Wrap in `strapi.db.transaction(async ({ trx }) => …)` with `.transacting(trx)` on every knex call and pass `trx` to the Document Service calls where supported (v5: `strapi.db.transaction` makes the Document Service join automatically; verify against `@strapi/core` `dist/services/document-service/` — if not, keep the DS calls inside and rely on the ambient transaction).
- [x] Month reset in SQL: `points_this_month = CASE WHEN date_trunc('month', last_activity_date) = date_trunc('month', now()) THEN points_this_month + ? ELSE ? END` (sqlite branch for tests if needed).
- [x] Fallback username/contributorNumber: use the Postgres sequence WP-E's migration creates (`user_profiles_contributor_number_seq`) via `nextval`; on sqlite fall back to `max+1` inside the transaction. Put `nextContributorNumber(strapi)` in `apps/strapi/src/plugins/rewards/server/utils/contributor-number.ts` (WP-E has its own copy in `src/utils/username.ts`; do not edit that file).

### Task D2: Public endpoint bounds and leaderboard cost

Finding: `controllers/rewards.ts:21` `Math.min(NaN, 100)` → knex drops `LIMIT`; `limit=-1`/`page=0` → 500; `myHistory` (`:61-68`) returns `idempotencyKey`/`metadata`; leaderboard aggregates live per hit; `adminChartData` (`:248-264`) runs 30 queries; `getCountryRank` fetches the profile twice; `region` param ignored.

- [x] Add `clampInt` to `server/utils/query.ts` (same contract as WP-C's; duplicate the 10 lines rather than cross-import between plugins) with tests.
- [x] Apply to `limit`, `page`, `offset` everywhere in `controllers/rewards.ts` and `controllers/admin*.ts`.
- [x] `myHistory`: `select: ["action","points","awardedAt"]` plus `metadata` with `awardedBy` stripped.
- [x] `getLeaderboard`: memoise per `(period, page, limit)` for 60 s in module scope; add `Cache-Control: public, max-age=60`. Remove the duplicate profile fetch in `getCountryRank`. Remove the unused `region` param from the route and controller.
- [x] `adminChartData`: one `GROUP BY date_trunc('day', awarded_at)`.

### Task D3: Snapshot, badges, admin award, CM visibility

- [x] `snapshot.ts:46-58`: snapshot the **previous** full ISO week (Monday 00:00 of last week → this Monday 00:00) under last week's key; `rankChange` compares the same period type. Catch `23505` as "already taken". Test: running on Monday 00:05 produces a snapshot covering the prior seven days.
- [x] `badges.ts` `checkAndAward`: catch `23505` as already awarded. Either implement `daily_streak` (award when `streak` crosses 7/30/100 — check the badge definitions) or remove the unreachable badge definitions; pick whichever the definitions in `howItWorks` describe, and say which in your report.
- [x] `adminAward` (`rewards.ts:207-240`): `points` must be an integer in `[1, 500]`, `baUserId` must resolve to an existing profile (no auto-create), idempotency key `admin:${adminId}:${baUserId}:${clientRequestId}` where `clientRequestId` is required in the body (the admin UI generates a uuid per click).
- [x] `point-event` and `badge-award` schemas: `pluginOptions["content-manager"].visible = false`.

### Task D4: Cron

- [x] `config/cron-tasks.ts`: delete `sayHelloJob`; run `quickWinsRefreshJob` with concurrency 5 (a tiny `mapLimit` helper in `apps/strapi/src/utils/map-limit.ts` with a test); replace `pagination:` at `:58` with `start`/`limit`+`sort`.
- [x] Leader lock for the rewards cron added in bootstrap: `SELECT pg_try_advisory_lock(<constant>)` at the start of each run, release at the end; skip when not acquired (log at debug). No-op on sqlite.
- [x] Rewards suite + Strapi suite + typecheck. Rebuild plugin dist if committed.

---

## WP-E: Strapi API layer, auth bridge, indexes, aggregates

**Files:** `apps/strapi/src/api/**` (controllers, services, routes, middlewares, schemas), `apps/strapi/src/utils/**` except `sentry-scrub.ts` (A) and `map-limit.ts` (D), `apps/strapi/src/lifeCycles/**`, `apps/strapi/src/documentMiddlewares/**`, `apps/strapi/config/api.ts`, `apps/strapi/config/server.ts`, `apps/strapi/src/index.ts`, new migration `apps/strapi/database/migrations/2026.09.30T00.00.01.hot-path-indexes.js` (+ `shared/hot-path-index-sql.js`), tests under `apps/strapi/tests/`.

### Task E1: Indexes migration and fresh-DB fallback

Finding: nothing indexes `slug`, `entity_ref`, `ba_user_id`, submission and points columns; votes/badges/snapshots have no unique constraint.

- [x] `shared/hot-path-index-sql.js` exporting an array of `{ name, sql }` (all `CREATE [UNIQUE] INDEX IF NOT EXISTS`):
  - `libraries (slug, locale, published_at)`, same for `regions`, `countries`, `continents`, `areas`, `wiki_articles`, `blog_articles`; `libraries (entity_ref)`; `libraries (library_type)`.
  - `user_profiles (ba_user_id)`, `user_profiles (points DESC)`, `user_profiles (country, points DESC)`.
  - `cm_submissions (submitted_by_user_id, status, created_at)`, `cm_submissions (target_document_id, status)`, `cm_submissions (submission_type, status)`.
  - UNIQUE `cm_option_votes (suggestion_document_id, ba_user_id)`; `cm_option_votes (suggestion_document_id)`.
  - `rw_point_events (ba_user_id, awarded_at)`, `rw_point_events (awarded_at)`; UNIQUE `rw_badge_awards (ba_user_id, badge_id)`; UNIQUE `rw_leaderboard_snapshots (period, period_type)`.
  - `catalogue_branches (library_document_id)`.
  - `CREATE SEQUENCE IF NOT EXISTS user_profiles_contributor_number_seq` then `SELECT setval(..., (SELECT COALESCE(MAX(contributor_number),0) FROM user_profiles))`.
    Read every table and column name from the schemas' `collectionName` and Strapi's snake_case mapping; dedupe existing rows before the unique ones (votes: keep lowest id).
- [x] Migration file: same guards as `2026.09.26T00.00.00…`; skip missing tables with a warning.
- [x] Extend `src/utils/ensure-unique-indexes.ts` (or add `ensure-hot-path-indexes.ts` called right after it in `src/index.ts` bootstrap) to apply the same list once tables exist. Extend `tests/ensure-unique-indexes.test.ts` to assert every entry is applied and existing ones skipped.

### Task E2: `pagination:` → `start`/`limit`, `strictParams`

- [x] `config/api.ts`: `rest.strictParams: true` and `documents: { strictParams: true }` (verify the key against `@strapi/core` `dist/services/document-service/params.js`). Run the Strapi suite; fix whatever now throws.
- [x] Replace `pagination:` in `api/library/controllers/library.ts:190,223-263`, `api/blog-article/controllers/blog-article.ts:91`, `api/catalogue/services/catalogue.ts:146,209,284` with `start`/`limit` and `sort: ["id:asc"]` (or the existing sort + `id`). Blog fallback: `limit: 3`. Map pins: cap 500 and return `truncated: true` in the payload when hit.
- [x] Tests: a fake `findMany` records its params; assert `limit` is set and `pagination` absent for atlas, map-pins and the blog fallback.

### Task E3: Atlas: keyset pagination, precomputed completeness, caching

- [x] `library.ts:218-281`: keyset loop `filters: { id: { $gt: lastId } }, sort: "id:asc", limit: 1000`; stop reading `description`/`collectionStats` — add a `completeness` integer to the library schema, computed in the existing entityRef/document middleware on write (WP-E owns `lifeCycles/`), and backfilled by a one-off bootstrap pass guarded by "any row with `completeness IS NULL`".
- [x] Memoise the built FeatureCollection in module scope for 5 minutes, invalidated from the library `afterUpdate`/`afterPublish` lifecycle; set `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`.
- [x] `library.ts:162-168`: `libraryTypes`, `areaSlug` etc. must be strings (`typeof === "string"`), else 400.
- [x] Test: two atlas calls within the TTL hit `findMany` once; a publish clears it.

### Task E4: SQL aggregates for tallies, type counts, homepage stats, affiliation count

Finding: `utils/library-tally.ts:41-49` loads every library; `utils/library-type-counts.ts:18-35` runs 15 parallel counts; `homepage/controllers/homepage.ts:26-57` scans all libraries and submissions; `auth-bridge.ts:357-363` loads all affiliations.

- [x] `library-tally.ts`: one knex query joining the child and parent link tables (names from `strapi.db.metadata.get("api::library.library").attributes[rel].joinTable`), `GROUP BY child`, `count(*)`, `avg((location->>'lat')::float)`, `avg((location->>'lng')::float)`, filtered on `published_at IS NOT NULL` and `locale`. Keep the return shape. sqlite branch: fall back to the current JS path (tests).
- [x] `library-type-counts.ts`: one `GROUP BY library_type` over the same join; keep the return shape. Region detail must tally only its own country's regions (it currently tallies the whole country for "Nearby" — keep that but via SQL).
- [x] `homepage.ts:26-57`: `count(DISTINCT country_id)` on the country link table joined to published libraries; `count(DISTINCT coalesce(submitted_by_user_id, lower(submitted_by_email)))` over approved submissions; memoise 5 minutes.
- [x] `auth-bridge.ts:357-363`: `filters: { library: { entityRef: { $eq } } }` + `count`.
- [x] Tests assert the knex builder receives `groupBy` and no `findMany` over the library table (use the fake's `db.connection` stub; add one if missing).

### Task E5: Route-level populate middlewares and detail-controller hygiene

- [x] Add `api/library/middlewares/library-populate.ts`, and the same for continent, country, region, area: set `ctx.query.fields` and `ctx.query.populate` to a server-owned shape (media: `fields: ["url","alternativeText","width","height","formats"]`; relations with explicit `fields`), discarding any client `populate`. Attach via `createCoreRouter(uid, { config: { find: { middlewares: [...] }, findOne: { middlewares: [...] } } })`. Test: a request with `populate=*` reaches the controller with the server shape.
- [x] `featuredLibraries` populates (`continent.ts:51-58`, `country.ts:38-45`, `region.ts:33-40`): explicit `fields`; every `heroImage: true`/`seo.metaImage: true` → field-limited.
- [x] `area.ts:32-41`: separate `findMany` with `limit` (reuse `REGION_LIBRARY_LIMIT`'s pattern) instead of populating all libraries.
- [x] Detail controllers: run independent queries with `Promise.all` after the parent lookup (`continent.ts:87-134`, `country.ts`, `region.ts:76-185`).
- [x] Library counts (`continent.ts:89`, `country.ts:80`, `region.ts:78`, `area.ts:52`) add `locale`.
- [x] `category.ts:12`, `wiki-section.ts:9`: pass `status: "published"`.
- [x] Remove the duplicate `/areas/map-pins` route (keep the one in `area-custom.ts`).
- [x] `documentMiddlewares/catalogue.ts:16-21`: compare `catalogueUrl` with the stored value before doing lookups. `documentMiddlewares/page.ts` prefetch: remove it if nothing uses `populateDynamicZone` (grep first), else carry `filters` and `status`.
- [x] `lifeCycles/entityRef.ts:146-166`: only recompute when `slug` or a location relation is in `params.data`; skip when the write is the ref update itself; add a `region` afterUpdate that refreshes its libraries' refs when the region slug changes (batched, `start`/`limit`).
- [x] `api/library/routes/*` slugs endpoints: `limit` capped at 1000 with `start`.

### Task E6: Auth bridge and profiles

- [x] Auto-claim (`auth-bridge.ts:11-24, 308-344`): compare only against the library **website** domain, look the library up with `documents().findFirst({ status: "published", filters: { entityRef } })`, and check the user's domain against the `free-email-domains` package (add it) plus the existing list. Test in `tests/auth-bridge-*.test.ts`: `btinternet.com` no longer auto-verifies; a matching website domain still does; a match on the library `email` alone does not.
- [x] Session bridge (`auth-bridge.ts:566-572`): filter `role: { $notIn: NON_CLAIM_AFFILIATION_ROLES }`; export that constant (`["proposer"]`) from `src/utils/affiliations.ts`. Extend `tests/session-profile.test.ts`.
- [x] `syncUser` (`:96-104`): stop issuing/returning `jwt`.
- [x] `contributorNumber` (`:81-90`): add `nextContributorNumber(strapi)` to `src/utils/username.ts` (Postgres `nextval('user_profiles_contributor_number_seq')`, sqlite `max+1`) and use it.
- [x] Follow (`:453-467`) and `followedLibraries` (`user-profile.ts:302-328`): published only.
- [x] `user-profile.ts:51-75` `applyPublicPrefs` and `mayShowBadges`: when `publicPrefs.showActivity === false`, null `earnedBadges`, `points`, `pointsThisMonth`, `streak`, `tier`, `lastActivityDate`. Extend `tests/user-profile-badges.test.ts`.
- [x] Schemas: `private: true` on `user-profile.baUserId`, `notifPrefs`, `contributorNumber` and `dataset.notes`; confirm the custom controllers read them via `fields` server-side (private fields are still readable by the Document Service).
- [x] `erase-account.ts`: also delete `pro-verification`, `entitlement-grant`, `option-vote` and `subscriber` (by email) rows, blank submission `fields`/`draftData`/`note` for `draft`/`pending`/`needs_info` rows and delete their upload files, clear `earnedProUntil`, use `deleted-${randomUUID()}` for the erased id, and run in `strapi.db.transaction`. Extend `tests/erase-account.test.ts`.
- [x] `lifeCycles/user.ts:33`: log the user id, not the email.
- [x] Subscribers: replace the core `create` with a custom controller `POST /subscribers` that accepts only `{ email }`, dedupes case-insensitively, sets `message` server-side (`"Signed up via the website footer on <ISO date>"`), and rate-limits by IP (in-memory token bucket, 5/hour) — the UI's `/api/newsletter` (WP-F) is the only caller and sends the client IP in `X-Forwarded-For` under the bridge secret; without the secret refuse.
- [x] `config/server.ts`: `proxy: env.bool("TRUST_PROXY", false)` with a comment; add `TRUST_PROXY` to `.env.example`.
- [x] Strapi suite + typecheck. Regenerate `types/generated/contentTypes.d.ts` and `packages/strapi-types` if you changed schemas (`pnpm generate:types` in `apps/strapi`, then the package's build).

---

## WP-F: Next.js boundary

**Files:** `apps/ui/**` only (except `components/events/EventsAgenda.tsx`, WP-C).

### Task F1: Security headers

- [x] `next.config.mjs` `headers()`: `Content-Security-Policy: frame-ancestors 'self' <STRAPI admin origin from env>`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains` (production only), `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`. Test `apps/ui/src/lib/__tests__/security-headers.test.ts` on the exported header list.
- [x] `images.remotePatterns`: replace `hostname: "*"` with the CDN/Strapi hosts from env.

### Task F2: Newsletter route replaces the proxy POST

- [x] Remove `POST api/subscribers` from the proxy allowlist (`lib/strapi-api/request-auth.ts:28`); add `app/api/newsletter/route.ts`: zod `{ email }`, honeypot field rejected, per-IP limiter (reuse the Better Auth rate-limit table helper if one is exposed, else a small `lib/rate-limit.ts` in-memory bucket with a test), then call Strapi `POST /api/subscribers` with the bridge secret and `X-Forwarded-For`. Update the footer form to call it.
- [x] Test: bad email → 400; sixth call in an hour → 429.

### Task F3: Uploads, rate limits, claims

- [x] `submissions/upload-image`, `profile/me/avatar`, `upload` routes: reject when `Content-Length` exceeds the cap **before** `formData()`; per-user daily quota (20 files / 50 MB) via a `lib/upload-quota.ts` backed by a Strapi count on `cm_submission_uploads` for the user (bridge call; add the Strapi endpoint if missing — coordinate: WP-B owns that plugin, so if the endpoint is missing, count via the existing `mine` listing and note the gap).
- [x] `lib/rate-limit.ts` (shared with F2) applied to `claim-library`, `follow`, `follow-user`, `suggest-topic`, `submissions` POST: 30/min per session user.
- [x] `claim-library/route.ts:51-68`: also refuse when a `library_claim` for that library is already `pending`/`needs_info` for this user (use the `mine` listing).

### Task F4: Small routes

- [x] `saved-events/ics/route.ts:44,93`: validate `eventDocumentId` against `/^[a-z0-9]{1,64}$/i`, `encodeURIComponent` it, escape `URL:` and CR/LF in every ICS value (share an `escapeIcs` in `lib/ics.ts` with a test).
- [x] `proxy.ts:36`: include `/api` in the Basic Auth matcher; exempt `/api/cron`, `/api/preview` and `/api/auth` (they carry their own secrets) — test the matcher function.
- [x] `auth.ts:100`: `deleteUser` → add `beforeDelete` calling `auth-bridge/delete-profile` (the same call `profile/me/route.ts:189-205` makes; extract it to `lib/delete-profile.ts`).
- [x] `submissions/upload-image/route.ts:101`, `profile/me/avatar/route.ts:75`: return `formatStrapiMediaUrl(url)` (the `/api/asset/` form), never `STRAPI_URL`.
- [x] `preview/route.ts:89-92`: drop the `g` flag; read the secret from a header (`X-Preview-Secret`) with the query form kept for the Strapi preview button only if that button can't send headers (check `config/admin.ts` preview config).
- [x] `profile/me/connections/route.ts:57`: generic error text.
- [x] `profile/me/suggest-topic/route.ts:50-61`: send `X-Ba-User-Id`/`X-Ba-User-Email` (it always fails today). Test it.
- [x] Origin check helper `lib/same-origin.ts` (`Origin`/`Referer` must match `APP_PUBLIC_URL`) on `DELETE /api/profile/me` and `profile/me/connections`.

### Task F5: Build fan-out and caching

- [x] `lib/strapi-api/base.ts:166-184` `fetchAll`: concurrency 4 (small `mapLimit`), stable `sort` param.
- [x] `[library]/page.tsx:36` `generateStaticParams`: return featured libraries only (`featured=true`, `fields=[slug,…]`); `[country]/page.tsx:68`: use `/countries/slugs`. Add `GET /libraries/slugs` client (WP-E caps it) for the sitemap and split with `generateSitemaps()` at 40,000 URLs.
- [x] `[library]/page.tsx:147-156`: create all promises before any `use()`.
- [x] `base.ts:55`: per-entity `next.tags` (`library:${slug}`, `country:${slug}`, …) and `revalidate: 300`; add `app/api/revalidate/route.ts` gated by a `REVALIDATE_SECRET` header that calls `revalidateTag`. Note in the report that a Strapi webhook must be configured to call it.
- [x] `content/server.ts:163` homepage `featuredLibraries.populate` override: pass an object with `fields`, not an array; `fetchIncompleteLibraries` (`:1423-1440`): sort by the new `completeness` field ascending with explicit `fields` (WP-E adds the field; use it).
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint` in `apps/ui` (lint: my files clean; 3 Prettier errors remain in another agent's `PlanCompareTable.tsx`).

---

## Final gate (after all packages)

- [ ] Full: `apps/strapi` suite + typecheck + lint; `apps/ui` test + typecheck + lint; `apps/sync-worker` test; `packages/events-crypto` test; `packages/access` test.
- [ ] Start Strapi locally and hit: `/api/libraries/atlas` twice (second is cached), `/api/libraries?populate=*` (server shape), `/api/homepage/stats`, `/api/rewards/leaderboard?limit=abc` (clamped), an events public route (200, no `credentialId`).
- [ ] Reindex Meilisearch and confirm `attributesToRetrieve: ["contributors"]` returns nothing sensitive.
- [ ] One code-review pass per package (findings ranked, fixes applied), then hand the diff to the user for commit decisions.
