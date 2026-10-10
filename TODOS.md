# libraries.global — Open TODOs

_Last audited: 2026-10-03_

Built and on `dev`: the v2 light UI on every route; the access model (Role Grants, capabilities, entitlements, Pro from grants, verification and earned Archivist); the Index and Knowledge editors; structured corrections; community moderation on the site with Role Applications and Location Requests; Change Records and the library Changes section; locale-aware submissions and record translations; the Strapi security review fixes; and the first scale work (keyset slug paging, SQL location counts, a split sitemap). CLAUDE.md describes how it all works.

This file lists what's left. Deploy, environment, legal and licensing steps live in `docs/pre-golive-checklist.md`, which isn't repeated here.

---

## Launch blockers (go-live 15 Oct 2026)

1. **LibraryOn full ingest (~3,800 UK records).** Not run yet. Local Strapi has 107 published libraries. The last attempt (26 Sept) stopped after about 100 records, with 19 `fetch failed`/`terminated` errors (`.scratch/libraryon-import/log.json`). The source goes away when the British Library shuts LibraryOn down on 15 Oct, so **run this first**: `libraryon-ingest.ts --resume`, then publish the drafts (checklist §2a–2b). Use a token whose name starts with `ingest` or `import`, so Change Records log the writes as `source: import`.
2. **World countries import.** Do a dry run, then the real run of `populate-world-countries.ts` (checklist §1e). In the dry run, check that France's `mapConfig` doesn't span its overseas territories. On the real run, check that `PUT ?status=published` actually publishes.
3. **Reindex Meilisearch** after 1 and 2 (checklist §3a).
4. **Production deploy:** Vercel, Strapi Cloud and production Meilisearch (checklist §4–6). The Strapi review's operator steps aren't in the checklist yet:
   - grant the events admin permissions (`manage-credentials`, `review`) to moderator admin roles
   - re-save each provider credential once, because the blobs are now bound to the credential id
   - set `REVALIDATE_SECRET`, `IMAGE_REMOTE_HOSTS` and `TRUST_PROXY`, and add the Strapi → `/api/revalidate` webhook
   - scope the public Meilisearch key to `search` on `library`, `blog-article`, `wiki-article` and `event`
5. **Legal and licensing before publication** (checklist §7): get LibraryOn's licence in writing, replace the GADM boundaries, pay the ICO fee, and publish the legal documents as v1.0.

---

## Verification owed on the moderation and audit work

Tasks 13–17 of `docs/superpowers/plans/2026-09-30-community-moderation-and-audit.md` and the final-review fixes (`41b5883`, `5c8758b`) were committed on 3 Oct without running tests, and the fixes weren't re-reviewed.

- [ ] `pnpm --filter @repo/strapi build:plugins && pnpm --filter @repo/strapi build`, then the Strapi and UI unit tests, typecheck, lint and `next build`
- [ ] The Playwright access project (`cd qa/tests/playwright && pnpm seed:access && npx playwright test --project=access`). The moderation, Role Application and Location Request specs have never run, and their selectors were guessed.
- [ ] Live: a `new_library` approved with **Approve and publish**; `/history` and `/history/stats` on Postgres; a Pro fixture getting previous → next values from `/api/libraries/<id>/history`
- [ ] Browser: the `LocationHierarchySelector` preset ids and its `router.replace` refresh after a Location Request
- [ ] Add the new fixtures (`moderator-global`, `moderator-knowledge-fr`, `journal-editor-fr`, `applicant`) to `TEST-USERS.local.md`

## Manual checks owed from earlier phases

- [ ] P-A: Super Admin has the content-moderation "Update submission status" and rewards award permissions, and an Author gets 403
- [ ] P-A: two-browser session revoke; Next preview-mode draft render; create an upload-only Strapi token and untick upload on the read-only token
- [ ] P-D0: the whole-branch review (stopped on 28 Sept and never re-run)
- [ ] P-D0: one large Atlas export on a Vercel preview (4.5 MB response limit)
- [ ] Real-browser WebGL: map tiles and pins, the drill-down shelf, the globe canvases (consider a lighter globe on the paper background)

---

## Decisions waiting on the owner

- Submission, point-event and badge-award are hidden from the Content Manager, which blocks the local MCP tools for those types. Keep them hidden?
- `daily_streak` awards +1 a day; the leaderboard's `rankChange` is weekly only; `/api/health` is exempt from staging Basic Auth. Keep all three?
- Auth plan (`docs/superpowers/plans/2026-09-28-wp1-auth-login.md`): only Tasks 1–2 are committed. It needs a yes or no on GitHub OAuth (Task 6) before the rest can run.
- Prices in `lib/plans.ts` are placeholders until confirmed.
- Code licence (MIT or AGPL, D-O1) and data licence (D-P6): checklist §7.

