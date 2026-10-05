# Noticeboard and Drives

**Date:** 2026-10-05
**Status:** Approved design (2026-10-05)
**Related:** ADR-0004 (design for three million libraries), ADR-0005 (moderation runs in the frontend), CONTEXT.md (Submission, Moderation Queue, Points, Tier, Badge, Dataset, Saved Library, Place Labels), `2026-09-26-access-contribution-pro-implementation-design.md` §3 (access axes), `2026-09-29-community-moderation-and-audit-design.md` (queues, Change Records), `2026-04-30-community-rewards-design.md` (points, badges). The review this spec follows is in the local, git-ignored `.scratch/noticeboard/review.md`.

## 1. Summary

The index's main problem as it grows is gaps. Imports bring names and addresses, but not opening hours, photos or facilities: the 17,584 IMLS records have no hours, website or email. A **Drive** is a time-boxed, public effort to close one kind of gap across a set of libraries: "Ohio's public libraries need opening hours". Contributors pick a library, or are given one, fill the gap in a small panel on the page, and watch the drive's progress move. Every task they send is an ordinary Submission, reviewed by a Moderator like any other.

Drives live on a **Noticeboard**, the landing page of a new top-level **Community** section, which also takes the leaderboard and the suggested-additions votes out of Contribute.

| Workstream           | Outcome                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Groundwork        | One gap registry behind completeness, the index and every page; a "Still right?" verify action; the index fields drives filter on            |
| B. Community section | `/community` with Noticeboard, Leaderboard and Suggestions; a header link; Contribute loses its Community tab; Content Manager groups follow |
| C. Drives            | The Drive content type, its scope and Focus, progress from Meilisearch counts, the Noticeboard, the drive page, and the builder              |
| D. Tasks and credit  | The inline task panel per Focus, `driveDocumentId` on Submissions, Drive Credits for accepted work, honest quota display                     |
| E. Moderation        | A drive filter and chip in the queue, "Next in this drive", Drive Proposals as a Submission type, and board-only pin and feature             |
| F. Recognition       | Drive points, a finisher bonus, fixed drive badges, profile ribbons, per-drive leaderboards and a thank-you email                            |
| G. Touchpoints       | Drives on the homepage, the Contribute hub, library pages, location pages, Find libraries, the profile and the ingest READMEs                |

Decisions accepted with the owner on 2026-10-05 (review defaults D1–D15):

1. **A top-level Community section** (D1). `/community` is the Noticeboard; the leaderboard moves from `/contribute/community` to `/community/leaderboard`, and the option votes get their own page at `/community/suggestions`, with the hub keeping a card that links to it. Contribute keeps the tools. Community pages are indexable; Contribute stays noindex.
2. **One Focus per drive** (D2). A Focus is gap keys from the registry (hours, photo, accessibility, contact and so on), or verify, or the whole record.
3. **Scope is fixed when a drive opens** (D3). Libraries created after `openedAt` are left out, so an import mid-drive doesn't move the finish line.
4. **Drives are finishable** (D4). At most 2,000 tasks when it opens, an end date at most 90 days after the start, no "ongoing" drives.
5. **Moderators approve proposals, the board pins** (D5). A Drive Proposal is reviewed in the `index` queue; approval schedules the drive. Only the editorial board pins (six at most) and features (one).
6. **Proposing takes standing** (D6). Signed in, with 5 accepted Submissions, the Role Application rule.
7. **The drive id is a first-class Submission field** (D7): top-level, indexed and covered by `payloadHash`.
8. **Credit follows the work** (D8). A tagged Submission is credited, and so is an untagged accepted fix to a library in scope while the drive is open.
9. **No drive route to Pro** (D9). Drive work earns points, points raise the Tier, and Archivist gives earned Pro as today. The page shows how far that is.
10. **Points** (D10). A structured record correction scores like a `library_edit` (5, or 15 for 4+ fields); +2 for each accepted drive task; +25 to every helper with 5 or more accepted tasks when a drive meets its goal.
11. **Fixed badge families and per-drive ribbons** (D11). No badge per drive.
12. **Quotas stay** (D12). The tier pending limits apply in drives, and the panel says where you stand.
13. **Verification is per section** (D13, refined in §3.2). An approved edit or confirmation of a section verifies that section; `lastVerifiedAt` is the latest of them. Other edits set `contentUpdatedAt` only.
14. **Native names wait for a field** (D14). No names drive until `alternateNames` is typed (its own spec).
15. **Drive pages are indexable** (D15), open and finished.

## 2. Vocabulary

Unchanged: **Library**, **Submission**, **Moderation Queue**, **Moderator**, **Points**, **Tier**, **Badge**, **Streak**, **Dataset**, **Saved Library**, **Place Labels**.

New terms (add to CONTEXT.md):

