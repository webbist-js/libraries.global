# Contribution Hub Widgets Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Welcome Back widget and a Quick Wins carousel to the authenticated contribution hub page, powered by pre-computed personalised task suggestions stored as a Strapi repeatable component on the user profile.

**Architecture:** A Strapi cron job runs every 4 hours and computes up to 20 personalised quick wins per active user, writing them as a repeatable component on `user-profile`. A new Next.js API route reads these wins and the user's rewards standing (including a new country-scoped rank). Two new UI sections — `WelcomeBackWidget` and `QuickWinsSection` — are inserted below the existing hero on the contribute page for authenticated users only. DS primitives (`Card`, `Badge`, `SectionHeader`, `Eyebrow`) are reused throughout.

**Tech Stack:** Strapi v5 (Document Service, cron, db.query), Next.js 15 App Router (RSC + one client component for the carousel), Tailwind CSS v4, design-tokens (`T`), Iconify icons.

---

## 1. Data Model

### 1.1 New Strapi component: `contribute.quick-win`

**File:** `apps/strapi/src/components/contribute/quick-win.json`

```json
{
  "collectionName": "components_contribute_quick_wins",
  "info": {
    "displayName": "Quick Win",
    "icon": "star"
  },
  "options": {},
  "attributes": {
    "winId": { "type": "string", "required": true },
    "type": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "add_library",
        "add_nearby_library",
        "verify_hours",
        "add_hero_image",
        "translate_wiki"
      ]
    },
    "title": { "type": "string", "required": true },
    "description": { "type": "text", "required": true },
    "points": { "type": "integer", "required": true },
    "estimatedMinutes": { "type": "integer", "required": true },
    "rewardLabel": { "type": "string", "required": true },
    "actionUrl": { "type": "string", "required": true },
    "targetEntityRef": { "type": "string" },
    "targetSlug": { "type": "string" },
    "computedForCountry": { "type": "string" },
    "computedForLanguage": { "type": "string" }
  }
}
```

### 1.2 `user-profile` schema additions

Add to `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`:

```json
"quickWins": {
  "type": "component",
  "component": "contribute.quick-win",
  "repeatable": true
},
"quickWinsComputedAt": {
  "type": "datetime"
}
```

---

## 2. Backend: Quick Wins Service & Cron Job

### 2.1 New service: `api::user-profile.quick-wins`

**File:** `apps/strapi/src/api/user-profile/services/quick-wins.ts`

Exports a single `computeForUser(baUserId: string): Promise<QuickWin[]>` function. Runs 5 rule queries in parallel, deduplicates by `winId`, scores and sorts, returns up to 20 wins.

**Rule implementations:**

| Rule                 | Query                                                                                                                                          | Win fields                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `add_library`        | Find countries where published library count < 5; prioritise if `profile.country` matches                                                      | points: 50, estimatedMinutes: 10, rewardLabel: "CARTOGRAPHER", actionUrl: `/contribute/add`                |
| `add_nearby_library` | Find published libraries with no branch relation, in `profile.country`; pick up to 3 nearest to `profile.city` by comparing `location.lat/lng` | points: 12, estimatedMinutes: 2, rewardLabel: "PIN", actionUrl: `/contribute/add`                          |
| `verify_hours`       | Find published libraries where `lastVerifiedAt < now - 180 days`; filter to `profile.country` first, fallback to global                        | points: 5, estimatedMinutes: 1, rewardLabel: "VERIFIER", actionUrl: `/contribute/edit/{slug}`              |
| `add_hero_image`     | Find published libraries where `heroImage IS NULL`; filter to `profile.country`                                                                | points: 8, estimatedMinutes: 3, rewardLabel: "PHOTOGRAPHER", actionUrl: `/contribute/edit/{slug}`          |
| `translate_wiki`     | For each `profile.languages[].code`, find wiki articles missing that locale                                                                    | points: 15, estimatedMinutes: 5, rewardLabel: "TRANSLATOR", actionUrl: `/contribute/wiki/{section}/{slug}` |

**Scoring / sort order:**

1. Profile country match → boosted to front
2. Higher points value
3. Shorter estimated time (ties broken by lower estimatedMinutes)