---

## Product gaps

- **Needs-changes thread (P-C, C-M1/C-M2):** contributors see the moderator's note but can't reply or edit and resubmit.
- **Free-text corrections** still only award points. Nothing applies them.
- **Atlas at scale:** `GET /libraries/atlas` downloads every library; region hero maps use only the first 100 list records. The [execution spec](docs/superpowers/specs/2026-10-08-atlas-vector-tiles-design.md) and [implementation plan](docs/superpowers/plans/2026-09-30-atlas-vector-tiles.md) define bounded queries, live aggregates, reconciled PMTiles and capped server-selected exports. The gated provider, transactional capture, independent projection/index worker, archive job, reconciliation, scoped exports and region renderer are implemented and checked locally. Flags remain off; [deployment/readiness, CDN, canary and retirement gates](docs/atlas-operations.md) remain open. By user direction, millions-scale performance is estimated locally and verified as production grows; no large local synthetic run is required.
- **General Meilisearch rebuild at scale:** `apps/strapi/scripts/seed-meilisearch.ts` loads the corpus into memory and deletes the live index before replacement. The Atlas plan adds a separate safe rebuild for its dedicated index; the general library reseed still needs streamed staging/reconciliation/swap before full-scale ingestion or reseeding.
- **Search facets:** `/libraries` works out "Open now", "Has digital collections" and "Most complete first" in the browser, which hits Meilisearch's fetch ceiling after the ingest. Index a completeness score and an open-now encoding, and make them real facets.
- **History for free viewers:** backfilled batches have no values, but free viewers still see the Pro upgrade line on them. Strapi needs to send a `valuesRecorded` flag.
- **Index editor fields with nowhere to go:** `officialName`, `collectionSize`, `collectionTypes`, `specialCollections`, `architecturalStyle`, `imageCredit` and `imageNote` reach the reviewer but aren't applied, because the library schema has no field for them.
- **Schema:** add a steward relation on Library (record status is hard-coded "Community maintained") and a "contributed to" relation for the profile Libraries tab.
- **Notification emails:** only the moderation emails are sent (decisions, new Role Applications and Location Requests). Weekly digest, new followers and editorial messages are saved preferences with nothing to deliver them.
- Free-text article tags don't create topic suggestions.

## Smaller follow-ups

- `wiki-article` `topContributors` fetches every approved `wiki_edit` for the month, counts them in JS (against the Scale target) and cuts to 10 before it drops hidden profiles (M7).
- `contribute/events/page.tsx` checks `isVerifiedLibrarian` when it should check the `events.feed` capability.
- `fromSessionCapabilities` and `useCapabilities` don't validate scope entries. Harden them before anything relies on the cookie.
- The moderation review page loads external photo hosts in the moderator's browser, and `ClaimPanel` uses raw colours with no warn token.
- `MAILGUN_*` and `MAILTRAP_*` aren't declared in `turbo.json`.
- Playwright: the fixture writer should fall back to `PGHOST` before `localhost`, and the `--project=access` check is case-sensitive.
- CLAUDE.md is stale in two places: the Auth section's `strapiJWT` text, and Events listed as "not yet built".
- Local dev clean-up: remove the `claude-review@example.test` super admin, and give the read-only API token `find` on Topic if article topics should appear.

## Polish

- Delete the unused `--font-fraunces` alias in `styles/globals.css`.
- Retire the old Collections stub route (`/profile/[username]/collections`).
- Dense mono-uppercase micro-labels remain in the Knowledge, Contribute and profile contributions pages.

---

## Feature backlog

| Feature                          | Status                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Events (plugin + sync-worker)    | Built, not launched                                                                |
| Collections content type         | Not started                                                                        |
| IIIF viewer on library detail    | Not started (external links shipped)                                               |
| 2FA (Better Auth twoFactor)      | Not started                                                                        |
| More locales (FR, ES, AR, JA)    | Plumbing built (§6 in CLAUDE.md); `LIVE_LOCALES` stays `[en]` until content exists |
| Visit log / annotations          | Not started                                                                        |
| Pro checkout (Stripe, P-D1)      | Not started; Pro comes only from grants, verification and earned Archivist         |
| Self-serve Pro verification (C5) | Not started; staff create `pro-verification` rows by hand                          |
