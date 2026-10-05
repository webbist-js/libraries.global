# Community UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three `/community` pages (Noticeboard, Leaderboard, Suggestions) to the owner's Claude Design mockups and wire them to real data. Suggestions gain direct posting, a status lifecycle and board notes. The leaderboard gains approved counts and acceptance rates.

**Architecture:** Strapi owns the data. The content-moderation plugin's Option Suggestions gain fields, statuses, a create route and board status actions. The rewards plugin's leaderboard and standing gain counts and period ranks. The UI renders server-side through `lib/community/*-server.ts` fetchers. Client islands (voting, the suggestion form) talk only to Next `/api/*` routes. Shared rail cards live in `components/community/`.

**Tech Stack:** Next.js 16 RSC, Tailwind v4, `T` tokens, `components/ds`, Strapi v5 plugins (Document Service, knex for aggregates), Meilisearch facets, Vitest, Playwright.

**Visual reference (read before any UI task):** the local, git-ignored `.scratch/community-ui/`:

- `Community.dc.html`: the Claude Design source. Its inline styles give exact sizes, radii and copy. Its script block at the bottom holds the copy and states.
- Screenshots: `noticeboard.png`, `leaderboard.png`, `suggestions.png`.

Names and counts in the mockup are illustrative; render real data. Where the mockup's hex values match a token, use the token (see Global Constraints).

## Global Constraints

- **Tokens:** colours and fonts come from `T` (`apps/ui/src/lib/design-tokens.ts`) or the `--t-*` / `--tint-*` CSS variables. Mockup hex → token:
  - `#FAF8F4` → `T.bg.void`; `#F1EDE5` → `T.bg.space`; `#fff` → `T.bg.deep`; `#FBFAF7` → `T.bg.surface`; `#F3F0EA` → `T.bg.muted`
  - `#17162B` → `T.ink.base`; `#45435A`, `#55536A`, `#2A2940` → `T.ink.dim` (or `T.ink.base` for body copy)
  - `#E7E3DB` → `T.border.line`; `#D9D3C9` and `#BDB6AA` → `T.border.hi`; `#F0ECE5` → `T.border.divider`
  - `#4338CA` → `T.accent.primary`; `#3730A3` → `T.accent.primaryHover`; `#ECEBFB` → `T.accent.chip`
  - `#2F5D3A` on `#E6EFE6` → `T.accent.ok` / public tint; `#A13A1A` → `T.accent.danger`
  - list tints come from `TYPE_TINT` / `--tint-*`
  - a colour with no token (the "You" row `#F6F5FD`) may be inline