**`winId` generation:** stable string from `{type}-{targetEntityRef or targetSlug or countryCode}` so re-runs don't duplicate cards the user has already seen.

**Write back via Document Service:**

```ts
await strapi.documents("api::user-profile.user-profile").update({
  documentId: profile.documentId,
  data: {
    quickWins: wins,
    quickWinsComputedAt: new Date(),
  },
})
```

### 2.2 Cron job

**File:** `apps/strapi/src/index.ts` — add to `bootstrap()`:

```ts
strapi.cron.add("quickWinsRefresh", {
  task: async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const profiles = await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({
        where: {
          lastActivityDate: { $gte: cutoff.toISOString().slice(0, 10) },
        },
      })
    // Process in batches of 50
    for (let i = 0; i < profiles.length; i += 50) {
      const batch = profiles.slice(i, i + 50)
      await Promise.all(
        batch.map((p: any) =>
          strapi
            .service("api::user-profile.quick-wins")
            .computeAndSave(p.baUserId)
        )
      )
    }
  },
  options: { rule: "0 */4 * * *" },
})
```

`computeAndSave(baUserId)` calls `computeForUser` then writes the Document Service update.

### 2.3 On-demand invalidation

- In `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`: after a submission is approved, call `strapi.service("api::user-profile.quick-wins").computeAndSave(submittedByUserId)` (non-fatal, wrapped in try/catch).
- In `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` `upsertProfile`: after update, if `country` or `languages` changed, call `computeAndSave(baUserId)` (non-fatal).

### 2.4 Country rank — leaderboard service addition

**File:** `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`

Add method:

```ts
async getCountryRank(baUserId: string, country: string): Promise<number | null> {
  if (!country) return null
  const profile = await strapi.db
    .query("api::user-profile.user-profile")
    .findOne({ where: { baUserId } })
  if (!profile) return null
  const result = await strapi.db.connection
    .count({ count: "*" })
    .from("user_profiles")
    .where("country", country)
    .where("points", ">", profile.points ?? 0)
  return Number(result[0]?.count ?? 0) + 1
}
```

The `getStanding` method is extended to also call `getCountryRank` and include it in the returned `Standing` object:

```ts
// Extended Standing type
countryRank: number | null
country: string | null
```

---

## 3. Next.js API Routes

### 3.1 `GET /api/contribute/standing`

**File:** `apps/ui/src/app/api/contribute/standing/route.ts`

- Auth-gated via session
- Calls Strapi rewards standing endpoint (existing) via `X-Ba-User-Id` header
- Returns: `{ firstName, streak, globalRank, countryRank, country, tier, totalPoints, pointsToNext, nextTierName, pendingSubmissions }`
- `cache: "no-store"` — personal, always fresh
- `pendingSubmissions`: count of user's submissions with status `pending` or `needs_info`, fetched from the existing `/api/content-moderation/submissions/my` endpoint

### 3.2 `GET /api/contribute/quick-wins`

**File:** `apps/ui/src/app/api/contribute/quick-wins/route.ts`

- Auth-gated via session
- Calls Strapi bridge to fetch user profile with `populate: { quickWins: true }`
- If `quickWinsComputedAt` is null or older than 4 hours, fires a background recompute (POST to a bridge endpoint `/api/auth-bridge/compute-quick-wins`) as fire-and-forget — serves existing data immediately
- Returns: `{ data: QuickWin[], computedAt: string | null, total: number }`

### 3.3 New Strapi bridge route: `POST /api/auth-bridge/compute-quick-wins`

**File:** `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts` — add route
**Controller:** `auth-bridge.ts` — add `computeQuickWins` handler

Accepts `{ baUserId }`, calls `strapi.service("api::user-profile.quick-wins").computeAndSave(baUserId)`, returns `{ ok: true }`. Protected by `X-Service-Secret`.

---

## 4. TypeScript Types

**File:** `apps/ui/src/lib/types/profile.ts` — add:

```ts
export type QuickWinType =
  | "add_library"
  | "add_nearby_library"
  | "verify_hours"
  | "add_hero_image"
  | "translate_wiki"

export type QuickWin = {
  winId: string
  type: QuickWinType
  title: string
  description: string
  points: number
  estimatedMinutes: number
  rewardLabel: string
  actionUrl: string
  targetEntityRef?: string
  targetSlug?: string
  computedForCountry?: string
  computedForLanguage?: string
}

export type ContributingStanding = {
  firstName: string
  streak: number
  globalRank: number | null
  countryRank: number | null
  country: string | null
  tier: TierInfo
  totalPoints: number
  pointsToNext: number | null
  nextTierName: string | null
  pendingSubmissions: number
}
```

---

## 5. UI Components

All new components live in `apps/ui/src/app/[locale]/contribute/_components/` unless noted.

### DS primitives reused

| DS Component    | Used in                                               |
| --------------- | ----------------------------------------------------- |
| `Card`          | Outer shell of `WelcomeBackWidget` and `QuickWinCard` |
| `Badge`         | Reward label chip in `QuickWinCard` footer            |
| `SectionHeader` | "Quick _wins_." heading in `QuickWinsSection`         |
| `Eyebrow`       | "CURATED FOR YOU · {page} OF {total}" label           |

### 5.1 `TierProgressRing.tsx`

Pure SVG donut ring, server-renderable.

Props: `{ percent: number, label: string, animate?: boolean }`

- Outer circle: `T.ink.ghost` (track)
- Progress arc: `T.accent.violet`
- Centre text: `label` (e.g. "76%") in `T.font.mono`
- Optional `animate` prop — when true, uses a CSS stroke-dashoffset animation on mount (client-only enhancement, wrapped in `useEffect`)

### 5.2 `WelcomeBackWidget.tsx`

Server component. Props: `{ standing: ContributingStanding }`

Layout: `Card` with `hover={false}`, full width, `padding: "28px 32px"`, flex row space-between.

Left column:

- H2: `"Welcome back, "` + `<em style={{ color: T.accent.aurora, fontFamily: T.font.serif, fontStyle: "italic" }}>{firstName}</em>` + `". You're on a {streak}-day streak and ranked #{globalRank} globally"` + (if `countryRank && country`) `" / #{countryRank} in {country}"`
- Sub-copy: `T.ink.dim` — pending submissions note + `"You're {pointsToNext} pts away from "` + `<strong style={{ color: T.ink.base, fontFamily: T.font.mono }}>{nextTierName} · tier {tier.level + 1}</strong>`

Right column:

- `TierProgressRing` with `percent={tier.progressPercent}` `label="{tier.progressPercent}%"`
- Below ring: `"To next tier"` in `T.ink.dim` mono 11px + `"{totalPoints} / {nextThreshold} pts"` in `T.ink.low` mono 11px

### 5.3 `QuickWinCard.tsx`

Server-renderable (no state). Props: `{ win: QuickWin }`

Uses DS `Card` with `hover={true}` and `as="article"`.

Layout — three rows:

1. **Top row:** category icon (Iconify, 20px, tinted by type — see icon map below) + `"+{points} PTS · ~{estimatedMinutes} MIN"` in `T.font.mono` `T.ink.low` 10px
2. **Body:** `title` in `T.ink.base` 15px serif medium + `description` in `T.ink.dim` 13px, 2-line clamp
3. **Footer:** `"REWARD · "` + DS `Badge` with `label={rewardLabel}` `color="dim"` + `" · {points} PTS"` + CTA link (`T.accent.aurora` mono 11px uppercase) linking to `win.actionUrl`

**Icon map by type:**

- `add_library` / `add_nearby_library` → `mdi:plus-box` tinted `T.accent.ember`
- `verify_hours` → `mdi:text-box-outline` tinted `T.accent.aurora`
- `add_hero_image` → `mdi:image-outline` tinted `T.accent.violet`
- `translate_wiki` → `mdi:text` tinted `T.accent.ok`

**CTA label by type:**

- `add_library` / `add_nearby_library` → `BEGIN →`
- `verify_hours` → `VERIFY →`
- `add_hero_image` → `ATTACH →`
- `translate_wiki` → `OPEN →`

### 5.4 `QuickWinsCarousel.tsx`

