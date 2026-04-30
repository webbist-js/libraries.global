# Community & Rewards System — Design Spec

**Date:** 2026-04-30
**Scope:** `rewards` Strapi v5 plugin, community leaderboard page, hub section, points system, profile integration, documentation updates.

---

## Overview

A full-stack community recognition system. Contributors earn points for approved contributions; points accumulate toward named tiers. A public leaderboard surfaces top contributors by period and region. The system is owned by a self-contained Strapi v5 plugin (`rewards`) that mirrors the `content-moderation` plugin's structure — content types, services, routes, and an admin panel — giving editorial staff full audit visibility and manual reward management.

---

## Architecture: Why a Plugin

Three options were evaluated:

| Dimension                                  |     Fields on profile     |     Fields + JSON log     |                     **Rewards plugin**                      |
| ------------------------------------------ | :-----------------------: | :-----------------------: | :---------------------------------------------------------: |
| Time-window leaderboard filters            |        Approximate        |   Slow (app-layer scan)   |                 **Fast (SQL aggregation)**                  |
| Full audit trail                           |            No             |     90-day JSON blob      |                  **Permanent, queryable**                   |
| Admin UI (history, manual awards, reports) |            No             |            No             |                           **Yes**                           |
| Callable from other plugins                |       Manual wiring       |       Manual wiring       | **`strapi.plugin('rewards').service('points').award(...)`** |
| Future: badges, seasons, challenges        | Schema migration required | Schema migration required |                     **Self-contained**                      |

The plugin approach wins on every dimension. The `content-moderation` plugin provides a complete, proven blueprint — content types, service methods, controller pattern, admin panel tabs — so incremental implementation effort is low.

---

## Plugin: `rewards`

**Location:** `apps/strapi/src/plugins/rewards/`

### File structure

```
rewards/
  package.json
  strapi-server.ts
  strapi-admin.tsx
  server/
    content-types/
      index.ts
      point-event/schema.json
      badge-award/schema.json
    services/
      index.ts
      points.ts
      leaderboard.ts
      badges.ts
    controllers/
      index.ts
      rewards.ts
    routes/
      index.ts
      content-api.ts
      admin.ts
  admin/
    src/
      index.ts
      pages/
        RewardsDashboard.tsx
```

---

## Content Types

### `point-event` (collection: `rw_point_events`)

| Field       | Type     | Notes                                                       |
| ----------- | -------- | ----------------------------------------------------------- |
| `baUserId`  | string   | required, indexed                                           |
| `action`    | enum     | see Point Actions below                                     |
| `points`    | integer  | required, signed (negative for deductions)                  |
| `metadata`  | json     | submission ID, library name, moderator ID for manual awards |
| `awardedAt` | datetime | required, indexed                                           |

Hidden from content-type-builder. Visible in content-manager for admin browsing.

### `badge-award` (collection: `rw_badge_awards`)

| Field       | Type     | Notes                           |
| ----------- | -------- | ------------------------------- |
| `baUserId`  | string   | required, indexed               |
| `badgeId`   | string   | e.g. `verifier`, `globetrotter` |
| `awardedAt` | datetime | required                        |

Badge definitions (thresholds, display names, descriptions) live in code in `badges.ts` — no separate content type for the catalogue.

---

## Point Actions

| Action enum value      | Event                                                | Points            |
| ---------------------- | ---------------------------------------------------- | ----------------- |
| `new_library_approved` | New library submission approved                      | +50               |
| `edit_accepted_minor`  | Edit approved, 1–3 fields changed                    | +5                |
| `edit_accepted_major`  | Edit approved, 4+ fields changed                     | +15               |
| `photo_licensed_cc`    | CC-licensed photo accepted and attached to a record  | +8                |
| `hours_verified`       | Opening hours verified on-site                       | +5                |
| `status_verified`      | Operational status verified                          | +5                |
| `wiki_translated`      | Wiki page translation approved                       | +15               |
| `daily_streak`         | Any contribution on a consecutive day                | +1                |
| `manual_award`         | Admin manual award (requires reason in metadata)     | custom            |
| `manual_deduct`        | Admin manual deduction (requires reason in metadata) | custom (negative) |

---

## Tier System

| Level | Name         | All-time points |
| ----- | ------------ | --------------- |
| I     | Reader       | 0–99            |
| II    | Indexer      | 100–499         |
| III   | Cartographer | 500–1,499       |
| IV    | Archivist    | 1,500–3,999     |
| V     | Scholar      | 4,000–8,999     |
| VI    | Curator      | 9,000+          |

Tiers are computed from all-time points. The tier name is cached on `user-profile.tier` for leaderboard display without re-computation on every query.

---

## Badge Catalogue