- Serif (`T.font.serif`) for display headings and big numerals; sans for everything else; no mono. Pills are 999px, cards 20–28px, inputs 14px. The only shadow is the card hover `0 12px 28px rgba(23,22,43,.08)`.
- **Accessibility:**
  - status is always colour + icon + text
  - vote buttons have `aria-pressed` and an `aria-label` naming the option and count
  - counts that change are announced (`aria-live="polite"`)
  - progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`
  - filter pills sit in `role="group"` with an `aria-label`
  - touch targets are at least 44px
  - never suppress `:focus-visible`
- No client-side Strapi calls. Client components call Next `/api/*` routes only. Pages fetch through `lib/community/*-server.ts` (`server-only`).
- Strapi v5: use `strapi.documents()` for reads and writes of records. Use knex (`strapi.db.connection`) only for grouped counts and aggregates, as the existing leaderboard and vote counts do.
- Scale (ADR-0004): cap every list (suggestions at most 500, leaderboard at most 50). Count in SQL, never by fetching rows. New indexes go in `apps/strapi/database/migrations/shared/hot-path-index-sql.js`, never in a new migration file.
- Pre-launch: no redirects, no migrations or backfills.
- Domain terms (CONTEXT.md): Option Suggestion, Library, Submission, Contributor Role, Editorial Board, Points, Tier.
- **Copy:** plain English, sentence case, curly apostrophes (’), and the mockup's copy unless this plan says otherwise. The Noticeboard's "Propose a drive" controls are **not** built here: proposals arrive with the drives work (D2, `/community/propose`). Never show a control that does nothing.
- **Commits:** conventional prefixes (`feat(strapi):`, `feat(ui):`, `test:`, `docs:`). Never add `Co-Authored-By` or any self-credit line. Never use `git stash`, worktrees or `--no-verify`. Lint runs on pre-commit; fix errors.
- After plugin changes:
  1. run `pnpm --filter @repo/strapi build:plugins && touch apps/strapi/src/index.ts`
  2. wait until `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1337/_health` prints `204`
  3. never touch Meilisearch on port 7700, only 7701

---

### Task 1: Option Suggestions v2 (Strapi)

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/option-suggestion/schema.json`
- Modify: `apps/strapi/src/plugins/content-moderation/server/utils/option-suggestions.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/option-suggestion.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/moderation.ts` (the `optionSuggestions` / `decideOptionSuggestion` handlers)
- Modify: `apps/strapi/src/plugins/content-moderation/server/routes/content-api.ts`
- Modify: the `recordSuggestion` caller in `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (pass the submitter)
- Modify: `apps/strapi/database/migrations/shared/hot-path-index-sql.js`
- Modify: the admin Suggestions tab, only if it filters on `status === "open"` (`apps/strapi/src/plugins/content-moderation/admin/src/…`): treat `open`, `reviewing` and `planned` as undecided
- Test: `apps/strapi/tests/content-moderation/option-suggestions.test.ts`
- Docs: the "Suggested additions" bullet in `CLAUDE.md` (Future Goals §3)

**Interfaces:**

- Produces: `GET /api/content-moderation/option-suggestions`, which returns `{ data: PublicSuggestion[] }`:
  - `documentId`, `name`
  - `optionKey`: `"accessibility" | "amenities" | "services" | "library_types"`
  - `status`: `"open" | "reviewing" | "planned" | "accepted" | "declined"`
  - `votes`, `voted?` (only when the bridge user headers are present)
  - `description: string | null`
  - `suggestedByName: string | null`
  - `createdAt`, `decidedAt: string | null`
  - `decisionNote: string | null`, only for `declined` and `planned`, otherwise null
  - `libraryCount: number`
  - `removed` suggestions are never returned
- Produces: `POST /api/content-moderation/option-suggestions` (bridge user headers, like `vote`):
  - body `{ optionKey, name, description? }`
  - `201 { data: PublicSuggestion }`, with `voted: true` and `votes: 1`
  - errors: `400 { error: { message } }`; `409 { error: { message, details: { existingDocumentId? } } }`; `429`; `401`
  - use Strapi's `ctx.badRequest`, `ctx.conflict` or `ctx.tooManyRequests`, or set `ctx.status` and `ctx.body` in the same `{ error: { message, details } }` shape
- Produces: `PUT /moderation/option-suggestions/:id` (board) and admin `PUT /option-suggestions/:id`:
  - body `{ decision: "accept" | "decline" | "review" | "plan" | "remove", name?, note? }`
- Produces: `GET /moderation/option-suggestions` (board), which returns every suggestion except `removed`, with `description`, `suggestedByName` and the existing board fields.

- [ ] **Step 1: Schema.** Edit `schema.json` by hand or with a small Python script. Keep the diff to these lines and don't reformat the file.
  - `optionKey` enum: `["accessibility", "amenities", "services", "library_types"]`
  - `status` enum: `["open", "reviewing", "planned", "accepted", "declined", "removed"]`
  - add `"description": { "type": "text", "maxLength": 400 }`
  - add `"suggestedBy": { "type": "string" }` (a Better Auth user id)
  - update the `description` in `info`: "A new accessibility feature, service, amenity or library type that contributors asked for, posted directly or named in a correction. The editorial board reviews them monthly."
- [ ] **Step 2: Write failing tests** in `option-suggestions.test.ts`, following its existing fake-strapi style:
  - **createSuggestion validation:**
    - creates an open suggestion with the creator's vote; `votes` is 1 and `voted` is true
    - refuses a name shorter than 2 characters after trimming (400), or longer than 80
    - refuses a description longer than 400 characters (400)
    - refuses unsafe text: the name or description fails `findUnsafeContent` from `@repo/shared-data` (400, with the checker's message)
  - **createSuggestion duplicates and limits:**
    - 409 "That option is already in the lists." when a published option in that list has the same name, case-insensitively
    - for `library_types`, the same 409 when the name matches a value of `api::library.library`'s `libraryType` enum, read from `strapi.contentType("api::library.library").attributes.libraryType.enum`
    - 409 "Someone has already suggested this. Vote for it instead." with `existingDocumentId` when an `open`, `reviewing`, `planned` or `accepted` suggestion has the same `optionKey` and `nameKey`
    - 409 "The editorial board decided not to add this one." when the match is `declined` or `removed`
    - 429 "You can suggest up to 5 options a day." when the user already created 5 in the last 24 hours (`suggestedBy` plus `createdAt`, counted with `documents().count`)
  - **Voting:** `toggleVote` accepts `open`, `reviewing` and `planned` suggestions and refuses `accepted`, `declined` and `removed`.
  - **Board status changes** (`setSuggestionStatus`):
    - `review` moves open → reviewing
    - `plan` moves open|reviewing → planned and stores an optional note as `decisionNote`
    - `remove` moves open|reviewing|planned → removed
    - each records `decidedAt` and `decidedBy`, except `review`
    - a final status (accepted, declined, removed) can't move: the result is not found
  - **Decisions** (`decideSuggestion`):
    - decline needs a non-empty note (400 "Add a note: it’s shown with the suggestion.")
    - accept works from open, reviewing and planned
    - accepting a `library_types` suggestion whose name isn't in the enum is refused (400 "Add the library type to the schema first, then accept it. Mark it planned until then.")
    - accepting one whose name is in the enum sets `accepted`, renames it to the enum's spelling and creates no option
  - **Lists:**
    - the public list drops `removed`
    - it maps `suggestedBy` to "Firstname L." when the profile's activity is public (`isActivityPublic` from `apps/strapi/src/utils/activity-visibility`), else null
    - it nulls `decisionNote` except for `declined` and `planned`
  - **recordSuggestion:**
    - stores `suggestedBy` on create
    - treats `removed` like `declined`
    - counts a request on `reviewing` and `planned` suggestions
- [ ] **Step 3: Run the tests** and watch them fail: `cd apps/strapi && pnpm vitest run tests/content-moderation/option-suggestions.test.ts` (use the repo's own test command if it differs; check `apps/strapi/package.json`).
- [ ] **Step 4: Implement in `utils/option-suggestions.ts`.**
  - **Constants:** export `SUGGESTION_LISTS` (the four keys), `isSuggestionList`, `VOTABLE_STATUSES = new Set(["open", "reviewing", "planned"])` and `DAILY_SUGGESTION_LIMIT = 5`.
  - **`createSuggestion(strapi, { optionKey, name, description, baUserId })`** returns `{ ok: true; suggestion: PublicSuggestion } | { ok: false; status: 400 | 409 | 429; message: string; existingDocumentId?: string }`.
    - Normalise the name with `trim().replaceAll(/\s+/g, " ")`, and the description with `trim()`, empty → null.
    - Create the vote in the same way `toggleVote` does.
  - **`setSuggestionStatus(strapi, { documentId, status, decidedBy, note? })`**: status is `"reviewing" | "planned" | "removed"`. The transitions are in the tests.
  - **`decideSuggestion`:** widen it to return `{ ok: true; data } | { ok: false; status: 400 | 404; message }` and update `decideFromRequest` to match.
  - **`decideFromRequest`:** route `review`, `plan` and `remove` to `setSuggestionStatus`, and `accept` and `decline` to `decideSuggestion`.
  - **`listSuggestions`:** add `description`, `suggestedBy` and `suggestedByName`. Load profiles with one `strapi.documents("api::user-profile.user-profile").findMany({ filters: { baUserId: { $in: ids } }, fields: ["baUserId", "firstName", "lastName", "username", "profileVisibility", "publicPrefs"], limit: 500 })`.
  - Keep the existing sort (votes plus requests).
  - Keep `OPTION_UIDS` for the three relation lists. `library_types` never touches an option collection.
- [ ] **Step 5: Controller and routes.**
  - Rename `listOpen` to `listPublic`. It returns every non-removed suggestion as `PublicSuggestion`, with the viewer's `voted`.
  - Add the `create` handler: `resolveUser`, 401 "Sign in to suggest an option.", then `createSuggestion`.
  - Add the `POST /option-suggestions` route next to the vote route, with the same config and policies.
  - Board list: return `listSuggestions` minus `removed`.
  - In `services/submission.ts`, pass `suggestedBy: submission.submittedByUserId` to `recordSuggestion`.
  - Hot-path indexes: `index("cm_option_suggestions", ["suggested_by", "created_at"])` and `index("cm_option_suggestions", ["option_key", "name_key"])`.
- [ ] **Step 6: Run the tests until they pass**, plus the whole content-moderation suite: `cd apps/strapi && pnpm vitest run tests/content-moderation`.
- [ ] **Step 7: Build and smoke test.**
  - Run `pnpm --filter @repo/strapi build:plugins && touch apps/strapi/src/index.ts`, then wait for `/_health` to return 204.
  - Run `curl -s http://127.0.0.1:1337/api/content-moderation/option-suggestions | head -c 400` and check it returns `{"data":[...]}`.
  - Regenerate types if the repo tracks plugin types: `pnpm --filter @repo/strapi generate:types` (commit only if files changed).
- [ ] **Step 8: Docs.** Rewrite the CLAUDE.md "Suggested additions" bullet:
  - contributors post suggestions directly from `/community/suggestions` or name them in corrections
  - lists: accessibility, amenities (shown as "Facilities"), services and library types
  - statuses: New, Under review, Planned, Added, Not adding (with a public board note), and removed (hidden)
  - 5 a day
  - the board decides at `/contribute/moderation/suggestions`
  - library types are accepted only once the enum has the value
- [ ] **Step 9: Commit:** `feat(strapi): direct option suggestions with a review lifecycle`

### Task 2: Leaderboard counts and period ranks (Strapi rewards)

**Files:**

- Modify: `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`
- Modify: the `my-standing` handler in `apps/strapi/src/plugins/rewards/server/controllers/` (read `?period=`)
- Test: `apps/strapi/tests/rewards/leaderboard.test.ts`

**Interfaces:**

- Produces: each `LeaderboardEntry` gains:
  - `approvedCount: number`: approved Submissions whose `reviewedAt` falls in the period (all of them for `all`)
  - `acceptanceRate: number | null`: whole percent, all time, approved / (approved + rejected); null when none were decided
  - `city: string | null`: hidden in the same cases as `country`
  - both counts leave out `submissionType = "role_application"`
- Produces: `Standing` gains:
  - `monthRank: number | null`
  - `periodRank: number | null`, for the requested period
  - each is null when the user has no points in that period
  - rank = 1 + the number of users whose summed `rw_point_events.points` since the period start is greater; `all` sums every event
  - `GET /api/rewards/my-standing?period=today|week|month|all` (default `month`)

- [ ] **Step 1: Write failing tests** in `leaderboard.test.ts`, following its existing knex-fake style:
  - entries carry `approvedCount` and `acceptanceRate` from one grouped query over `cm_submissions` for the page's user ids (`whereIn("submitted_by_user_id", ids)`)
  - `acceptanceRate` is null with no decided submissions
  - private profiles keep their counts but lose `city`
  - `getStanding(id, "week")` returns `periodRank` and `monthRank`; both are null with no points in the period
- [ ] **Step 2: Run** `cd apps/strapi && pnpm vitest run tests/rewards` and watch them fail.
- [ ] **Step 3: Implement.**
  - **Counts:** one knex query with conditional sums, for example `SUM(CASE WHEN status = 'approved' AND reviewed_at >= ? THEN 1 ELSE 0 END)`, grouped by `submitted_by_user_id`. Use bindings, never string interpolation.
  - **Period rank:** a grouped subquery over `rw_point_events`, `HAVING SUM(points) > ?`, counted.
  - **Caching:** the leaderboard memo stays as it is. `computeLeaderboard` adds the counts.
- [ ] **Step 4: Run the tests until they pass.**
- [ ] **Step 5: Build and smoke test.**
  - Run `pnpm --filter @repo/strapi build:plugins && touch apps/strapi/src/index.ts`, then wait for the 204.
  - Run `curl -s "http://127.0.0.1:1337/api/rewards/leaderboard?period=all&limit=3"` with the read-only token from `apps/ui/.env.local` (`STRAPI_REST_READONLY_API_KEY`) and check for the new fields. Never print the token.
- [ ] **Step 6: Commit:** `feat(strapi): leaderboard approved counts, acceptance rate and period ranks`

### Task 3: Community data layer (UI)

**Files:**

- Modify: `apps/ui/src/lib/types/leaderboard.ts` (add `approvedCount`, `acceptanceRate`, `city`; add `entryPlace(entry): string | null`, which gives "City, Country", "Country" or null)
- Modify: `apps/ui/src/lib/community/leaderboard-server.ts`:
  - `Standing` gains `monthRank` and `periodRank`
  - `fetchStanding(baUserId, period: LeaderboardPeriod = "month")` sends `?period=`
  - export `PERIOD_PHRASE`: `{ today: "today", week: "this week", month: "this month", all: "ever" }`
- Create: `apps/ui/src/lib/community/suggestions.ts` (shared, no `server-only`):
  - **Types:** `SuggestionList`, `SuggestionStatus`, `PublicSuggestion` (as in Task 1).
  - **`LIST_LABELS`:** `{ accessibility: "Accessibility", services: "Services", amenities: "Facilities", library_types: "Library types" }`.
  - **`LIST_ORDER`:** `["accessibility", "services", "amenities", "library_types"]`.
  - **`STATUS_META`:** `{ label, icon, bg, fg }` per status:
    - `open`: "New", `mdi:circle-outline`, neutral tint
    - `reviewing`: "Under review", `mdi:eye-outline`, academic tint
    - `planned`: "Planned", `mdi:calendar-blank-outline`, public tint
    - `accepted`: "Added", `mdi:check`, public tint
    - `declined`: "Not adding", `mdi:close`, special tint
  - **`isVotable(s)`:** true for open, reviewing and planned.
  - **`sortSuggestions(list, "top" | "new")`:**
    - `top`: declined last, then votes descending, then name
    - `new`: `createdAt` descending
  - **`nextBoardReview(now: Date): Date`:** the first Tuesday of the month, or the next month's first Tuesday once this month's has passed. A review day counts as upcoming.
  - **`formatBoardReview(d)`:** "3 November" (en-GB, day and month).
  - **`relativeAge(iso, now)`:** "just now", "5 days ago", "3 weeks ago", "2 months ago". Reuse a helper from `lib/article-helpers.ts` if one fits.
- Create: `apps/ui/src/lib/community/suggestions-server.ts` (`server-only`):
  - `fetchPublicSuggestions(): Promise<PublicSuggestion[]>`: cached with `next: { revalidate: 60, tags: ["option-suggestions"] }`, no viewer; `[]` on failure
  - `fetchOptionNames(): Promise<Record<SuggestionList, string[]>>`: the published accessibility, amenity and service names, sorted, at most 200 each, through the same public Strapi client `server.ts` uses (`revalidate: 3600`); `library_types` comes from `LIBRARY_TYPES` in `@/lib/meilisearch`
- Create: `apps/ui/src/lib/community/points.ts`: `POINTS_TABLE`, as `[label, value]` rows:
  - "New library approved" +50
  - "Major edit approved" +15
  - "Knowledge translation" +15
  - "Minor edit approved" +5
  - "Hours checked" +5
  - "Status checked" +5
  - "Daily streak" +1
- Modify: `apps/ui/src/app/api/option-suggestions/route.ts`. Add `POST`:
  - session required (401 "Sign in to suggest an option.")
  - `requireCapability(session.user, "submit.correction")`
  - `createRateLimiter({ name: "option-suggest", max: 10, windowMs: 60_000 })` per user id
  - forward only `optionKey`, `name` and `description` (strings) to Strapi with `userHeaders`
  - on 201, call `revalidateTag("option-suggestions", "max")`
  - pass the status and body through
  - `GET` stays as it is
- Test: `apps/ui/src/lib/community/__tests__/suggestions.test.ts` covers `sortSuggestions`, `nextBoardReview` and `relativeAge`:
  - 2026-10-05 → 2026-10-06
  - 2026-10-06 → 2026-10-06
  - 2026-10-07 → 2026-11-03
  - 2026-12-02 → 2027-01-05
- Test: the existing `leaderboard-server.test.ts`, plus an `entryPlace` test next to it.

- [ ] **Step 1:** Write the failing tests.
- [ ] **Step 2:** Run `cd apps/ui && pnpm vitest run src/lib/community` and watch them fail.
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** Run the tests until they pass, then run `cd apps/ui && pnpm tsc --noEmit -p .` (or the repo's typecheck script) and fix the errors this task caused.
- [ ] **Step 5: Commit:** `feat(ui): community data layer for suggestions and standing`

### Task 4: Shared rail cards and the Noticeboard (UI)

**Files:**

- Create in `apps/ui/src/components/community/`:
  - **`StandingCard.tsx`** (server-safe). Props: `standing: Standing | null`, `signedIn: boolean`, `initials: string`, `signInReturnTo: string`.
    - **Header:** an initials avatar (national tint), "Your standing" in serif 26, and "{tier.name} · Level {tier.level}" underneath.
    - **Tiles** (a `dl` grid, 2 columns):
      - This month: "#{monthRank}", or "Not ranked yet"
      - All time: "#{globalRank}", or "Not ranked yet" when `totalPoints` is 0
      - Total points
      - Streak: "{n} days", or "1 day"
    - **Progress:** "Progress to {nextName}" and "{totalPoints} of {nextThreshold} pts", over a progress bar at `totalPoints / nextThreshold`.
    - **Tip:** "{nextThreshold − totalPoints} points to go. One approved new library is worth 50."
    - **Top tier:** no bar; "You’ve reached the top tier. Thank you."
    - **Signed out:** the same card shell, with "Sign in to see your rank, tier and progress." and a Sign in pill linking to `/auth/signin?returnTo=…`. Check the existing sign-in links for the parameter name.
  - **`TopThisMonthCard.tsx`:**
    - "Top this month" with a "Leaderboard" link
    - the top 3: rank, an initials avatar tinted by index, the name (a link to `/profile/{username}` when there is one), "{periodPoints} pts"
    - an empty rank 2 or 3 shows a dashed circle and "Open spot"
    - with no entries at all, three open spots
  - **`useSuggestions.ts`** (client hook):
    - `useSuggestions(initial: PublicSuggestion[])` returns `{ items, setItems, vote(s), busyId, error, signedIn }`
    - after the session resolves and the viewer is signed in, it refetches `/api/option-suggestions` to pick up `voted`
    - votes go to `POST /api/option-suggestions/{id}/vote`
    - keep the "votes cast" race guard from the current `SuggestedAdditions.tsx`
  - **`VoteOnAdditionsCard.tsx`** (client):
    - "Vote on additions" with an "All suggestions" link
    - the top 3 votable suggestions by votes
    - each row: a 48×44 vote button (chevron and count; `aria-pressed`; `aria-label` "Vote for {name}, {n} votes" or "Remove your vote for …"), the name, and "{List} · {Status}"
    - signed out, the vote buttons are links to sign in with the return path
    - empty: "Nothing to vote on yet. Suggest an option the lists are missing.", linking to `/community/suggestions#suggest-option`
- Modify: `apps/ui/src/app/[locale]/community/_components/CommunitySectionHeader.tsx` and `CommunityNavBar.tsx`. Add `counts?: Partial<Record<"noticeboard" | "suggestions", number>>`, passed to `SectionTab.count` and shown only when greater than 0.
- Modify: `apps/ui/src/components/ds/SectionTabs.tsx`. Render the count as a small pill: `T.bg.muted` background, 13px, weight 700, `px-2`, rounded-full. This changes every section's counts slightly, which is intended.
- Create: `apps/ui/src/lib/community/drive-gaps-server.ts`. `fetchDriveGaps(locale)` returns up to 4 `{ key, title, count, place: { level, slug, name }, href }`. It runs Meilisearch queries on the `library` index, filtered by `searchLocaleFilter(locale)` and cached for 10 minutes like `find-search.ts`'s `cached`:
  - for each need `hours`, `photo` and `accessibility`, facet `region_slug` on `needs = "{key}"` and take the region with the highest count
  - "Not checked in over two years": `last_verified_ts < {cutoff}`, where the cutoff unit matches `library-search-fields.ts`
  - name the place from one hit's `region_name` and `country_name`
  - `href` is the Find libraries URL with `?needs={key}&region={slug}` (see `components/index-page/find-helpers.ts`); the stale row links to `?region={slug}` sorted by gaps
  - drop rows with a count of 0
  - titles: "Opening hours missing", "No photo yet", "Accessibility not recorded", "Not checked in over two years"
- Modify: `apps/ui/src/app/[locale]/community/page.tsx`, rebuilt to the mockup's empty-drives state (`noticeboard.png` shows the populated state; the HTML's `noDrives` branch is the layout to build):
  - **Hero:** `CommunitySectionHeader` with title "The _noticeboard._", lead "Community drives to fill gaps in the index. Pick one, work through small tasks, and see the whole effort move forward.", and `counts={{ suggestions: votableCount }}`. No hero button until D2.
  - **Main column, first card:** an icon, "No drives are open yet" and the copy "A drive is a short, shared push to fill one kind of gap, like opening hours for a county’s libraries. Until one opens, you can improve any record, or work on the gaps below." It has an "Improve a record" pill (`/contribute/index`). On the right sits an `ol` "How a drive works" with 3 steps:
    1. "Someone proposes a gap": "A place plus one missing detail, with a public source."
    2. "A moderator pins it": "With a goal and an end date."
    3. "Everyone chips in": "Small tasks, each checked by a reviewer."
  - **Main column, second section:** "Gaps worth a drive", lead "Found automatically in the index." Rows: a tinted icon tile, the title, "**{count}** records in {Region, Country}", and a "Find these records" secondary pill (44px) linking to `href`. Hidden when there are no gaps.
  - **Rail** (sticky on wide screens, `aside` with `aria-label="Sidebar"`): `StandingCard`, `TopThisMonthCard` and `VoteOnAdditionsCard`.
  - **Data:** `getSessionSSR`, `fetchStanding(user.id, "month")`, `fetchOwnProfile` (for initials), `fetchLeaderboard("month", 3)`, `fetchPublicSuggestions()` and `fetchDriveGaps(locale)`, all in one `Promise.all`.
  - **Layout:** a two-column flex-wrap. Main is `flex: 2 1 440px` and the rail `flex: 1 1 290px`, max-width 1360, as in the mockup.
- Modify: `apps/ui/src/app/[locale]/contribute/page.tsx`. Replace `SuggestedAdditions` with `VoteOnAdditionsCard`, with initial data from `fetchPublicSuggestions()`. If the page is a client component, fetch in its server parent or pass `initial={[]}`; the hook refetches anyway.
- Delete: `apps/ui/src/components/community/SuggestedAdditions.tsx` and its test once nothing imports them. Move any pure helper still worth testing into `lib/community/suggestions.ts` with its test.
- Test: `apps/ui/src/components/community/__tests__/StandingCard.test.tsx` (or `.ts` with a render helper, matching the repo's existing component tests). Cover the progress text and maths, "Not ranked yet" and the top tier.

- [ ] **Step 1:** Write the failing component test.
- [ ] **Step 2:** Run it and watch it fail.
- [ ] **Step 3:** Implement the components and the page.
- [ ] **Step 4:** Run the tests, the typecheck and `cd apps/ui && pnpm lint --max-warnings=-1` (or the repo's script) on the changed files.
- [ ] **Step 5:** Check `http://localhost:3000/community` against `.scratch/community-ui/Community.dc.html` (`noDrives` branch) at desktop and at 390px wide. Use the Playwright MCP or `npx playwright screenshot` if available, and save screenshots to `.scratch/community-ui/out/`.
- [ ] **Step 6: Commit:** `feat(ui): rebuild the Noticeboard with standing, top contributors and gaps`

### Task 5: Leaderboard page (UI)

**Files:**

- Modify: `apps/ui/src/app/[locale]/community/leaderboard/page.tsx`
- Modify: `leaderboard/_components/LeaderboardPodium.tsx`, `LeaderboardRows.tsx` and their test
- Delete: `leaderboard/_components/LeaderboardSidebar.tsx`. Replace it with `StandingCard` plus a new `components/community/PointsTableCard.tsx`:
  - "How points work" in serif 24
  - a `dl` of `POINTS_TABLE`, with values in bold indigo
  - the footnote "Rejected or reverted changes earn nothing. Staff verification doesn’t depend on points."

**Page:**

- **Hero:** title "The community, _in numbers._", lead "The people keeping the atlas accurate and growing. Points are earned only for approved contributions.", tab counts as in Task 4.
- **Heading row:** h2 "Top contributors" in serif with the period control. The control is `nav aria-label="Leaderboard period"`: pill links in a white rounded-full track; the active one has a `T.ink.base` background, white text and `aria-current="page"`. The links are `?period=` URLs, with `scroll={false}` where `Link` is used.
- **Podium** (`ol aria-label="Top three"`):
  - on `sm` and up, order 2, 1, 3, aligned to the bottom; rank 1 is taller (290px vs 250px) with a 2px indigo border and a solid indigo "Rank 1" chip; ranks 2 and 3 have chip-coloured chips
  - each card: an initials avatar (72px for rank 1, 60px otherwise; tint by rank), the name in serif 24 (a link when there's a username), the tier, "**{periodPoints}** pts" (serif 32), then "{approvedCount} approved" and "{acceptanceRate}% accepted" (that line is omitted when the rate is null)
  - an empty rank shows a dashed card: a "+" circle, "Open spot" and "One approved change {PERIOD_PHRASE[period]} puts you here."
  - on mobile, the cards stack in rank order
- **Table** (rank 4 and below; hidden when there are none):
  - a white card with an `aria-hidden` header row (#, Contributor, Points) on `T.bg.surface`
  - each row: rank; a 36px initials avatar; the name (link) with a "You" chip when `rank === standing?.periodRank`; "{tier} · {entryPlace}" (just the tier when there's no place); the points in serif 24, right-aligned, with "{approvedCount} approved · {acceptanceRate}%" underneath (rate omitted when null)
  - the viewer's row has the `#F6F5FD` background
- **Unranked viewer:** when signed in and `periodRank` is null, show a dashed card: avatar, "**You’re not ranked yet.** Rankings start with your first approved change." and a "Make a change" pill (`/contribute/index`). When `periodRank` is greater than the rows shown, say "You’re #{periodRank} {PERIOD_PHRASE}." instead.
- **Footnote:** "Points only come from approved changes. Acceptance rate is shown so careful work counts as much as volume."
- **Rail:** `StandingCard` (with `fetchStanding(user.id, period)`) and `PointsTableCard`.
- **Data:** `fetchLeaderboard(period)`, standing, own profile (initials), and `fetchPublicSuggestions()` for the tab count.
- **Tests:** update `LeaderboardRows.test.ts` for the new row text, "You" and the rate omission. Add a podium test for open spots.
- **Check:** compare with `.scratch/community-ui/leaderboard.png` at desktop and at 390px.
- **Commit:** `feat(ui): rebuild the Leaderboard with podium, acceptance and period ranks`

### Task 6: Suggestions page (UI)

**Files:**

- Modify: `apps/ui/src/app/[locale]/community/suggestions/page.tsx` (server). It fetches `fetchPublicSuggestions()`, `fetchOptionNames()` and the session (signed in or not).
- Create in `apps/ui/src/components/community/`:
  - **`SuggestionsBoard.tsx`** (client; uses `useSuggestions`; owns the filter, sort and list). It also takes `optionNames` and exposes `onPosted` for the form, or the form lives inside it; see Layout.
  - **`SuggestionCard.tsx`:**
    - a 64px vote box (chevron, count in 18 bold, then "vote" or "votes")
      - locked for declined: muted background, `disabled`, `cursor: not-allowed`
      - voted: a 2px indigo border on a chip background
    - the name in serif 24, with a status chip (`STATUS_META`, icon + text)
    - the description; or "Asked for in corrections to {n} libraries." when there's no description and `libraryCount` is greater than 0; or nothing
    - a "**Board note:** {decisionNote}" box (`T.bg.surface`, divider border, radius 12) when there's a note
    - meta: "{LIST_LABELS[list]} · Suggested by {suggestedByName} · {relativeAge}". Drop the "Suggested by" part when the name is null.
  - **`SuggestOptionForm.tsx`** (client; `id="suggest-option"`; a `form` with `noValidate`):
    - fields:
      - "Which list?": a select of the four lists in `LIST_ORDER`, labelled with `LIST_LABELS`
      - "Option name" with a "Required" hint: an input with `placeholder="e.g. Tool lending"` and `maxLength` 80
      - "Why it matters" with an "Optional" hint: a textarea with 3 rows, `maxLength` 400 and `placeholder="Who would use it, and how would they look for it?"`
      - a full-width "Post suggestion" pill, 52px
    - client checks before posting (`aria-invalid`, a danger-coloured message under the field):
      - an empty name: "Give the option a short name."
      - a name already in `optionNames[list]` or among the suggestions, case-insensitively: "That option already exists or has been suggested."
    - posting:
      - POST `/api/option-suggestions`
      - on 201: prepend the returned suggestion (voted), reset the fields, set the board filter to All, and show `role="status"` "Posted, with your vote." with a check icon
      - on 409, 400 or 429: show the server's `error.message` (or `error`) under the name field
    - signed out: the same card with "Sign in to suggest an option." and a Sign in pill (`returnTo=/community/suggestions#suggest-option`)
  - **`AlreadyInLists.tsx`:**
    - "Already in the lists" (17 bold) and "Check these first so we don’t get duplicates."
    - chips with a green check and the name, for the current filter's lists (All = every list)
    - the first 24, then a "Show all {n}" button that expands
- **Layout:**
  - **Hero:** title "What should the lists _include?_", lead "Name a feature or service the lists don’t have yet. Vote for the ones you’d use; the editorial board decides monthly.", and a hero slot pill "Suggest an option" (secondary white pill with a "+" icon) linking to `#suggest-option`.
  - **Main column:**
    - a filter row: `role="group" aria-label="Filter by list"` with pills All, Accessibility, Services, Facilities and Library types; the active pill uses the chip background, an indigo border and `aria-pressed`
    - a "Sort" label with a select: Most votes (`top`) or Newest (`new`)
    - the `ul` of `SuggestionCard`s
    - empty: a card with a thumbs-up icon, "Nothing to vote on yet" (or "No {label} suggestions yet" under a filter), and "Is there a feature or service you’ve looked for and couldn’t tick? Suggest it with the form. Once others vote, it shows here."
    - `AlreadyInLists` underneath
  - **Rail:**
    - `SuggestOptionForm`
    - "What happens next" (`T.bg.surface` card): 3 numbered steps, "Others vote for options they’d use.", "The editorial board reviews the top options each month." and "Accepted options appear in every library’s checklist.", then "Next board review: {formatBoardReview(nextBoardReview(new Date()))}"
    - "Recently added to the lists": the 5 most recently accepted suggestions by `decidedAt`, each with a green check, the name and "{List} · {Mon}" (en-GB short month); hidden when there are none
  - The list shows every status except accepted: accepted suggestions appear only under "Recently added".
- **State:** `SuggestionsBoard` holds the list state, so the form and the board share it. Render both inside one client wrapper, `SuggestionsWorkspace`, which lays out the main column and the rail. The rail's static cards are passed in as server-rendered children.
- **Tests:** `components/community/__tests__/SuggestOptionForm.test.tsx` (empty name, duplicate name, 409 message, success message) and a filter and sort test for the board, using the repo's component test setup.
- **Check:** compare with `.scratch/community-ui/suggestions.png` at desktop and at 390px.
- **Commit:** `feat(ui): rebuild Suggestions with direct posting, statuses and filters`

### Task 7: Board suggestions page, E2E and wrap-up

**Files:**

- Modify: `apps/ui/src/components/moderation/OptionSuggestionsBoard.tsx`:
  - **List:** all undecided suggestions (open, reviewing, planned) with a status badge, the description, "Suggested by …" when known, the libraries that asked (as now) and the vote and request counts.
  - **Filter:** a status filter (All undecided, New, Under review, Planned).
  - **Actions per status:**
    - "Mark under review" (open only)
    - "Mark planned" (open or reviewing; optional note)
    - "Accept", with the tidy-name field as now. For `library_types`, a hint: "Library types are a fixed list. Accept once the type is in the schema; until then, mark it planned."
    - "Decline": the note is required, with the hint "Shown publicly with the suggestion."
    - "Remove": for spam; a confirm step; the suggestion is hidden from everyone
  - **Results:** errors show the server's message; success messages are live.
- Modify: `apps/ui/src/lib/moderation-proxy.ts`, only if its body allowlist for this route needs to admit the new decision values. It allowlists keys, so probably no change.
- Modify: `apps/ui/src/app/[locale]/contribute/moderation/suggestions/page.tsx`. New lead: "Options contributors asked for, most wanted first. Review, plan, accept or decline them; notes on declined and planned options are shown publicly."
- Modify: `qa/tests/playwright/e2e/community.spec.ts`:
  - the Leaderboard tab shows the `navigation` "Leaderboard period" and the heading "Top contributors"
  - Suggestions shows the heading "Suggest an option" (the form, or its signed-out card) and a `group` "Filter by list"
  - the Noticeboard shows "How a drive works"
  - keep the existing tests
- Modify: `docs/superpowers/plans/2026-10-05-drives-d1.md`. Add one line under Global Constraints: "Drive cards on the Noticeboard follow `.scratch/community-ui/Community.dc.html` (pinned drive card and 'Other open drives' grid) and `noticeboard.png`; replace the 'No drives are open yet' card when drives exist."
- Modify: `docs/superpowers/specs/2026-10-05-noticeboard-and-drives-design.md` §5. Add one line: the Noticeboard's hero "Propose a drive" pill and the "Propose as a drive" action on each "Gaps worth a drive" row arrive with D2.

- [ ] Run the unit tests: `cd apps/ui && pnpm vitest run src/components/moderation src/lib/community`.
- [ ] Run Playwright: `cd qa/tests/playwright && npx playwright test e2e/community.spec.ts --project=chromium` (or the configured desktop project), with the local UI and Strapi running.
- [ ] Commit: `feat(ui): board actions for option suggestion statuses` and `test(e2e): community pages after the rework` (separate commits).