Client component (`"use client"`). Props: `{ wins: QuickWin[] }`

State: `page: number` (0-indexed, each page = 4 cards).

- Renders 4 `QuickWinCard` items for `wins.slice(page * 4, page * 4 + 4)`
- Left / right arrow buttons: `T.ink.dim` on `T.bg.deep` circle buttons, disabled at boundaries (`opacity-30`)
- Keyboard: `ArrowLeft` / `ArrowRight` bound on the section container
- Mobile: CSS `scroll-snap-type: x mandatory` on a flex container, arrows hidden below `md` breakpoint

### 5.5 `QuickWinsSection.tsx`

Server component. Props: `{ wins: QuickWin[] }`

Layout:

- Header row: DS `SectionHeader` with `"Quick "` + `<em style={{ fontFamily: T.font.serif, fontStyle: "italic", color: T.accent.aurora }}>wins</em>` + `"."` on the left. The "CURATED FOR YOU · X OF Y" counter lives inside `QuickWinsCarousel` (client component) so it reflects the current page — `QuickWinsSection` does not render it.
- Below: `QuickWinsCarousel wins={wins}`

### 5.6 Integration in `contribute/page.tsx`

Two new server-side fetches run in `Promise.all` alongside the existing fetches:

```ts
async function fetchStanding(
  baUserId: string
): Promise<ContributingStanding | null>
async function fetchQuickWins(baUserId: string): Promise<QuickWin[]>
```

Both call the Strapi bridge directly (not the Next.js API routes) to avoid internal HTTP round-trips in the RSC context. They use `STRAPI_BRIDGE_SECRET` and `STRAPI_URL` env vars, following the same pattern as `fetchMySubmissionStats` already in `contribute/page.tsx`. The Next.js API routes (`/api/contribute/standing` and `/api/contribute/quick-wins`) exist for client-side use only (e.g. future refresh on focus).

Rendered between `ContributeHeroSection` and `ContributeNavBar`, only when `session?.user`:

```tsx
{
  session?.user && standing && <WelcomeBackWidget standing={standing} />
}
{
  session?.user && quickWins.length > 0 && <QuickWinsSection wins={quickWins} />
}
```

---

## 6. File Map

### New files

| Path                                                                    | Purpose                            |
| ----------------------------------------------------------------------- | ---------------------------------- |
| `apps/strapi/src/components/contribute/quick-win.json`                  | Strapi repeatable component schema |
| `apps/strapi/src/api/user-profile/services/quick-wins.ts`               | Rules engine + `computeAndSave`    |
| `apps/ui/src/app/api/contribute/standing/route.ts`                      | Standing API route                 |
| `apps/ui/src/app/api/contribute/quick-wins/route.ts`                    | Quick wins API route               |
| `apps/ui/src/app/[locale]/contribute/_components/WelcomeBackWidget.tsx` | Welcome back banner                |
| `apps/ui/src/app/[locale]/contribute/_components/TierProgressRing.tsx`  | SVG donut ring                     |
| `apps/ui/src/app/[locale]/contribute/_components/QuickWinsSection.tsx`  | Section wrapper                    |
| `apps/ui/src/app/[locale]/contribute/_components/QuickWinsCarousel.tsx` | Client carousel                    |
| `apps/ui/src/app/[locale]/contribute/_components/QuickWinCard.tsx`      | Individual win card                |

### Modified files

| Path                                                                       | Change                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`  | Add `quickWins` component + `quickWinsComputedAt`                             |
| `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`           | Add `getCountryRank`, extend `Standing` type + `getStanding` return           |
| `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` | Invalidate quick wins on approval                                             |
| `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`               | Add `computeQuickWins` handler; invalidate on profile country/language change |
| `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`                    | Register `POST /compute-quick-wins` route                                     |
| `apps/strapi/src/index.ts`                                                 | Register cron job in bootstrap                                                |
| `apps/ui/src/lib/types/profile.ts`                                         | Add `QuickWin`, `ContributingStanding` types                                  |
| `apps/ui/src/app/[locale]/contribute/page.tsx`                             | Fetch standing + wins, render new widgets                                     |