| Badge ID       | Name         | Threshold                                           |
| -------------- | ------------ | --------------------------------------------------- |
| `verifier`     | Verifier     | 10 verified statuses (hours or operational)         |
| `globetrotter` | Globetrotter | Contributions to libraries in 5+ distinct countries |
| `indexer`      | Indexer      | 10 new libraries approved                           |
| `photographer` | Photographer | 5 CC-licensed photos accepted                       |
| `translator`   | Translator   | 3 wiki pages translated                             |
| `archivist`    | Archivist    | 50 edits approved                                   |
| `streaker`     | Dedicated    | 30-day consecutive activity streak                  |

Badges are checked and awarded inside `badges.service.ts` after every `points.award()` call. Badge progress (e.g. `3 / 5 to go`) is computed on-demand in the leaderboard standing response — not stored, to avoid stale counts.

---

## Services

### `points.ts`

```ts
award(baUserId: string, action: PointAction, pts: number, metadata?: Record<string, unknown>): Promise<void>
```

Creates a `point-event` record, then updates cached fields on the matching `user-profile`:

- Increments `points` (all-time total)
- Increments `pointsThisMonth` if `lastActivityDate` is in the current calendar month; resets to `pts` if it is a new month
- Updates `streak` via `updateStreak()`
- Updates `tier` via `computeTier()`
- Updates `lastActivityDate` to today

```ts
computeTier(total: number): TierInfo
// Returns { level, name, nextName, nextThreshold, progressPercent }

updateStreak(baUserId: string): Promise<number>
// Reads lastActivityDate. If yesterday → streak + 1. If today → no change. Otherwise reset to 1.

getForPeriod(baUserId: string, period: Period): Promise<number>
// SUM(points) WHERE baUserId = ? AND awardedAt >= periodStart(period)
```

### `leaderboard.ts`

```ts
getLeaderboard(opts: { period: Period; region?: string; page: number; limit: number }): Promise<LeaderboardEntry[]>
```

Runs SQL aggregation: `SUM(points) WHERE awardedAt >= periodStart GROUP BY baUserId ORDER BY SUM DESC`. Joins user-profile rows for `username`, `firstName`, `lastName`, `avatarUrl`, `country`, `contributorRole`. Computes rank change by comparing with the previous equivalent period (e.g. last month vs this month).

```ts
getStanding(baUserId: string): Promise<Standing>
// Returns: globalRank, countryRank, tier, streak, totalPoints, pointsThisMonth,
//          pointsToNextTier, recentBadges, suggestedAction (text hint)
```

### `badges.ts`

```ts
checkAndAward(baUserId: string): Promise<void>
// Queries aggregated counts per action for user, compares against BADGE_DEFINITIONS thresholds,
// checks existing badge-award records, creates new ones for newly crossed thresholds.
```

Called from `points.award()` after every event. Idempotent — no duplicate badges.

---

## Controllers & Routes

### Content API (all `auth: false`, session validated internally)

| Method | Path                        | Handler               | Notes                                         |
| ------ | --------------------------- | --------------------- | --------------------------------------------- |
| GET    | `/api/rewards/leaderboard`  | `rewards.leaderboard` | `?period=month&region=global&page=1&limit=20` |
| GET    | `/api/rewards/my-standing`  | `rewards.myStanding`  | Returns 401 if no session                     |
| GET    | `/api/rewards/my-history`   | `rewards.myHistory`   | Returns 401 if no session; `?page=1`          |
| GET    | `/api/rewards/how-it-works` | `rewards.howItWorks`  | Static tier + point-value config              |

### Admin Routes (protected by `admin::isAuthenticatedAdmin`)

| Method | Path              | Handler                                                  |
| ------ | ----------------- | -------------------------------------------------------- |
| GET    | `/rewards/events` | `rewards.adminEvents` — filterable by user, action, date |
| POST   | `/rewards/award`  | `rewards.adminAward` — manual award/deduct               |
| GET    | `/rewards/stats`  | `rewards.adminStats` — aggregate totals for dashboard    |

---

## Admin Panel

Plugin registers under "Rewards" in the Strapi admin sidebar.

**Tab 1 — Overview**
Total contributors, total points awarded this month, top-10 leaderboard.

**Tab 2 — Event Log**
Searchable/filterable table: user ID, action, points, metadata preview, date. Supports filter by action type and date range.

**Tab 3 — Manual Award**
Form: user identifier (baUserId or username), action = `manual_award` or `manual_deduct`, points value, required reason (written into metadata). Confirms before submitting.

**Tab 4 — Reports**
Points awarded by action type (bar chart), active contributors per period (line), top regions.

Admin permissions registered in `bootstrap()`:

- `rewards:read` — "View rewards data"
- `rewards:award` — "Manually award or deduct points"

---

## user-profile Schema Changes

Five new fields added to `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`:

| Field              | Type    | Default    | Notes                                        |
| ------------------ | ------- | ---------- | -------------------------------------------- |
| `points`           | integer | 0          | All-time total; indexed for leaderboard sort |
| `pointsThisMonth`  | integer | 0          | Resets at month boundary on next award       |
| `tier`             | string  | `"Reader"` | Cached tier name                             |
| `streak`           | integer | 0          | Consecutive active days                      |
| `lastActivityDate` | string  | null       | YYYY-MM-DD                                   |

These fields are **excluded from the `upsertProfile` allowlist** — they are written only by the rewards plugin service. Documented in the security section of `docs/strapi-role-permissions.md`.

---

## Integration with content-moderation

In `submission.ts` `updateStatus()`, inside each approval branch, call:

```ts
// Wrapped in try/catch — a rewards failure must never block approval
try {
  await strapi
    .plugin("rewards")
    .service("points")
    .award(submission.submittedByUserId, "new_library_approved", 50, {
      submissionId: documentId,
      libraryName: String(f.name ?? ""),
    })
} catch (err) {
  strapi.log.warn("[content-moderation] rewards.award failed:", err)
}
```

Action mapping:
| Approval type | Action | Points |
|---|---|---|
| `new_library` | `new_library_approved` | 50 |
| `library_edit` (1–3 fields in diff) | `edit_accepted_minor` | 5 |
| `library_edit` (4+ fields) | `edit_accepted_major` | 15 |
| `wiki_edit` | `wiki_translated` (if translated) or `edit_accepted_minor` | 15 / 5 |

Edit scope (minor vs major) is determined by counting non-empty keys in `submission.fields`.

---

## Frontend

### New Next.js API Routes

**`GET /api/leaderboard`**
Proxies to `${STRAPI}/api/rewards/leaderboard` forwarding all query params. Uses `next: { revalidate: 3600 }` (1-hour ISR).

**`GET /api/leaderboard/standing`**
Proxies to `${STRAPI}/api/rewards/my-standing`, forwarding the session cookie. Uses `cache: 'no-store'`.

### New Pages & Components

**`apps/ui/src/app/[locale]/contribute/community/page.tsx`**
Full community page. Layout:

1. Breadcrumb: `CONTRIBUTE / COMMUNITY`
2. Hero: "The community, in numbers." + subtitle
3. Period filter tabs: Today · This Week · This Month · All Time
4. Region pills: Global · Europe · Americas · Africa · Asia · Oceania + overflow button for country-level filters
5. Podium: top-3 in large equal-height cards with rank number, avatar initials, name, role badge, country, all-time/period points, contribution summary
6. Ranked list (rows 4–N): rank, rank-change arrow, avatar initials, name, role · country badge, stats line (+NNN pts · 30 days · X CONTRIBUTION TYPE), period points right-aligned
7. "Load more" below list
8. Right sidebar (sticky):
   - "Your standing" card (or sign-in prompt)
   - "How points work" table
   - "This month's badges" grid

**`apps/ui/src/app/[locale]/contribute/_components/ContributeCommunitySection.tsx`**
Compact hub section. Layout:

- Left: section heading "The community." + subtitle + "N,NNN ACTIVE · TOP 5 THIS MONTH" stat
- Below left: leaderboard table (top 5 rows)
- Right: "Where you stand" card
- Footer bar: "SHOWING TOP 5 · GLOBAL · MONTH · SEE FULL LEADERBOARD →"

Added to `ContributePage` after `ContributeGuidelinesSection`.

### Contribute Navigation

Add persistent bottom tab-bar to a new `apps/ui/src/app/[locale]/contribute/layout.tsx`:

```
HUB · COMMUNITY · ADD LIBRARY · EDIT (DIFF) · WIKI EDITOR · MY SUBMISSIONS
```

Active tab highlighted with aurora underline (matching the `SubmissionsShell` tab pattern).

### Profile Page Update

Add to the profile Overview tab:

- Tier badge chip (tier name + level number, coloured by tier)
- All-time points value (serif large numeral)
- Current streak (mono label + value)

---

## Documentation Updates

### New file: `docs/community-and-points-system.md`

Covers:

- Point values per action and how each is triggered
- Tier thresholds and names
- Streak mechanics (how consecutive days are calculated, what resets it)
- Badge catalogue with thresholds
- How to manually award/revoke points via the admin panel
- How the plugin integrates with the content-moderation approval flow
- Security: which profile fields are plugin-only and why

### Updated file: `docs/strapi-role-permissions.md`

- Add rewards plugin routes to the `auth: false` table
- Add `points`, `pointsThisMonth`, `tier`, `streak`, `lastActivityDate` to the upsertProfile security section exclusion list
- Add `rewards:read` and `rewards:award` admin permissions to the Admin Panel RBAC section

---

## Out of Scope (this spec)

- Season resets (quarterly/annual leaderboard resets — future feature)
- Email notifications when tier is reached
- Public profile leaderboard rank badge (future profile enhancement)
- Points for following libraries or completing onboarding
- Webhook events for external integrations