- **Drive**: a time-boxed public effort to close one Focus across a Drive Scope, with a start, an end date and a goal. _Avoid_: campaign, challenge, quest, mission, bounty.
- **Focus**: what a drive fills: one or more Gaps, or verify (sections checked before a date), or the whole record. _Avoid_: task type, drive type.
- **Gap**: a record section a Library lacks, as the gap registry defines it (hours, photo, accessibility…). One definition serves completeness, the index's `needs`, the library page and drives. _Avoid_: missing field, hole.
- **Drive Scope**: which libraries a drive covers: places at any level, library types, a source Dataset, a completeness ceiling, or an explicit list (one library is the single-library drive). Fixed at `openedAt`.
- **Drive Task**: one library in a drive's scope that still has the Focus's Gap; the unit of progress.
- **Drive Proposal**: a Submission (`drive_proposal`) asking for a drive; approval schedules it.
- **Drive Credit**: the record that an accepted Submission counted towards a drive. Per-drive leaderboards, ribbons and the finisher bonus read it. _Avoid_: contribution (CONTEXT.md avoids it alone).
- **Noticeboard**: the Community landing page that lists drives. _Avoid_: board (that's the editorial board).
- **Pinned Drive**: one of at most six open drives the editorial board shows first; the **Featured Drive** is the one pinned drive shown in full on the Noticeboard and the homepage.

## 3. Workstream A: Groundwork

Each piece is useful without drives and ships first.

### 3.1 One gap registry

Four places define gaps today, and they disagree:

| Where                                                                      | Sections                                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/strapi/src/utils/library-completeness.ts` `computeCompleteness`      | 8: photo, hours, address, location, facilities (incl. amenities), about, history, contact |
| `apps/strapi/src/utils/library-search-fields.ts` `libraryNeeds` (index)    | 3: hours, photo, facilities (accessibility or services, amenities ignored)                |
| `apps/ui/src/components/library/library-page.helpers.ts` `recordChecklist` | 8, different: name, address, hours, history, links, accessibility, collections, photos    |
| `apps/ui/src/components/location/location-page.helpers.ts` `GAP_DEFS`      | 4: hours, photo, facilities, contact                                                      |

Add `packages/shared-data/gaps.ts`: `GAPS`, one entry per Gap with its `key`, label, icon, the record fields it reads, `hasGap(record)` (a pure predicate over a typed record shape), the editor that fills it (a `CorrectionEditor` category) and whether it counts toward completeness. Keys: `hours`, `photo`, `address`, `location`, `facilities`, `about`, `history`, `contact` (the eight completeness sections), plus `accessibility` and `services`. `facilities` means none of accessibility, services or amenities; `services` means no services and no amenities. `verify` is not a gap but a Focus of its own (time-based, §3.2). `hours` means no enabled day with a timeframe (today's `libraryNeeds` rule). `accessibility` means no accessibility relation and no confirmed "No" for an accessibility item in `absentFacilities`.

Every consumer derives from it: `computeCompleteness` (still 8 sections, now named from the registry), `libraryNeeds` (writes every gap key, not three), `recordChecklist`, region gaps and drives. Parity tests assert that each surface agrees for the same record. Completeness values may shift slightly; `backfillLibraryCompleteness` does not rerun (local data is disposable), the next write of each library refreshes it, and a reseed refreshes the index.

### 3.2 Verify: "Still right?"

There is no way today to say a record is still right without changing it. Add a `correction` kind:

```ts
fields: { kind: "verify", sections: ("hours" | "status" | "address" | "contact")[] }
// evidenceUrl required, or evidenceType "on_site_visit"
```

- **Library page:** each verifiable section gets a "Still right?" link that opens the correction drawer in confirm mode: the live values, the sections to confirm, and the evidence field.
- **Review panel:** the live values beside the evidence. Approving changes no field.
- **Apply:** writes `verifiedSections` (new JSON attribute, `{ hours?: ISO, status?: ISO, address?: ISO, contact?: ISO }`) for the confirmed sections, and sets `lastVerifiedAt` to the latest of them. An approved edit that sets a section's fields also stamps that section (the 2026-10-05 points fix already treats it as checked). An edit that touches no verifiable section no longer bumps `lastVerifiedAt`; `contentUpdatedAt` still moves.
- **Points:** `hours_verified` and `status_verified` (+5) for the confirmed sections, idempotency key `${submissionDocumentId}:${action}` as today. Address and contact confirmations earn the base `correction_approved` (2).
- The library page's "Last reviewed" reads `lastVerifiedAt` as today.

### 3.3 Index fields

`apps/strapi/config/plugins.ts` and `library-search-fields.ts`:

| Field                                                     | Use                                              | Filterable | Sortable |
| --------------------------------------------------------- | ------------------------------------------------ | ---------- | -------- |
| `completeness`                                            | whole-record drives; the comment claims it today | add        | yes      |
| `documentId`                                              | explicit lists, excluding in-review and held ids | add        | add      |
| `source`                                                  | "records from this Dataset"                      | add        |          |
| `created_ts` (unix seconds)                               | scope frozen at `openedAt`                       | add        |          |
| `verified_<section>_ts` (hours, status, address, contact) | verify drives (§5.2)                             | add        |          |
| `needs`                                                   | every gap key from the registry                  | yes        |          |
| `area_name`                                               | "Town or county" search in a drive               | searchable |          |

`FindQuery` (`apps/ui/src/lib/find-search.ts`) gains `area` as a place level and a `source` filter, so a single-place drive scope round-trips to Find libraries. Database indexes for the same columns go in `HOT_PATH_INDEXES` (`apps/strapi/database/migrations/shared/hot-path-index-sql.js`): `libraries(completeness)`, `libraries(last_verified_at)`, `libraries(source)`. No new migration file (pre-launch rule). Reseed with `pnpm --filter @repo/strapi seed:meilisearch` after imports, never during one.

### 3.4 Record corrections score like edits

`submission.ts` awards a `correction` with `fields.kind: "record"` the same as a `library_edit`: `edit_accepted_minor` (5) or `edit_accepted_major` (15), by the count of allowlisted fields. Photo (8), source (3) and other corrections (2) are unchanged.

### 3.5 Known limit: unknown days

The opening-times model can't tell "closed on Sunday" from "Sunday not recorded" (`enabled: false` means closed). So a drive can't target "weekend hours missing". The mockup's "Sunday hours for London" drive is out of scope until opening-times v2 adds an unknown state, which needs its own spec.

## 4. Workstream B: Community section

### 4.1 Routes

| Route                           | Page                                                           |
| ------------------------------- | -------------------------------------------------------------- |
| `/community`                    | Noticeboard (§5.5)                                             |
| `/community/drives/[slug]`      | Drive page (§5.6)                                              |
| `/community/drives/[slug]/edit` | Drive builder, editorial board only (§5.7)                     |
| `/community/propose`            | Drive builder as a proposal (§5.7)                             |
| `/community/leaderboard`        | Moved from `/contribute/community` (components move unchanged) |
| `/community/suggestions`        | Option votes: the hub's `SuggestedAdditions`, as a full page   |

`app/[locale]/community/layout.tsx` renders `GlobalHeader` and a `T.bg.void` wrapper, with no noindex default. Each page opens with `PageHero` and `tabs={<CommunityNavBar/>}` (`SectionTabs`: Noticeboard, Leaderboard, Suggestions). Before launch nothing redirects: links are updated and `/contribute/community` is deleted. After launch the move would need a redirect, which is why it's offered for the pre-launch band (§14).

### 4.2 Navigation

- `components/global/GlobalHeader.tsx` `NAV_LINKS`: add "Community" → `/community`, after Find libraries.
- `contribute/_components/ContributeNavBar.tsx`: remove the Community tab. The hub keeps a "Help with a drive" card (§9).
- `lib/contributor-shortcuts.ts`: a new "drives" group for every signed-in user, linking to the Featured Drive and "All drives". Plain contributors get a Contribute menu for the first time.
- Footer columns are CMS content (`api::footer.footer`): add a Community link there, not in code.

### 4.3 Content Manager groups

`apps/strapi/src/content-structure/groups.json` groups every visible collection by site section. With the new content types:

- Add a **Community** group: `api::drive.drive`.
- `api::drive-credit.drive-credit` and `api::drive-hold.drive-hold` are hidden (`content-manager.visible: false`), like the plugin collections.
- Decide whether `api::topic.topic` moves from Utilities to Community: it's community-suggested, but it serves as a taxonomy (interests, article tags). Open decision OD-1.
- Group the single types (homepage, blog-landing, wiki-landing, footer) under Pages & Content while editing the file.
- Editing `groups.json` restarts `strapi develop`, so it ships with the drive schema work, never during an import.

## 5. Workstream C: Drives

### 5.1 Content type `api::drive.drive`

Draft & Publish on (house rule): the published version is what the site reads. The lifecycle below is a separate `status`.

| Attribute                      | Type                                     | Notes                                                                                                                   |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `title`                        | string, i18n, required                   | Serif card title; `*italic*` markup as `PageHero`                                                                       |
| `slug`                         | uid (title), not i18n                    |                                                                                                                         |
| `summary`                      | text, i18n, required, ≤ 280              | Card and hero lead                                                                                                      |
| `steps`                        | component `drive.step`, repeatable, i18n | "How to help": 1–5 short steps                                                                                          |
| `focus`                        | enum                                     | `gaps`, `verify` or `record`                                                                                            |
| `gaps`                         | JSON (gap keys)                          | For `gaps`: 1–3 keys from the registry, all filled by one panel                                                         |
| `recordTarget`                 | integer 50–100                           | For `record`: a library is done at this completeness                                                                    |
| `verifyBefore`                 | datetime                                 | For `verify`: sections verified before this count as gaps; fixed when opened                                            |
| `scope`                        | component `drive.scope`                  | §5.2                                                                                                                    |
| `whereToLook`                  | component `drive.source`                 | `name`, `url`, `licenceNote`: where the answers are, and on what terms                                                  |
| `unit`                         | enum `library`, `branch`, `record`       | The noun on progress ("142 of 251 branches"); translated in messages                                                    |
| `startsAt`, `endsAt`           | datetime, required                       | `endsAt` ≤ `startsAt` + 90 days                                                                                         |
| `goalPercent`                  | integer 1–100, default 100               | Shown only when it isn't 100                                                                                            |
| `status`                       | enum                                     | `draft`, `scheduled`, `open`, `closed`, `cancelled`                                                                     |
| `closedReason`                 | enum                                     | `goal`, `ended`, `cancelled`                                                                                            |
| `pinned`, `pinOrder`           | boolean, integer                         | Editorial board only; at most six pinned open drives                                                                    |
| `featured`                     | boolean                                  | At most one; must be pinned                                                                                             |
| `openedAt`, `closedAt`         | datetime                                 | Set by the cron (§5.4)                                                                                                  |
| `baseline`                     | JSON                                     | `{ total, done, at, centroid }` at opening; `centroid` is the mean `_geo` of one 1,000-hit page of tasks, for "Near me" |
| `progressLog`                  | JSON                                     | One `{ day, total, done, inReview }` per day, at most 90                                                                |
| `final`                        | JSON                                     | `{ total, done, closedGaps, helpers, credits }` at closing                                                              |
| `createdByUserId`              | string                                   | `ba:` id of the board member or proposer                                                                                |
| `proposalSubmissionDocumentId` | string                                   | When it came from a Drive Proposal                                                                                      |

Component `drive.scope` (not i18n):

| Attribute                                     | Type                               | Notes                                          |
| --------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| `continents`, `countries`, `regions`, `areas` | relations (manyToMany)             | A library in any listed place matches          |
| `libraries`                                   | relation (manyToMany), at most 500 | An explicit list; when set, places are ignored |
| `libraryTypes`                                | JSON (enum values)                 | Empty means every type                         |
| `source`                                      | string (Dataset key)               | "Records from" on the card                     |
| `completenessBelow`                           | integer                            | Optional ceiling                               |

`permanently_closed` libraries are always outside a scope.

### 5.2 Scope and gap as one filter

`packages/shared-data/drive-scope.ts` turns a drive into two things, from one definition:

- `driveFilter(drive)`: a Meilisearch filter string for the scope, and one for scope plus gap. Places become `continent_slug IN [...] OR country_slug IN [...] OR …`; explicit lists become `documentId IN [...]` (row ids change on every publish); then `libraryType IN`, `source =`, `completeness <`, `created_ts <= openedAt`, `operationalStatus != "permanently_closed"`, and the locale clause. The gap is `needs IN [<gaps>]` (any listed gap is a task), `completeness < recordTarget`, or `verified_hours_ts < verifyBefore` (and status/address/contact likewise).
- `libraryInDrive(library, drive)`: the same rules as a pure predicate over a library with its place documentIds, for credit at approval (§6.3) and for the policy check (§6.2).

Parity tests run both against the same fixtures. Before a drive opens there is no `openedAt`, so the builder's preview uses now.

### 5.3 Progress

Coverage, as the mockup shows it ("142 of 251 branches have hours"):

- `total`: libraries in scope. `remaining`: in scope with the gap. `done = total − remaining`. Both come from one `multiSearch` of two `limit: 0` queries counted through the `locale` facet, so they stay exact past Meilisearch's 1,000 hits.
- `inReview`: pending or needs-info Submissions with this `driveDocumentId`, a grouped SQL count on an indexed column. They are drawn as a segment of the bar, not taken off `remaining`.
- `helpers`: distinct users with a Drive Credit or a tagged Submission that isn't a draft.
- The goal is met when `done / total ≥ goalPercent / 100`.

Server reads are cached for 60 seconds with the tag `drive:<documentId>`. A moderation decision on a tagged Submission revalidates the tag. Meilisearch lags writes by seconds, which is fine. Only published libraries are indexed, so imported drafts don't count until they're published.

### 5.4 Lifecycle cron

`config/cron-tasks.ts`, hourly:

- `scheduled` and `startsAt` passed: compute the gap count with `openedAt = now`. Over 2,000 tasks, or zero, and the drive stays `scheduled` with a note for the board. Otherwise it becomes `open`, with `openedAt` and `baseline` set.
- `open` and (goal met or `endsAt` passed): becomes `closed` with `closedReason`, `closedAt` and `final`, and the finisher bonus and thank-you emails are queued (§8).
- Once a day per open drive: append to `progressLog`.

Each drive is handled under the rewards plugin's leader lock pattern, so two instances don't open or close the same drive.

### 5.5 Noticeboard (`/community`)

Top to bottom, as the mockup with the review's changes:

1. **`PageHero`**: breadcrumb "Community", title "The _noticeboard_.", lead. The slot holds "Propose a drive" (a secondary pill: board members see "New drive") and a status line ("6 open drives, 214 people helping"). The tabs are the Community tabs (§4.1).
2. **Focus filter**: links `?focus=hours|photo|accessibility|contact|verify|record` with counts, `aria-current` on the active one. Kinds with no open drive are hidden.
3. **Featured Drive** (`FeaturedDrive`): chips (Featured, Focus, place), dates (§5.8), serif title, summary, `DriveProgress`, then the task list and the panel side by side (§6.1). On mobile "Give me a library" comes before the list, and the panel is the correction drawer.
4. **All open drives** (`DriveCard` grid): Focus chip, dates, title, summary, place on one line and "Records from" on the next, a bar, "142 of 251 branches", "38 helping". A "Near me" button orders drives by the distance to their `baseline.centroid` (geolocation on click only, as Find libraries). Signed-in users get "Places I follow", from their Saved Libraries' Regions.
5. **Recently finished**: the last five closed drives, with their final counts and helper totals.
6. **Propose band**: "Spotted a gap? _Propose a drive._", the three rules (one Focus per drive, a finish line and an end date, openly licensed sources) and "How drives work" (a Knowledge article).

Note (2026-10-05): the hero's "Propose a drive" pill and the "Propose as a drive" action on each "Gaps worth a drive" row arrive with D2; neither control is shown until then.

Empty states are honest: "No drives are open right now", and "This drive has finished. Thank you" with the final stats.

### 5.6 Drive page (`/community/drives/[slug]`)

The canonical, shareable page: hero (chips, title, summary, dates, share), `DriveProgress` with a sparkline from `progressLog`, How to help (`steps`), the task list and panel, Your part, Helpers (this week and all time), and Rules (Focus, where to look and its licence note, records from, goal, end date). A finished drive keeps its page: the final numbers, the helpers whose activity is public, a link to its Journal story if there is one, and no task list. A cancelled drive is `noindex`.

### 5.7 Builder and proposals

One builder, two modes: `/community/propose` for anyone eligible and `/community/drives/[slug]/edit` (or New drive) for the editorial board.

1. **Focus**: gap keys (one panel must fill them all, so the builder only offers compatible sets), verify with a date, or whole record with a target.
2. **Scope**: place pickers at every level (multi-select, reusing the Index editor's cascading selects), types, Dataset, completeness ceiling, or a library list. "Propose a drive from these results" on Find libraries pre-fills this from its `FindQuery`.
3. **Live counts**: "251 in scope, 109 to do", recomputed as the scope changes. Over 2,000 to do, the builder says so and suggests splitting by region.
4. **Where to look**: a name, URL and licence note. The help text says that facts from a library's own site are fine and that map services' data isn't.
5. **Words**: title, summary, steps. The content-safety matcher runs as on every form.
6. **Dates and goal.**

The board's builder writes the drive directly: `POST /api/drives`, gated by `requireCapability("drives.manage")`, which Strapi re-checks against the caller's grants. Anyone else's builder sends a `drive_proposal` Submission with the definition in `draftData` (§7.2).

### 5.8 Dates

One rule everywhere: an absolute date by default ("Ends 31 Oct"); relative at 14 days or fewer ("12 days left"); at 7 days or fewer, the warning tone plus a clock icon ("5 days left"), never colour alone. Finished: "Closed 12 Sep".

### 5.9 Components (`apps/ui/src/components/drives/`)

`DriveCard`, `FeaturedDrive`, `DriveProgress` (a labelled `role="img"` bar with `aria-describedby` text: "142 of 251 have hours, 9 in review"), `DriveFocusChip`, `DriveDates`, `DriveTaskList`, `DriveTaskRow`, `DriveTaskPanel`, `DriveYourPart`, `DriveHelpers`, `DriveRules`. Focus tints are new token pairs in `lib/design-tokens.ts` (`FOCUS_TINT`, built from the existing type tints). If `DriveProgress` proves generic it moves to `components/ds/` as `ProgressMeter`.

## 6. Workstream D: Tasks and credit

### 6.1 The task panel

The panel hosts the existing editor for the Focus. It never builds a new one.

| Focus           | Editor                                                                                                 | Submission                                     |
| --------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `hours`         | `OpeningTimesEditor` (split periods, staffing, "Copy to…"), starting empty                             | `correction`, `kind: "record"`, `openingTimes` |
| `photo`         | `PhotoUpload` with credit and licence                                                                  | `correction`, `kind: "photo"`                  |
| `accessibility` | The library page's Yes/No facility questions                                                           | `correction`, `kind: "facilities"`             |
| `services`      | The services and amenities editors                                                                     | `correction`, `kind: "record"`                 |
| `contact`       | The links editor (website, phone, email)                                                               | `correction`, `kind: "record"`                 |
| `verify`        | The "Still right?" confirm view (§3.2)                                                                 | `correction`, `kind: "verify"`                 |
| `record`        | A checklist of that library's own gaps, each opening its editor; one record correction for all of them | `correction`, `kind: "record"`                 |

Every panel has:

- the library's name and place
- "Open the library's website" when it has one, or "Search for this library" when it doesn't (IMLS records have no website)
- a required "Where did you find this?" (`evidenceUrl`)
- **Send and get the next one**
- **Skip** (kept in the session; the picker won't offer it again)
- "This library has closed or moved", which opens the status and address editors in the same panel

A claimant sends a `library_edit` instead, as everywhere else. A signed-out reader sees the panel's sign-in prompt, and onboarding runs as usual.

After sending, the panel announces "Sent for review" with `aria-live`, moves focus to the next library's name, and the list marks the row "In review". Each row's action has an accessible name that includes the library ("Add hours for Worthington Libraries, Northwest").

**Your part** shows sent, in review and accepted for this drive, and the pending quota: "3 of 5 waiting for review". At the limit, the send button says why and links to My submissions. `/api/contribute/standing` gains `pendingCount` and `pendingLimit`. Under Archivist, it also says "Drive work counts toward earned Pro: 340 points to Archivist."

### 6.2 Submissions carry the drive

- `plugin::content-moderation.submission` gains `driveDocumentId` (string), indexed with status in `HOT_PATH_INDEXES` (`cm_submissions(drive_document_id, status)`).
- `utils/payload-hash.ts` includes it. Rows without one hash as before.
- `controllers/submission.ts` accepts it as a top-level key; today unknown top-level keys are dropped.
- `submission-policy.check` refuses a tagged Submission (422, with a reason) when:
  - the drive isn't published and open
  - the target library fails `libraryInDrive`
  - the Submission's kind and fields don't fill the drive's Focus (for example, an hours drive needs `openingTimes`, or a status change from "closed or moved")

  The panel then offers to send the change without the drive.

- Nothing else changes: same queue (`index`), same review, same apply. ADR-0005 stands: a drive never skips review.

### 6.3 Drive Credit

`api::drive-credit.drive-credit` (`routes: []`, hidden in the Content Manager):

| Attribute              | Type            |
| ---------------------- | --------------- |
| `driveDocumentId`      | string, indexed |
| `baUserId`             | string, indexed |
| `submissionDocumentId` | string, unique  |
| `libraryDocumentId`    | string          |
| `tagged`               | boolean         |
| `acceptedAt`           | datetime        |

It's written after the commit in `updateStatus` (beside the points awards, non-fatal, idempotent through the unique key):

- **A tagged Submission** is credited to its drive when approved.
- **An untagged approved `correction` or `library_edit`** is checked against the open drives (a cached list, at most a few dozen). It's credited to each drive whose `libraryInDrive` holds and whose Focus fields it sets. This credits people who fixed hours from the library page.
- A drive's leaderboard is `COUNT(*) GROUP BY ba_user_id` over its credits, by week or all time, cached 60 seconds. Names follow `isActivityPublic`; anyone hidden shows as "A contributor".

### 6.4 Holds (third delivery band)

"Give me a library" (`POST /api/drives/[slug]/next`) returns the first library in the task list that isn't in review, held or skipped. It places a 20-minute hold (`api::drive-hold.drive-hold`: drive, library, user, `expiresAt`; unique on drive and library), so two helpers don't fill the same record. The hold is released on send or skip. Rows held by someone else show "Someone's on this". Until holds ship, "Give me a library" picks at random from the first page, which makes collisions rare. Rate limit: 30 a minute per user.

### 6.5 Task list API

`GET /api/drives/[slug]/tasks?q=&near=lat,lng&page=` asks Meilisearch for one page of 10 libraries, with this filter:

- scope plus gap
- `NOT documentId IN [...]` for the pending and held libraries (bounded by the 2,000-task cap)

It sorts by completeness descending: "Most complete first" says what that means. With `near`, it sorts by `_geoPoint` instead. `q` searches name, city, district, area and region names within the scope.

## 7. Workstream E: Moderation

### 7.1 The queue knows about drives

- Moderation list: a `drive` parameter (a documentId rule in `lib/moderation-proxy.ts`, passed to Strapi's scoped list).
- Queue rows and the review page header: a drive chip linking to the drive.
- After a decision on a tagged Submission: **Next in this drive** opens the next pending one in the caller's scope.
- The moderation stats endpoint adds pending counts per open drive, so Moderators can see which drive is backing up.

### 7.2 Drive Proposals

A new Submission type, `drive_proposal`, in the `index` queue. Places to change, from the access review:

- `packages/access/src/capabilities.ts`: `SUBMISSION_TYPES`, `QUEUE_OF_SUBMISSION_TYPE`, `Capability` (`submit.driveProposal`, `drives.manage`), `resolveCapabilities` (`drives.manage` from an `editorial_board` grant), and `canSubmit`. Its default is `false`, so add the case explicitly. Rebuild and update the tests.
- The submission schema's `submissionType` enum; `targetEntityType` gains `drive`.
- `apps/ui/src/components/moderation/submissionMeta.ts` labels, `email-templates.ts`, `submission-summary.ts`, `target-labels.ts`, the admin `submissionMeta.ts`, `YourSubmissionsList`, `ActivitySection` and the contributions routes.
- `submission-policy`: signed in; 5 accepted Submissions that aren't applications (the `acceptedCount` rule); one open proposal at a time; `checkContent` over the definition; the 2,000-task cap checked again.
- **Review panel** (`DriveProposalPanel`): the definition, live counts, the "where to look" link, and the proposer's standing.
- **Approval**: creates the drive (`scheduled`, unpinned), records `resultDocumentId`, and awards `drive_proposal_accepted` (+10). The `drive_starter` badge is awarded when the drive opens. A Moderator can change the dates before approving through the existing Moderator edit key (`draftData.moderatorEdit`, which contributor input can never set).

### 7.3 Board actions

`PUT /api/drives/[documentId]` (pin, unpin, feature, reorder, cancel, edit text) is gated by `requireCapability("drives.manage")` and re-checked in Strapi. At most six pinned open drives and one featured, enforced in Strapi. The owner's admin keeps the Content Manager.

## 8. Workstream F: Recognition

- **Point actions** (schema enum in `rewards/server/content-types/point-event/schema.json`, values in `points.ts`, the "How it works" list in `controllers/rewards.ts`, the admin dashboard labels):
  - `drive_task_accepted` (+2, key `${submissionDocumentId}:drive_task`)
  - `drive_finished` (+25, key `${driveDocumentId}:${baUserId}:drive_finished`, for each helper with 5 or more credits when a drive closes with its goal met)
  - `drive_proposal_accepted` (+10)
- **Badges** (`rewards/server/services/badges.ts` and `apps/ui/src/lib/badges.ts`, kept in step):
  - first credit in any drive (working name "Book Drive")
  - credits in 5 different drives ("Regular Reader")
  - helped a drive that met its goal ("Returned on Time")
  - your proposal opened as a drive ("Pinned Notice")
  - 25 accepted hours tasks in drives ("Opening Hours")

  Names follow the existing library-themed set (First Light, Overdue Fine, Card Catalogue) and are the owner's to confirm. The existing photo, verification and edit badges keep counting drive work, because drive tasks are ordinary Submissions.

  `checkAndAward` gains drive counts (distinct drives credited, finished, started) from one grouped query on `drive-credit`.

- **Ribbons**: a Drives section on the profile's Recognition tab. It lists each drive the person helped (title, their accepted tasks, and a "Finished" mark when it met its goal), hidden when `showActivity` is off.
- **Thank-you email**: when a drive closes, each helper gets the final numbers and their own count. A new `notifPrefs.drives` (default on) controls it, alongside the existing email preferences. It's queued after the commit like today's notifications, and logged and skipped without mail credentials.
- No drive leads to Pro directly (decision 9).

## 9. Workstream G: Touchpoints

| Where                   | Change                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage                | `components/home/sections/ContributeSection.tsx`: the Featured Drive card replaces the three gap tasks (`fetchIncompleteLibraries` and `pickTasks` stay as the fallback). It's data-driven: the homepage has no dynamic zone                                  |
| Contribute hub          | "Drives you can help with" (pinned drives, places-you-follow first) replaces `RecordsThatNeedYou`, which stays when no drive applies; `SuggestedAdditions` links to `/community/suggestions`                                                                  |
| Library page            | `LibraryHelpPanel`: when the library is a task in an open drive, "Part of _Ohio's opening hours_ · 142 of 251 done" and the drive's editor, tagged. The page is `force-static`, so it's a small client fetch: `GET /api/drives/for-library/[documentId]`      |
| Location pages          | "Drives here" on continent, country, region and area pages; "Propose a drive for {place}" with the scope pre-filled (the unused `LocationContributeCTA` fits); region gap stats from Meilisearch facets instead of the first 100 records (`RegionDetailPage`) |
| Find libraries          | When the filters match an open drive: "There's a drive for this search". For anyone eligible: "Propose a drive from these results"                                                                                                                            |
| Moderation              | Workstream E                                                                                                                                                                                                                                                  |
| My submissions, profile | A drive chip on tagged Submissions; the Drives ribbons                                                                                                                                                                                                        |
| Header, Contribute menu | §4.2                                                                                                                                                                                                                                                          |
| Ingest READMEs          | A closing step in `scripts/ingests/*/README.md`: after publishing a dataset, propose a drive for what it lacks (IMLS PLS: hours, website, email)                                                                                                              |
| Knowledge, Journal      | A "How drives work" Knowledge article; a finished drive is a natural Journal story, linked from its page                                                                                                                                                      |

## 10. Scale (ADR-0004)

- No read walks the library table. Progress is two count-only Meilisearch queries; task lists are one page; in-review, helper and leaderboard counts are grouped SQL on indexed drive ids.
- The 2,000-task cap keeps drives finishable and keeps `NOT documentId IN [...]` filters and credit checks small. A country-wide drive is split by region.
- Credit at approval checks one library against the open drives: a pure predicate over a cached list.
- `progressLog` is at most 90 entries per drive. Drive Credits grow with accepted work, not with the index.

## 11. Security and privacy

- Every write goes through a Next route with the session, and Strapi re-checks the drive, the scope and the caller's capabilities. The board's routes need `drives.manage` on both sides.
- Rate limits: task list 120 a minute, next and hold 30 a minute, proposals within the existing Submission limits.
- Drive text, proposals and "where to look" go through `checkContent`; links follow the content-safety link rules.
- Names on leaderboards, helper lists and finished drives appear only when the person's activity is public.
- Holds and skips reveal nothing about who holds a record, only that someone does.

## 12. Testing

- **Unit (`packages/shared-data`):** the gap registry against every consumer's fixtures; `driveFilter` and `libraryInDrive` parity; the date rule.
- **Unit (Strapi):**
  - the policy refusals for tagged Submissions
  - credit for tagged and untagged approvals, idempotent across two approvals
  - the cron's open and close rules, including the cap and the leader lock
  - points and badges
  - `drive_proposal` apply
  - verify apply and `verifiedSections`
- **Unit (UI):** progress maths and copy; the panel's focus, announcement and skip; the quota line.
- **E2E (`npx playwright test --project=access`):**
  1. A contributor fixture sends hours from the Noticeboard.
  2. `moderator-global` filters the queue by the drive and approves.
  3. The drive's progress and leaderboard update.
  4. An `editorial_board` fixture creates, pins and features a drive.
  5. The `applicant` fixture (5 accepted) proposes one, and a Moderator approves it.

## 13. Out of scope

- Per-drive badges, and any drive-to-Pro grant (decisions 9 and 11)
- Native-name drives, until `alternateNames` is typed (decision 14)
- "Unknown day" hours and weekend-hours drives (§3.5)
- Import-review and duplicate-hunting drives, which need a merge flow
- A drive layer on the Atlas, which waits for the vector-tiles plan
- The weekly digest (`notifPrefs.weeklyDigest` still sends nothing)
- Following places
- Drives run by Verified Librarians for their own libraries
- Translating drive text beyond the default locale while `LIVE_LOCALES` is `[en]`

## 14. Delivery order

0. **Before go-live (optional, small):** create the Community section with Leaderboard and Suggestions, add the header link and remove the Contribute tab (§4.1–4.2). This avoids a redirect later. Owner's call (OD-6).
1. **Groundwork (after launch):** the gap registry, verify, index fields and reseed, record-correction points, and region stats from facets.
2. **D1, board-run drives:**
   - the Drive type, scope and filters, progress and cron
   - the Noticeboard and drive page
   - the task panel for hours, photo, accessibility and contact
   - `driveDocumentId`, credit and per-drive leaderboards
   - the moderation filter, chip and "Next in this drive"
   - the board's builder and actions
   - the Community group in `groups.json`
3. **D2, community:**
   - Drive Proposals and the proposal builder
   - "Propose from these results"
   - points, badges and ribbons
   - the thank-you email
   - the homepage, hub, library page, location page and Find libraries touchpoints
4. **D3, more:** verify and whole-record drives, holds, "Places I follow", the README steps, and the Knowledge article.

## 15. Open decisions

Proposed and accepted by the owner on 2026-10-05: build every default below. Band 0 (§14) is approved for before go-live, and the whole spec is to be built.

| #    | Question                                                            | Default                                                                            |
| ---- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| OD-1 | Does Topic move to the Community group in the Content Manager?      | **No**: it stays in Utilities, as a taxonomy                                       |
| OD-2 | Do holds ship with D1?                                              | **No**: D3; a random first-page pick until then                                    |
| OD-3 | Does a confirmed "No" fill an accessibility item?                   | **Yes**: an answered question is not a gap                                         |
| OD-4 | Progress nouns                                                      | **library, branch, record**; no "stops" or "rooms", which aren't records           |
| OD-5 | `lastVerifiedAt` becomes the latest per-section verification (§3.2) | **Yes**                                                                            |
| OD-6 | Build the Community section before go-live (band 0)?                | **Yes**, if the launch blockers leave room; otherwise after launch with a redirect |
| OD-7 | `drive_proposal_accepted` points                                    | **+10**                                                                            |
| OD-8 | Who sees "New drive" in the hero?                                   | **The editorial board only**; Moderators review proposals but don't create         |
