# Community & Rewards System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack community recognition system — a Strapi v5 `rewards` plugin that tracks points/tiers/badges per contributor, a public leaderboard page, a compact hub section, and profile integration.

**Architecture:** A self-contained `rewards` Strapi v5 plugin (mirroring `content-moderation`) owns the `point-event` and `badge-award` content types and exposes four content-API endpoints plus three admin endpoints. Points are awarded inside `content-moderation/server/services/submission.ts` after each approval. The frontend proxies leaderboard data via two Next.js API routes; the community page and hub section consume these via React Server Components.

**Tech Stack:** Strapi v5 (Document Service API + `strapi.db.connection` Knex for aggregation), TypeScript, Next.js 15 App Router RSC, React, Tailwind/inline styles with design tokens.

---

## File Map

### New files — Strapi plugin

| Path                                                                           | Responsibility                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `apps/strapi/src/plugins/rewards/package.json`                                 | Plugin manifest                                                |
| `apps/strapi/src/plugins/rewards/strapi-server.ts`                             | Plugin registration + bootstrap (permissions)                  |
| `apps/strapi/src/plugins/rewards/strapi-admin.tsx`                             | Admin sidebar link + lazy-load dashboard                       |
| `apps/strapi/src/plugins/rewards/server/content-types/index.ts`                | Export content-type map                                        |
| `apps/strapi/src/plugins/rewards/server/content-types/point-event/schema.json` | `rw_point_events` table schema                                 |
| `apps/strapi/src/plugins/rewards/server/content-types/badge-award/schema.json` | `rw_badge_awards` table schema                                 |
| `apps/strapi/src/plugins/rewards/server/services/points.ts`                    | `award()`, `computeTier()`, `updateStreak()`, `getForPeriod()` |
| `apps/strapi/src/plugins/rewards/server/services/badges.ts`                    | `BADGE_DEFINITIONS`, `checkAndAward()`                         |
| `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`               | `getLeaderboard()`, `getStanding()`                            |
| `apps/strapi/src/plugins/rewards/server/services/index.ts`                     | Export services map                                            |
| `apps/strapi/src/plugins/rewards/server/controllers/rewards.ts`                | All 7 route handlers                                           |
| `apps/strapi/src/plugins/rewards/server/controllers/index.ts`                  | Export controllers map                                         |
| `apps/strapi/src/plugins/rewards/server/routes/content-api.ts`                 | 4 public routes                                                |
| `apps/strapi/src/plugins/rewards/server/routes/admin.ts`                       | 3 admin routes                                                 |
| `apps/strapi/src/plugins/rewards/server/routes/index.ts`                       | Combined routes export                                         |
| `apps/strapi/src/plugins/rewards/admin/src/index.ts`                           | Re-export dashboard as `App`                                   |
| `apps/strapi/src/plugins/rewards/admin/src/pages/RewardsDashboard.tsx`         | 4-tab admin dashboard                                          |

### Modified files — Strapi

| Path                                                                       | Change                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/strapi/config/plugins.ts`                                            | Register `rewards` plugin                                             |
| `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`  | Add `points`, `pointsThisMonth`, `tier`, `streak`, `lastActivityDate` |
| `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` | Call `rewards.points.award()` after each approval                     |

### New files — Frontend

| Path                                                                             | Responsibility                                     |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/ui/src/app/api/leaderboard/route.ts`                                       | ISR proxy → Strapi `/api/rewards/leaderboard`      |
| `apps/ui/src/app/api/leaderboard/standing/route.ts`                              | No-cache proxy → Strapi `/api/rewards/my-standing` |
| `apps/ui/src/app/[locale]/contribute/community/page.tsx`                         | Full community leaderboard page                    |
| `apps/ui/src/app/[locale]/contribute/_components/ContributeCommunitySection.tsx` | Compact leaderboard hub section                    |

### Modified files — Frontend

| Path                                                                           | Change                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/ui/src/lib/types/profile.ts`                                             | Add `points`, `pointsThisMonth`, `tier`, `streak` to `UserProfile`                    |
| `apps/ui/src/app/[locale]/contribute/page.tsx`                                 | Import and render `ContributeCommunitySection`                                        |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx` | Render tier badge, points, streak from profile data                                   |
| `apps/ui/src/app/[locale]/contribute/layout.tsx`                               | Add persistent bottom nav-bar (HUB · COMMUNITY · ADD LIBRARY · EDIT · MY SUBMISSIONS) |

### New files — Docs

| Path                                  | Content                          |
| ------------------------------------- | -------------------------------- |
| `docs/community-and-points-system.md` | Full points system documentation |

### Modified files — Docs

| Path                              | Change                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| `docs/strapi-role-permissions.md` | Add rewards routes, plugin-only profile fields, RBAC permissions |

---

## Task 1: Plugin scaffold — package.json, strapi-server.ts, strapi-admin.tsx

**Files:**

- Create: `apps/strapi/src/plugins/rewards/package.json`
- Create: `apps/strapi/src/plugins/rewards/strapi-server.ts`
- Create: `apps/strapi/src/plugins/rewards/strapi-admin.tsx`
- Modify: `apps/strapi/config/plugins.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "rewards",
  "version": "0.1.0",
  "description": "Rewards plugin for libraries.global — points, tiers, badges, leaderboard",
  "strapi": {
    "kind": "plugin",
    "name": "rewards",
    "displayName": "Rewards",
    "description": "Track contributor points, tiers, and badges with a public leaderboard"
  },
  "scripts": {
    "build": "strapi-plugin build",
    "watch": "strapi-plugin watch"
  },
  "main": "./dist/server/index.js",
  "exports": {
    "./package.json": "./package.json",
    "./strapi-admin": {
      "source": "./strapi-admin.tsx",
      "import": "./dist/admin/index.mjs",
      "require": "./dist/admin/index.js",
      "default": "./dist/admin/index.js"
    },
    "./strapi-server": {
      "source": "./strapi-server.ts",
      "import": "./dist/server/index.mjs",
      "require": "./dist/server/index.js",
      "default": "./dist/server/index.js"
    }
  },
  "peerDependencies": {
    "react": "^17.0.0 || ^18.0.0",
    "react-dom": "^17.0.0 || ^18.0.0",
    "@strapi/strapi": "^5.0.0",
    "@strapi/design-system": "^2.0.0"
  },
  "files": ["dist", "strapi-admin.tsx", "strapi-server.ts"]
}
```

- [ ] **Step 2: Create `strapi-server.ts`**

```typescript
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register({ strapi }: { strapi: any }) {},
  async bootstrap({ strapi }: { strapi: any }) {
    await strapi.service("admin::permission").actionProvider.registerMany([
      {
        section: "plugins",
        displayName: "View rewards data",
        uid: "read",
        pluginName: "rewards",
      },
      {
        section: "plugins",
        displayName: "Manually award or deduct points",
        uid: "award",
        pluginName: "rewards",
      },
    ])
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
```

- [ ] **Step 3: Create `strapi-admin.tsx`**

```typescript
function RewardsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/rewards`,
      icon: RewardsIcon,
      intlLabel: {
        id: "rewards.plugin.name",
        defaultMessage: "Rewards",
      },
      Component: async () => {
        const { App } = await import("./admin/src/index")
        return App
      },
    })
  },
  bootstrap() {},
}
```

- [ ] **Step 4: Register the plugin in `apps/strapi/config/plugins.ts`**

Inside the returned object (after the `topics` entry), add:

```typescript
    rewards: {
      enabled: true,
      resolve: "./src/plugins/rewards",
    },
```

- [ ] **Step 5: Commit**

```bash
cd apps/strapi
git add src/plugins/rewards/package.json src/plugins/rewards/strapi-server.ts src/plugins/rewards/strapi-admin.tsx config/plugins.ts
git commit -m "feat(strapi): scaffold rewards plugin with bootstrap permissions"
```

---

## Task 2: Content types — point-event and badge-award schemas

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/content-types/point-event/schema.json`
- Create: `apps/strapi/src/plugins/rewards/server/content-types/badge-award/schema.json`
- Create: `apps/strapi/src/plugins/rewards/server/content-types/index.ts`

- [ ] **Step 1: Create `server/content-types/point-event/schema.json`**

```json
{
  "kind": "collectionType",
  "collectionName": "rw_point_events",
  "info": {
    "singularName": "point-event",
    "pluralName": "point-events",
    "displayName": "Point Event"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": true },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "baUserId": { "type": "string", "required": true },
    "action": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "new_library_approved",
        "edit_accepted_minor",
        "edit_accepted_major",
        "photo_licensed_cc",
        "hours_verified",
        "status_verified",
        "wiki_translated",
        "daily_streak",
        "manual_award",
        "manual_deduct"
      ]
    },
    "points": { "type": "integer", "required": true },
    "metadata": { "type": "json" },
    "awardedAt": { "type": "datetime", "required": true }
  }
}
```

- [ ] **Step 2: Create `server/content-types/badge-award/schema.json`**

```json
{
  "kind": "collectionType",
  "collectionName": "rw_badge_awards",
  "info": {
    "singularName": "badge-award",
    "pluralName": "badge-awards",
    "displayName": "Badge Award"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": true },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "baUserId": { "type": "string", "required": true },
    "badgeId": { "type": "string", "required": true },
    "awardedAt": { "type": "datetime", "required": true }
  }
}
```

- [ ] **Step 3: Create `server/content-types/index.ts`**

```typescript
import pointEventSchema from "./point-event/schema.json"
import badgeAwardSchema from "./badge-award/schema.json"

export default {
  "point-event": { schema: pointEventSchema },
  "badge-award": { schema: badgeAwardSchema },
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/content-types/
git commit -m "feat(strapi): add point-event and badge-award content types for rewards plugin"
```

---

## Task 3: user-profile schema additions

**Files:**

- Modify: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`

- [ ] **Step 1: Add 5 new fields to the `attributes` object in `schema.json`**

Add the following entries inside `"attributes"`, after the `"followedLibraries"` entry:

```json
    "points": { "type": "integer", "default": 0 },
    "pointsThisMonth": { "type": "integer", "default": 0 },
    "tier": { "type": "string", "default": "Reader" },
    "streak": { "type": "integer", "default": 0 },
    "lastActivityDate": { "type": "string" }
```

The complete `attributes` block now ends with:

```json
    "followedLibraries": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::library.library"
    },
    "points": { "type": "integer", "default": 0 },
    "pointsThisMonth": { "type": "integer", "default": 0 },
    "tier": { "type": "string", "default": "Reader" },
    "streak": { "type": "integer", "default": 0 },
    "lastActivityDate": { "type": "string" }
  }
```

- [ ] **Step 2: Verify Strapi starts and migrates the new columns**

```bash
cd apps/strapi
pnpm develop
```

Expected: Server starts cleanly, no migration errors. In Strapi admin → Content Manager → User Profile, the five new fields should be visible.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/api/user-profile/content-types/user-profile/schema.json
git commit -m "feat(strapi): add points, tier, streak, lastActivityDate fields to user-profile"
```

---

## Task 4: Points service

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/services/points.ts`

- [ ] **Step 1: Create `server/services/points.ts`**

```typescript
export type PointAction =
  | "new_library_approved"
  | "edit_accepted_minor"
  | "edit_accepted_major"
  | "photo_licensed_cc"
  | "hours_verified"
  | "status_verified"
  | "wiki_translated"
  | "daily_streak"
  | "manual_award"
  | "manual_deduct"

export type TierInfo = {
  level: number
  name: string
  nextName: string | null
  nextThreshold: number | null
  progressPercent: number
}

const TIERS: { level: number; name: string; min: number }[] = [
  { level: 1, name: "Reader", min: 0 },
  { level: 2, name: "Indexer", min: 100 },
  { level: 3, name: "Cartographer", min: 500 },
  { level: 4, name: "Archivist", min: 1500 },
  { level: 5, name: "Scholar", min: 4000 },
  { level: 6, name: "Curator", min: 9000 },
]

export function computeTier(total: number): TierInfo {
  let current = TIERS[0]
  for (const tier of TIERS) {
    if (total >= tier.min) current = tier
  }
  const nextIdx = TIERS.findIndex((t) => t.level === current.level) + 1
  const next = nextIdx < TIERS.length ? TIERS[nextIdx] : null
  const progressPercent = next
    ? Math.min(
        100,
        Math.round(((total - current.min) / (next.min - current.min)) * 100)
      )
    : 100

  return {
    level: current.level,
    name: current.name,
    nextName: next?.name ?? null,
    nextThreshold: next?.min ?? null,
    progressPercent,
  }
}

export default ({ strapi }: { strapi: any }) => ({
  computeTier,

  async updateStreak(baUserId: string): Promise<number> {
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (!profile) return 1

    const today = new Date().toISOString().slice(0, 10)
    const last = profile.lastActivityDate ?? null

    if (last === today) return profile.streak ?? 1

    if (last) {
      const yesterday = new Date(Date.now() - 86_400_000)
        .toISOString()
        .slice(0, 10)
      if (last === yesterday) return (profile.streak ?? 0) + 1
    }

    return 1
  },

  async getForPeriod(baUserId: string, periodStart: Date): Promise<number> {
    const rows = (await strapi.db.connection
      .select(strapi.db.connection.raw("COALESCE(SUM(points), 0) as total"))
      .from("rw_point_events")
      .where("ba_user_id", baUserId)
      .where("awarded_at", ">=", periodStart.toISOString())) as {
      total: string | number
    }[]

    return Number(rows[0]?.total ?? 0)
  },

  async award(
    baUserId: string,
    action: PointAction,
    pts: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date()

    // Create the point-event record
    await strapi.documents("plugin::rewards.point-event").create({
      data: {
        baUserId,
        action,
        points: pts,
        metadata: metadata ?? null,
        awardedAt: now,
      },
    })

    // Read current profile totals
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (!profile) {
      strapi.log.warn(
        `[rewards] No user-profile found for baUserId ${baUserId}`
      )
      return
    }

    const today = now.toISOString().slice(0, 10)
    const currentMonth = today.slice(0, 7) // "YYYY-MM"
    const lastMonth = profile.lastActivityDate?.slice(0, 7) ?? null

    const newTotal = (profile.points ?? 0) + pts
    const newThisMonth =
      lastMonth === currentMonth ? (profile.pointsThisMonth ?? 0) + pts : pts

    const newStreak = await (this as any).updateStreak(baUserId)
    const tier = computeTier(newTotal)

    await strapi.db.query("api::user-profile.user-profile").update({
      where: { baUserId },
      data: {
        points: newTotal,
        pointsThisMonth: newThisMonth,
        tier: tier.name,
        streak: newStreak,
        lastActivityDate: today,
      },
    })

    // Check and award badges after every point event
    await strapi.plugin("rewards").service("badges").checkAndAward(baUserId)
  },
})
```

- [ ] **Step 2: Manual smoke test**

After wiring services/index.ts (Task 7) and starting Strapi, verify in a Strapi lifecycle test file or via the admin panel that calling the service directly does not throw. This is tested end-to-end in Task 12.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/services/points.ts
git commit -m "feat(strapi): add rewards points service with award, computeTier, updateStreak"
```

---

## Task 5: Badges service

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/services/badges.ts`

- [ ] **Step 1: Create `server/services/badges.ts`**

```typescript
export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "STATUS"
  icon: string
  check: (counts: ActionCounts) => boolean
}

type ActionCounts = Record<string, number>

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "verifier",
    name: "Verifier",
    description: "Verified opening hours or operational status 10 times.",
    rarity: "UNCOMMON",
    icon: "VF",
    check: (c) => (c.hours_verified ?? 0) + (c.status_verified ?? 0) >= 10,
  },
  {
    id: "indexer",
    name: "Indexer",
    description: "Had 10 new library submissions approved.",
    rarity: "RARE",
    icon: "IX",
    check: (c) => (c.new_library_approved ?? 0) >= 10,
  },
  {
    id: "photographer",
    name: "Photographer",
    description: "Had 5 CC-licensed photos accepted.",
    rarity: "UNCOMMON",
    icon: "PH",
    check: (c) => (c.photo_licensed_cc ?? 0) >= 5,
  },
  {
    id: "translator",
    name: "Translator",
    description: "Had 3 wiki page translations approved.",
    rarity: "UNCOMMON",
    icon: "TR",
    check: (c) => (c.wiki_translated ?? 0) >= 3,
  },
  {
    id: "archivist",
    name: "Archivist",
    description: "Had 50 edits approved.",
    rarity: "RARE",
    icon: "AR",
    check: (c) =>
      (c.edit_accepted_minor ?? 0) + (c.edit_accepted_major ?? 0) >= 50,
  },
  {
    id: "streaker",
    name: "Dedicated",
    description: "Maintained a 30-day consecutive activity streak.",
    rarity: "RARE",
    icon: "ST",
    check: (c) => (c.daily_streak ?? 0) >= 30,
  },
]

export default ({ strapi }: { strapi: any }) => ({
  BADGE_DEFINITIONS,

  async checkAndAward(baUserId: string): Promise<void> {
    // Aggregate action counts for this user
    const rows = (await strapi.db.connection
      .select("action")
      .count({ count: "*" })
      .from("rw_point_events")
      .where("ba_user_id", baUserId)
      .groupBy("action")) as { action: string; count: string | number }[]

    const counts: ActionCounts = {}
    for (const row of rows) {
      counts[row.action] = Number(row.count)
    }

    // Fetch already-awarded badge IDs to avoid duplicates
    const existing = (await strapi.db
      .query("plugin::rewards.badge-award")
      .findMany({ where: { baUserId } })) as { badgeId: string }[]

    const earnedSet = new Set(existing.map((b) => b.badgeId))

    // Check each badge definition and create new awards
    const now = new Date()
    for (const def of BADGE_DEFINITIONS) {
      if (!earnedSet.has(def.id) && def.check(counts)) {
        await strapi.documents("plugin::rewards.badge-award").create({
          data: { baUserId, badgeId: def.id, awardedAt: now },
        })
        strapi.log.info(
          `[rewards] Awarded badge "${def.id}" to user ${baUserId}`
        )
      }
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/services/badges.ts
git commit -m "feat(strapi): add rewards badges service with BADGE_DEFINITIONS and checkAndAward"
```

---

## Task 6: Leaderboard service

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`

- [ ] **Step 1: Create `server/services/leaderboard.ts`**

```typescript
import { computeTier, type TierInfo } from "./points"

export type Period = "today" | "week" | "month" | "all"

export type LeaderboardEntry = {
  rank: number
  rankChange: number | null
  baUserId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  country: string | null
  contributorRole: string | null
  periodPoints: number
  totalPoints: number
  tier: string
}

export type Standing = {
  globalRank: number | null
  tier: TierInfo
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

function periodStart(period: Period): Date | null {
  const now = new Date()
  if (period === "all") return null
  if (period === "today") {
    return new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z")
  }
  if (period === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export default ({ strapi }: { strapi: any }) => ({
  async getLeaderboard(opts: {
    period: Period
    region?: string
    page: number
    limit: number
  }): Promise<LeaderboardEntry[]> {
    const { period, page, limit } = opts
    const start = periodStart(period)
    const offset = (page - 1) * limit

    // Step 1: aggregate points per user for the period
    let q = strapi.db.connection
      .select("ba_user_id")
      .sum({ periodPoints: "points" })
      .from("rw_point_events")
      .groupBy("ba_user_id")
      .orderBy("periodPoints", "desc")
      .limit(limit)
      .offset(offset)

    if (start) q = q.where("awarded_at", ">=", start.toISOString())

    const rows = (await q) as { ba_user_id: string; periodPoints: string }[]

    if (rows.length === 0) return []

    // Step 2: fetch profile data for each user
    const userIds = rows.map((r) => r.ba_user_id)
    const profiles = (await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({
        where: { baUserId: { $in: userIds } },
      })) as {
      baUserId: string
      username: string | null
      firstName: string | null
      lastName: string | null
      avatarUrl: string | null
      country: string | null
      contributorRole: string | null
      points: number
      tier: string
    }[]

    const profileMap = new Map(profiles.map((p) => [p.baUserId, p]))

    return rows.map((row, i) => {
      const profile = profileMap.get(row.ba_user_id)

      return {
        rank: offset + i + 1,
        rankChange: null, // Future: compute by comparing previous period
        baUserId: row.ba_user_id,
        username: profile?.username ?? null,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        country: profile?.country ?? null,
        contributorRole: profile?.contributorRole ?? null,
        periodPoints: Number(row.periodPoints),
        totalPoints: profile?.points ?? 0,
        tier: profile?.tier ?? "Reader",
      }
    })
  },

  async getStanding(baUserId: string): Promise<Standing> {
    const profile = (await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })) as {
      points: number
      pointsThisMonth: number
      tier: string
      streak: number
    } | null

    if (!profile) {
      return {
        globalRank: null,
        tier: computeTier(0),
        streak: 0,
        totalPoints: 0,
        pointsThisMonth: 0,
        recentBadges: [],
        suggestedAction:
          "Make your first contribution to start earning points.",
      }
    }

    // Global rank: count users with more points
    const rankResult = (await strapi.db.connection
      .count({ count: "*" })
      .from("user_profiles")
      .where("points", ">", profile.points ?? 0)) as { count: string }[]

    const globalRank = Number(rankResult[0]?.count ?? 0) + 1

    // Recent badges (last 5)
    const recentBadges = (await strapi.db
      .query("plugin::rewards.badge-award")
      .findMany({
        where: { baUserId },
        orderBy: { awardedAt: "desc" },
        limit: 5,
      })) as { badgeId: string; awardedAt: Date }[]

    const tier = computeTier(profile.points ?? 0)

    const suggestedActions: Record<string, string> = {
      Reader:
        "Submit your first library to earn 50 points and reach Indexer tier.",
      Indexer:
        "Verify opening hours on 5 libraries to unlock the Verifier badge.",
      Cartographer: "Submit 3 more libraries to reach Archivist tier.",
      Archivist: "Contribute 10 edits to unlock the Archivist badge.",
      Scholar: "You're close to Curator — keep contributing daily!",
      Curator: "You've reached the top tier. Thank you for your dedication.",
    }

    return {
      globalRank,
      tier,
      streak: profile.streak ?? 0,
      totalPoints: profile.points ?? 0,
      pointsThisMonth: profile.pointsThisMonth ?? 0,
      recentBadges: recentBadges.map((b) => ({
        badgeId: b.badgeId,
        awardedAt: new Date(b.awardedAt).toISOString(),
      })),
      suggestedAction: suggestedActions[tier.name] ?? "Keep contributing!",
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/services/leaderboard.ts
git commit -m "feat(strapi): add rewards leaderboard service with getLeaderboard and getStanding"
```

---

## Task 7: Services index

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/services/index.ts`

- [ ] **Step 1: Create `server/services/index.ts`**

```typescript
import points from "./points"
import badges from "./badges"
import leaderboard from "./leaderboard"

export default { points, badges, leaderboard }
```

- [ ] **Step 2: Verify Strapi starts without errors**

```bash
cd apps/strapi && pnpm develop
```

Expected: no import errors, no schema errors. The plugin services are registered.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/services/index.ts
git commit -m "feat(strapi): wire rewards services index"
```

---

## Task 8: Controller

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/controllers/rewards.ts`
- Create: `apps/strapi/src/plugins/rewards/server/controllers/index.ts`

- [ ] **Step 1: Create `server/controllers/rewards.ts`**

```typescript
export default ({ strapi }: { strapi: any }) => ({
  // ── Content API ──────────────────────────────────────────────────────────

  async leaderboard(ctx: any) {
    const {
      period = "month",
      region,
      page = "1",
      limit = "20",
    } = ctx.query as Record<string, string>

    const entries = await strapi
      .plugin("rewards")
      .service("leaderboard")
      .getLeaderboard({
        period: period as "today" | "week" | "month" | "all",
        region: region ?? undefined,
        page: Number(page),
        limit: Math.min(Number(limit), 100),
      })

    return ctx.send({ data: entries })
  },

  async myStanding(ctx: any) {
    const baUserId = ctx.request.headers["x-ba-user-id"] as string | undefined

    if (!baUserId) {
      return ctx.unauthorized("Authentication required")
    }

    const standing = await strapi
      .plugin("rewards")
      .service("leaderboard")
      .getStanding(baUserId)

    return ctx.send({ data: standing })
  },

  async myHistory(ctx: any) {
    const baUserId = ctx.request.headers["x-ba-user-id"] as string | undefined

    if (!baUserId) {
      return ctx.unauthorized("Authentication required")
    }

    const { page = "1" } = ctx.query as Record<string, string>
    const limit = 50
    const offset = (Number(page) - 1) * limit

    const events = await strapi.db
      .query("plugin::rewards.point-event")
      .findMany({
        where: { baUserId },
        orderBy: { awardedAt: "desc" },
        limit,
        offset,
      })

    return ctx.send({ data: events })
  },

  async howItWorks(ctx: any) {
    return ctx.send({
      data: {
        tiers: [
          { level: 1, name: "Reader", min: 0 },
          { level: 2, name: "Indexer", min: 100 },
          { level: 3, name: "Cartographer", min: 500 },
          { level: 4, name: "Archivist", min: 1500 },
          { level: 5, name: "Scholar", min: 4000 },
          { level: 6, name: "Curator", min: 9000 },
        ],
        actions: [
          {
            action: "new_library_approved",
            label: "New library approved",
            points: 50,
          },
          {
            action: "edit_accepted_minor",
            label: "Edit approved (1–3 fields)",
            points: 5,
          },
          {
            action: "edit_accepted_major",
            label: "Edit approved (4+ fields)",
            points: 15,
          },
          {
            action: "photo_licensed_cc",
            label: "CC-licensed photo accepted",
            points: 8,
          },
          {
            action: "hours_verified",
            label: "Opening hours verified on-site",
            points: 5,
          },
          {
            action: "status_verified",
            label: "Operational status verified",
            points: 5,
          },
          {
            action: "wiki_translated",
            label: "Wiki page translation approved",
            points: 15,
          },
          {
            action: "daily_streak",
            label: "Daily contribution streak",
            points: 1,
          },
        ],
      },
    })
  },

  // ── Admin routes ─────────────────────────────────────────────────────────

  async adminEvents(ctx: any) {
    const {
      baUserId,
      action,
      from,
      to,
      page = "1",
    } = ctx.query as Record<string, string>
    const limit = 50
    const offset = (Number(page) - 1) * limit

    const where: Record<string, unknown> = {}
    if (baUserId) where.baUserId = baUserId
    if (action) where.action = action
    if (from || to) {
      where.awardedAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }

    const events = await strapi.db
      .query("plugin::rewards.point-event")
      .findMany({
        where,
        orderBy: { awardedAt: "desc" },
        limit,
        offset,
      })

    const total = await strapi.db
      .query("plugin::rewards.point-event")
      .count({ where })

    return ctx.send({
      data: events,
      meta: { total, page: Number(page), limit },
    })
  },

  async adminAward(ctx: any) {
    const { baUserId, action, points, reason } = ctx.request.body as {
      baUserId: string
      action: "manual_award" | "manual_deduct"
      points: number
      reason: string
    }

    if (!baUserId || !action || points === undefined || !reason) {
      return ctx.badRequest(
        "baUserId, action, points, and reason are all required"
      )
    }
    if (!["manual_award", "manual_deduct"].includes(action)) {
      return ctx.badRequest('action must be "manual_award" or "manual_deduct"')
    }

    const adminUserId = ctx.state?.admin?.id ?? ctx.state?.user?.id ?? "unknown"

    await strapi
      .plugin("rewards")
      .service("points")
      .award(
        baUserId,
        action,
        action === "manual_deduct" ? -Math.abs(points) : Math.abs(points),
        {
          reason,
          awardedBy: String(adminUserId),
        }
      )

    return ctx.send({ ok: true })
  },

  async adminStats(ctx: any) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalContributors = (await strapi.db.connection
      .countDistinct({ count: "ba_user_id" })
      .from("rw_point_events")) as { count: string }[]

    const pointsThisMonth = (await strapi.db.connection
      .sum({ total: "points" })
      .from("rw_point_events")
      .where("awarded_at", ">=", monthStart.toISOString())) as {
      total: string | null
    }[]

    return ctx.send({
      data: {
        totalContributors: Number(totalContributors[0]?.count ?? 0),
        pointsThisMonth: Number(pointsThisMonth[0]?.total ?? 0),
      },
    })
  },
})
```

- [ ] **Step 2: Create `server/controllers/index.ts`**

```typescript
import rewards from "./rewards"

export default { rewards }
```

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/controllers/
git commit -m "feat(strapi): add rewards controller with leaderboard, standing, history, admin handlers"
```

---

## Task 9: Routes

**Files:**

- Create: `apps/strapi/src/plugins/rewards/server/routes/content-api.ts`
- Create: `apps/strapi/src/plugins/rewards/server/routes/admin.ts`
- Create: `apps/strapi/src/plugins/rewards/server/routes/index.ts`

- [ ] **Step 1: Create `server/routes/content-api.ts`**

```typescript
export default [
  {
    method: "GET",
    path: "/leaderboard",
    handler: "rewards.leaderboard",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/my-standing",
    handler: "rewards.myStanding",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/my-history",
    handler: "rewards.myHistory",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/how-it-works",
    handler: "rewards.howItWorks",
    config: { auth: false, policies: [] },
  },
]
```

- [ ] **Step 2: Create `server/routes/admin.ts`**

```typescript
export default {
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/events",
      handler: "rewards.adminEvents",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "POST",
      path: "/award",
      handler: "rewards.adminAward",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/stats",
      handler: "rewards.adminStats",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
  ],
}
```

- [ ] **Step 3: Create `server/routes/index.ts`**

```typescript
import contentApi from "./content-api"
import admin from "./admin"

export default {
  "content-api": { type: "content-api", routes: contentApi },
  admin,
}
```

- [ ] **Step 4: Verify the routes are registered**

Start Strapi and run:

```bash
curl http://127.0.0.1:1337/api/rewards/how-it-works
```

Expected: JSON response with `tiers` and `actions` arrays (no auth needed).

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/routes/
git commit -m "feat(strapi): add rewards plugin content-api and admin routes"
```

---

## Task 10: Admin panel

**Files:**

- Create: `apps/strapi/src/plugins/rewards/admin/src/index.ts`
- Create: `apps/strapi/src/plugins/rewards/admin/src/pages/RewardsDashboard.tsx`

- [ ] **Step 1: Create `admin/src/index.ts`**

```typescript
export { RewardsDashboard as App } from "./pages/RewardsDashboard"
```

- [ ] **Step 2: Create `admin/src/pages/RewardsDashboard.tsx`**

```typescript
import React, { useEffect, useState } from "react"
import {
  Box,
  Button,
  Field,
  Flex,
  NumberInput,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"

type Event = {
  id: number
  baUserId: string
  action: string
  points: number
  awardedAt: string
  metadata: Record<string, unknown> | null
}

type Stats = {
  totalContributors: number
  pointsThisMonth: number
}

const TABS = ["Overview", "Event Log", "Manual Award"] as const
type Tab = (typeof TABS)[number]

function useAdminFetch<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/rewards${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setData(json.data as T)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading }
}

function OverviewTab() {
  const { data: stats, loading } = useAdminFetch<Stats>("/stats")

  if (loading)
    return (
      <Box padding={6}>
        <Typography>Loading…</Typography>
      </Box>
    )

  return (
    <Box padding={6}>
      <Flex gap={6} marginBottom={6}>
        <Box
          padding={4}
          background="neutral100"
          borderColor="neutral200"
          hasRadius
        >
          <Typography variant="sigma" textColor="neutral600">
            Total contributors
          </Typography>
          <Typography variant="alpha">
            {stats?.totalContributors ?? 0}
          </Typography>
        </Box>
        <Box
          padding={4}
          background="neutral100"
          borderColor="neutral200"
          hasRadius
        >
          <Typography variant="sigma" textColor="neutral600">
            Points awarded this month
          </Typography>
          <Typography variant="alpha">
            {stats?.pointsThisMonth ?? 0}
          </Typography>
        </Box>
      </Flex>
    </Box>
  )
}

function EventLogTab() {
  const [page, setPage] = useState(1)
  const [filterUser, setFilterUser] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [queryKey, setQueryKey] = useState(0)

  const path = `/events?page=${page}${filterUser ? `&baUserId=${filterUser}` : ""}${filterAction ? `&action=${filterAction}` : ""}`
  const { data, loading } = useAdminFetch<{
    events: Event[]
    meta: { total: number }
  }>(path, [queryKey, page])

  const events: Event[] =
    Array.isArray(data) ? (data as unknown as Event[]) : []

  return (
    <Box padding={6}>
      <Flex gap={4} marginBottom={4}>
        <Field.Root>
          <Field.Label>User ID</Field.Label>
          <TextInput
            value={filterUser}
            onChange={(e: any) => setFilterUser(e.target.value)}
            placeholder="baUserId"
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Action</Field.Label>
          <TextInput
            value={filterAction}
            onChange={(e: any) => setFilterAction(e.target.value)}
            placeholder="e.g. new_library_approved"
          />
        </Field.Root>
        <Box paddingTop={5}>
          <Button onClick={() => setQueryKey((k) => k + 1)}>Filter</Button>
        </Box>
      </Flex>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <Table colCount={5} rowCount={events.length}>
          <Thead>
            <Tr>
              <Th><Typography variant="sigma">User ID</Typography></Th>
              <Th><Typography variant="sigma">Action</Typography></Th>
              <Th><Typography variant="sigma">Points</Typography></Th>
              <Th><Typography variant="sigma">Awarded At</Typography></Th>
              <Th><Typography variant="sigma">Metadata</Typography></Th>
            </Tr>
          </Thead>
          <Tbody>
            {events.map((ev) => (
              <Tr key={ev.id}>
                <Td><Typography>{ev.baUserId}</Typography></Td>
                <Td><Typography>{ev.action}</Typography></Td>
                <Td>
                  <Typography textColor={ev.points < 0 ? "danger600" : "success600"}>
                    {ev.points > 0 ? "+" : ""}
                    {ev.points}
                  </Typography>
                </Td>
                <Td>
                  <Typography>
                    {new Date(ev.awardedAt).toLocaleString()}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="pi" textColor="neutral500">
                    {ev.metadata ? JSON.stringify(ev.metadata).slice(0, 60) : "—"}
                  </Typography>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Flex gap={2} marginTop={4}>
        <Button
          variant="tertiary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Typography paddingTop={2}>Page {page}</Typography>
        <Button variant="tertiary" onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </Flex>
    </Box>
  )
}

function ManualAwardTab() {
  const [baUserId, setBaUserId] = useState("")
  const [action, setAction] = useState<"manual_award" | "manual_deduct">("manual_award")
  const [points, setPoints] = useState(10)
  const [reason, setReason] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")

  const submit = async () => {
    if (!baUserId || !reason || !points) return
    setStatus("loading")
    try {
      const res = await fetch("/rewards/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ baUserId, action, points, reason }),
      })
      setStatus(res.ok ? "success" : "error")
    } catch {
      setStatus("error")
    }
  }

  return (
    <Box padding={6} maxWidth="480px">
      <Flex direction="column" gap={4}>
        <Field.Root>
          <Field.Label>User ID (baUserId)</Field.Label>
          <TextInput
            value={baUserId}
            onChange={(e: any) => setBaUserId(e.target.value)}
            placeholder="better-auth user ID"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Action</Field.Label>
          <Flex gap={2}>
            <Button
              variant={action === "manual_award" ? "default" : "tertiary"}
              onClick={() => setAction("manual_award")}
            >
              Award
            </Button>
            <Button
              variant={action === "manual_deduct" ? "danger" : "tertiary"}
              onClick={() => setAction("manual_deduct")}
            >
              Deduct
            </Button>
          </Flex>
        </Field.Root>

        <Field.Root>
          <Field.Label>Points</Field.Label>
          <NumberInput
            value={points}
            onValueChange={(v: number) => setPoints(v)}
          />
        </Field.Root>

        <Field.Root>
          <Field.Label>Reason (required)</Field.Label>
          <TextInput
            value={reason}
            onChange={(e: any) => setReason(e.target.value)}
            placeholder="Why is this award/deduction being made?"
          />
        </Field.Root>

        <Button
          loading={status === "loading"}
          disabled={!baUserId || !reason || !points}
          variant={action === "manual_deduct" ? "danger" : "default"}
          onClick={submit}
        >
          {action === "manual_award" ? "Award Points" : "Deduct Points"}
        </Button>

        {status === "success" && (
          <Typography textColor="success600">Done — points updated.</Typography>
        )}
        {status === "error" && (
          <Typography textColor="danger600">
            Something went wrong. Check the server logs.
          </Typography>
        )}
      </Flex>
    </Box>
  )
}

export function RewardsDashboard() {
  const [tab, setTab] = useState<Tab>("Overview")

  return (
    <Box padding={6}>
      <Box marginBottom={6}>
        <Typography variant="alpha">Rewards</Typography>
        <Typography textColor="neutral500">
          Points, tiers, badges and leaderboard management.
        </Typography>
      </Box>

      <Flex gap={2} marginBottom={4}>
        {TABS.map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "tertiary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </Flex>

      {tab === "Overview" && <OverviewTab />}
      {tab === "Event Log" && <EventLogTab />}
      {tab === "Manual Award" && <ManualAwardTab />}
    </Box>
  )
}
```

- [ ] **Step 3: Start Strapi and verify the Rewards tab appears in the admin sidebar**

```bash
cd apps/strapi && pnpm develop
```

Navigate to `http://127.0.0.1:1337/admin`. Expected: "Rewards" entry appears in the left sidebar under the plugin section.

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/rewards/admin/
git commit -m "feat(strapi): add rewards admin dashboard with overview, event log, and manual award tabs"
```

---

## Task 11: content-moderation integration

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`

- [ ] **Step 1: Add rewards hook after new_library approval**

In `updateStatus()`, after the existing auto-claim block (after the closing `}` for the `new_library` approval branch, around line 232), add:

```typescript
// Award points for new_library approval — non-fatal
if (status === "approved" && submission?.submissionType === "new_library") {
  try {
    await strapi
      .plugin("rewards")
      .service("points")
      .award(submission.submittedByUserId, "new_library_approved", 50, {
        submissionId: documentId,
        libraryName: String(
          (submission.fields as Record<string, unknown>)?.name ?? ""
        ),
      })
  } catch (err) {
    strapi.log.warn("[content-moderation] rewards.award failed:", err)
  }
}
```

- [ ] **Step 2: Add rewards hook after library_edit approval**

After the closing `}` for the `library_claim` approval block, add:

```typescript
// Award points for library_edit approval (minor: 1–3 fields, major: 4+)
if (status === "approved" && submission?.submissionType === "library_edit") {
  try {
    const fields = (submission.fields ?? {}) as Record<string, unknown>
    const fieldCount = Object.keys(fields).filter(
      (k) => fields[k] !== null && fields[k] !== undefined && fields[k] !== ""
    ).length
    const action =
      fieldCount >= 4 ? "edit_accepted_major" : "edit_accepted_minor"
    const pts = fieldCount >= 4 ? 15 : 5

    await strapi
      .plugin("rewards")
      .service("points")
      .award(submission.submittedByUserId, action, pts, {
        submissionId: documentId,
        fieldCount,
      })
  } catch (err) {
    strapi.log.warn("[content-moderation] rewards.award (edit) failed:", err)
  }
}

// Award points for wiki_edit approval
if (status === "approved" && submission?.submissionType === "wiki_edit") {
  try {
    const fields = (submission.fields ?? {}) as Record<string, unknown>
    const isTranslation = fields.isTranslation === true
    await strapi
      .plugin("rewards")
      .service("points")
      .award(
        submission.submittedByUserId,
        isTranslation ? "wiki_translated" : "edit_accepted_minor",
        isTranslation ? 15 : 5,
        { submissionId: documentId }
      )
  } catch (err) {
    strapi.log.warn("[content-moderation] rewards.award (wiki) failed:", err)
  }
}
```

- [ ] **Step 3: Integration test — approve a submission and check points**

1. Start Strapi: `cd apps/strapi && pnpm develop`
2. In Strapi admin → Moderation, find or create a `new_library` submission with `status: pending`
3. Change its status to `approved` via the Moderation dashboard
4. In Strapi admin → Content Manager → User Profile, find the submitter's profile
5. Verify `points` increased by 50 and `tier` updated accordingly
6. In Strapi admin → Rewards → Event Log, verify a `new_library_approved` event exists

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/server/services/submission.ts
git commit -m "feat(strapi): hook rewards.award into content-moderation approval flow"
```

---

## Task 12: Update UserProfile TypeScript type

**Files:**

- Modify: `apps/ui/src/lib/types/profile.ts`

- [ ] **Step 1: Add rewards fields to `UserProfile`**

In `apps/ui/src/lib/types/profile.ts`, inside the `UserProfile` type (after `followedLibraries`), add:

```typescript
  points?: number | null
  pointsThisMonth?: number | null
  tier?: string | null
  streak?: number | null
```

The `UserProfile` type now ends with:

```typescript
  followedLibraries?: FollowedLibrary[]
  points?: number | null
  pointsThisMonth?: number | null
  tier?: string | null
  streak?: number | null
  createdAt: string
  updatedAt: string
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd apps/ui && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/types/profile.ts
git commit -m "feat(ui): add points, tier, streak fields to UserProfile type"
```

---

## Task 13: Frontend API proxy routes

**Files:**

- Create: `apps/ui/src/app/api/leaderboard/route.ts`
- Create: `apps/ui/src/app/api/leaderboard/standing/route.ts`

- [ ] **Step 1: Create `apps/ui/src/app/api/leaderboard/route.ts`**

```typescript
import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

export const revalidate = 3600 // 1-hour ISR

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const qs = searchParams.toString()

  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard${qs ? `?${qs}` : ""}`,
      {
        next: { revalidate: 3600 },
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )

    if (!res.ok) {
      return NextResponse.json({ data: [] }, { status: res.status })
    }

    const json = await res.json()

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ data: [] }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `apps/ui/src/app/api/leaderboard/standing/route.ts`**

```typescript
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function GET(): Promise<Response> {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!SECRET) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  }

  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": session.user.id,
      },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error" },
        { status: res.status }
      )
    }

    const json = await res.json()

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify the routes return data**

Start both apps. Then:

```bash
curl "http://localhost:3000/api/leaderboard?period=month&limit=5"
```

Expected: `{ "data": [...] }` (empty array is fine if no events yet).

- [ ] **Step 4: Commit**

```bash
git add "apps/ui/src/app/api/leaderboard/"
git commit -m "feat(ui): add /api/leaderboard and /api/leaderboard/standing proxy routes"
```

---

## Task 14: ContributeCommunitySection component

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/_components/ContributeCommunitySection.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { T } from "@/lib/design-tokens"
import GlobalLink from "@/components/global/GlobalLink"

export type LeaderboardEntry = {
  rank: number
  baUserId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  country: string | null
  contributorRole: string | null
  periodPoints: number
  totalPoints: number
  tier: string
}

function getInitials(entry: LeaderboardEntry): string {
  const first = entry.firstName?.[0] ?? ""
  const last = entry.lastName?.[0] ?? ""
  return (first + last).toUpperCase() || (entry.username?.slice(0, 2).toUpperCase() ?? "??")
}

function getDisplayName(entry: LeaderboardEntry): string {
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(" ")
  return full || entry.username || `User ${entry.baUserId.slice(0, 6)}`
}

const TIER_COLORS: Record<string, string> = {
  Reader:       T.ink.faint,
  Indexer:      T.ink.dim,
  Cartographer: T.accent.aurora,
  Archivist:    T.accent.violet,
  Scholar:      T.accent.gold,
  Curator:      T.accent.gold,
}

async function fetchTopFive(): Promise<LeaderboardEntry[]> {
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${strapi}/api/rewards/leaderboard?period=month&limit=5`,
      {
        next: { revalidate: 3600 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LeaderboardEntry[] }
    return json.data ?? []
  } catch {
    return []
  }
}

export async function ContributeCommunitySection() {
  const entries = await fetchTopFive()

  return (
    <section
      style={{
        borderTop: `1px solid ${T.border.line}`,
        padding: "60px 0",
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 md:px-10">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "32px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".20em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                marginBottom: "8px",
              }}
            >
              Community
            </p>
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                lineHeight: 0.94,
                margin: 0,
              }}
            >
              The community.
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: T.ink.faint,
                marginTop: "10px",
                maxWidth: "36ch",
              }}
            >
              Contributors who shape the atlas, ranked by points this month.
            </p>
          </div>

          <GlobalLink
            href="/contribute/community"
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            See full leaderboard →
          </GlobalLink>
        </div>

        {/* Leaderboard rows */}
        {entries.length === 0 ? (
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              color: T.ink.faint,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            No contributions yet this month — be the first.
          </p>
        ) : (
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {entries.map((entry, i) => (
              <div
                key={entry.baUserId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "14px 20px",
                  borderBottom:
                    i < entries.length - 1
                      ? `1px solid ${T.border.line}`
                      : "none",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: i === 0 ? T.accent.gold : T.ink.faint,
                    letterSpacing: ".08em",
                    width: "24px",
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  {entry.rank}
                </span>

                {/* Avatar */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "rgba(127,223,255,0.10)",
                    border: "1px solid rgba(127,223,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    fontWeight: 600,
                    color: T.accent.aurora,
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {entry.avatarUrl ? (
                    <img
                      src={entry.avatarUrl}
                      alt={getDisplayName(entry)}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    getInitials(entry)
                  )}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 500,
                      color: T.ink.base,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getDisplayName(entry)}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".10em",
                      textTransform: "uppercase",
                      color: TIER_COLORS[entry.tier] ?? T.ink.faint,
                    }}
                  >
                    {entry.tier}
                    {entry.country ? ` · ${entry.country}` : ""}
                  </p>
                </div>

                {/* Points */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: T.font.serif,
                      fontSize: "20px",
                      fontWeight: 400,
                      letterSpacing: "-0.02em",
                      color: T.ink.base,
                    }}
                  >
                    {entry.periodPoints.toLocaleString()}
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: T.font.mono,
                      fontSize: "8px",
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                    }}
                  >
                    pts · month
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
          }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Showing top {entries.length} · Global · This month
          </span>
          <GlobalLink
            href="/contribute/community"
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
            }}
          >
            Full leaderboard →
          </GlobalLink>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Import it in `apps/ui/src/app/[locale]/contribute/page.tsx`**

At the top of the file, add:

```typescript
import { ContributeCommunitySection } from "./_components/ContributeCommunitySection"
```

In the JSX return, after `<ContributeGuidelinesSection />`, add:

```tsx
<ContributeCommunitySection />
```

- [ ] **Step 3: Verify the contribute page renders without error**

```bash
cd apps/ui && pnpm dev
```

Navigate to `http://localhost:3000/contribute`. Expected: community section appears below guidelines with "No contributions yet" or actual data.

- [ ] **Step 4: Commit**

```bash
git add "apps/ui/src/app/[locale]/contribute/_components/ContributeCommunitySection.tsx" "apps/ui/src/app/[locale]/contribute/page.tsx"
git commit -m "feat(ui): add ContributeCommunitySection to contribution hub"
```

---

## Task 15: Full community leaderboard page

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/community/page.tsx`

- [ ] **Step 1: Create the community page**

```typescript
import { headers } from "next/headers"

import GlobalLink from "@/components/global/GlobalLink"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import type { LeaderboardEntry } from "../_components/ContributeCommunitySection"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY
const SECRET = process.env.STRAPI_BRIDGE_SECRET

type Period = "today" | "week" | "month" | "all"

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all",   label: "All Time" },
]

const TIER_COLORS: Record<string, string> = {
  Reader:       T.ink.faint,
  Indexer:      T.ink.dim,
  Cartographer: T.accent.aurora,
  Archivist:    T.accent.violet,
  Scholar:      T.accent.gold,
  Curator:      T.accent.gold,
}

type Standing = {
  globalRank: number | null
  tier: {
    level: number
    name: string
    nextName: string | null
    nextThreshold: number | null
    progressPercent: number
  }
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

async function fetchLeaderboard(period: Period): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard?period=${period}&limit=50`,
      {
        next: { revalidate: 3600 },
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: LeaderboardEntry[] }
    return json.data ?? []
  } catch {
    return []
  }
}

async function fetchStanding(baUserId: string): Promise<Standing | null> {
  if (!SECRET) return null
  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": baUserId,
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Standing }
    return json.data ?? null
  } catch {
    return null
  }
}

function getDisplayName(entry: LeaderboardEntry): string {
  const full = [entry.firstName, entry.lastName].filter(Boolean).join(" ")
  return full || entry.username || `User ${entry.baUserId.slice(0, 6)}`
}

function getInitials(entry: LeaderboardEntry): string {
  const first = entry.firstName?.[0] ?? ""
  const last = entry.lastName?.[0] ?? ""
  return (first + last).toUpperCase() || (entry.username?.slice(0, 2).toUpperCase() ?? "??")
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period: Period =
    ["today", "week", "month", "all"].includes(periodParam ?? "")
      ? (periodParam as Period)
      : "month"

  const session = await getSessionSSR(await headers())

  const [entries, standing] = await Promise.all([
    fetchLeaderboard(period),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
  ])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg.space,
        color: T.ink.base,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-6 py-20 md:px-10">
        {/* Breadcrumb */}
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.low,
            display: "flex",
            gap: "10px",
            marginBottom: "32px",
          }}
        >
          <GlobalLink href="/" style={{ color: T.ink.low, textDecoration: "none" }}>Atlas</GlobalLink>
          <span>/</span>
          <GlobalLink href="/contribute" style={{ color: T.ink.low, textDecoration: "none" }}>Contribute</GlobalLink>
          <span>/</span>
          <span style={{ color: T.ink.base }}>Community</span>
        </div>

        {/* Hero */}
        <div style={{ marginBottom: "40px" }}>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              color: T.ink.base,
              margin: "0 0 14px",
            }}
          >
            The community,{" "}
            <em style={{ fontStyle: "italic", fontWeight: 400, color: "rgba(244,247,255,0.55)" }}>
              in numbers.
            </em>
          </h1>
          <p style={{ fontSize: "15px", color: T.ink.faint, maxWidth: "52ch" }}>
            Contributors who keep the atlas accurate and growing. Points are earned for every approved contribution.
          </p>
        </div>

        {/* Period tabs */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "32px",
            borderBottom: `1px solid ${T.border.line}`,
          }}
        >
          {PERIODS.map(({ key, label }) => (
            <GlobalLink
              key={key}
              href={`/contribute/community?period=${key}`}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: period === key ? T.accent.aurora : T.ink.faint,
                textDecoration: "none",
                padding: "10px 16px",
                borderBottom: period === key ? `2px solid ${T.accent.aurora}` : "2px solid transparent",
                marginBottom: "-1px",
                transition: "color 150ms",
              }}
            >
              {label}
            </GlobalLink>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "32px", alignItems: "start" }}>
          {/* Left: podium + ranked list */}
          <div>
            {entries.length === 0 ? (
              <p style={{ fontFamily: T.font.mono, fontSize: "11px", color: T.ink.faint, letterSpacing: ".08em", textTransform: "uppercase" }}>
                No contributions recorded for this period yet.
              </p>
            ) : (
              <>
                {/* Podium: top 3 */}
                {podium.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${podium.length}, 1fr)`,
                      gap: "12px",
                      marginBottom: "24px",
                    }}
                  >
                    {podium.map((entry) => (
                      <div
                        key={entry.baUserId}
                        style={{
                          padding: "20px 16px",
                          borderRadius: "12px",
                          border: `1px solid ${entry.rank === 1 ? T.accent.gold + "40" : T.border.line}`,
                          background: entry.rank === 1 ? "rgba(232,201,138,0.04)" : "rgba(255,255,255,0.015)",
                          textAlign: "center",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: T.font.serif,
                            fontSize: "32px",
                            fontWeight: 400,
                            color: entry.rank === 1 ? T.accent.gold : T.ink.faint,
                            lineHeight: 1,
                            marginBottom: "12px",
                          }}
                        >
                          {entry.rank}
                        </div>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            background: "rgba(127,223,255,0.10)",
                            border: "1px solid rgba(127,223,255,0.18)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: T.font.mono,
                            fontSize: "12px",
                            fontWeight: 600,
                            color: T.accent.aurora,
                            margin: "0 auto 10px",
                            overflow: "hidden",
                          }}
                        >
                          {entry.avatarUrl ? (
                            <img src={entry.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            getInitials(entry)
                          )}
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500, color: T.ink.base }}>
                          {getDisplayName(entry)}
                        </p>
                        <p
                          style={{
                            margin: "0 0 10px",
                            fontFamily: T.font.mono,
                            fontSize: "8px",
                            letterSpacing: ".10em",
                            textTransform: "uppercase",
                            color: TIER_COLORS[entry.tier] ?? T.ink.faint,
                          }}
                        >
                          {entry.tier}
                          {entry.country ? ` · ${entry.country}` : ""}
                        </p>
                        <div>
                          <span style={{ fontFamily: T.font.serif, fontSize: "24px", fontWeight: 400, letterSpacing: "-0.02em", color: T.ink.base }}>
                            {entry.periodPoints.toLocaleString()}
                          </span>
                          <span style={{ fontFamily: T.font.mono, fontSize: "8px", letterSpacing: ".12em", textTransform: "uppercase", color: T.ink.faint, marginLeft: "6px" }}>
                            pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ranked list rows 4+ */}
                {rest.length > 0 && (
                  <div style={{ border: `1px solid ${T.border.line}`, borderRadius: "12px", overflow: "hidden" }}>
                    {rest.map((entry, i) => (
                      <div
                        key={entry.baUserId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "12px 20px",
                          borderBottom: i < rest.length - 1 ? `1px solid ${T.border.line}` : "none",
                          background: "rgba(255,255,255,0.012)",
                        }}
                      >
                        <span style={{ fontFamily: T.font.mono, fontSize: "10px", color: T.ink.faint, width: "28px", textAlign: "right", flexShrink: 0 }}>
                          {entry.rank}
                        </span>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "rgba(127,223,255,0.08)",
                            border: "1px solid rgba(127,223,255,0.14)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            fontWeight: 600,
                            color: T.accent.aurora,
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {entry.avatarUrl ? (
                            <img src={entry.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            getInitials(entry)
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 500, color: T.ink.base, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getDisplayName(entry)}
                          </p>
                          <p style={{ margin: 0, fontFamily: T.font.mono, fontSize: "8px", letterSpacing: ".10em", textTransform: "uppercase", color: TIER_COLORS[entry.tier] ?? T.ink.faint }}>
                            {entry.tier}
                            {entry.country ? ` · ${entry.country}` : ""}
                          </p>
                        </div>
                        <span style={{ fontFamily: T.font.serif, fontSize: "18px", fontWeight: 400, letterSpacing: "-0.02em", color: T.ink.base, flexShrink: 0 }}>
                          {entry.periodPoints.toLocaleString()}
                          <span style={{ fontFamily: T.font.mono, fontSize: "7px", letterSpacing: ".12em", textTransform: "uppercase", color: T.ink.faint, marginLeft: "5px" }}>pts</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Your standing */}
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                padding: "20px",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <p style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, marginBottom: "12px" }}>
                Your standing
              </p>
              {!session?.user ? (
                <div>
                  <p style={{ fontSize: "13px", color: T.ink.dim, marginBottom: "12px" }}>
                    Sign in to see your rank, tier, and progress.
                  </p>
                  <GlobalLink
                    href="/auth/signin"
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: `1px solid rgba(127,223,255,0.3)`,
                      background: "rgba(127,223,255,0.07)",
                      color: T.accent.aurora,
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                    }}
                  >
                    Sign in →
                  </GlobalLink>
                </div>
              ) : standing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { label: "Global rank",       value: standing.globalRank != null ? `#${standing.globalRank}` : "—" },
                    { label: "Tier",               value: `${standing.tier.name} (Level ${standing.tier.level})` },
                    { label: "Total points",       value: standing.totalPoints.toLocaleString() },
                    { label: "This month",         value: standing.pointsThisMonth.toLocaleString() },
                    { label: "Streak",             value: `${standing.streak} day${standing.streak === 1 ? "" : "s"}` },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ margin: 0, fontFamily: T.font.mono, fontSize: "8px", letterSpacing: ".14em", textTransform: "uppercase", color: T.ink.faint }}>{label}</p>
                      <p style={{ margin: 0, fontFamily: T.font.serif, fontSize: "18px", fontWeight: 400, letterSpacing: "-0.02em", color: T.ink.base }}>{value}</p>
                    </div>
                  ))}
                  {standing.tier.nextName && (
                    <div>
                      <p style={{ margin: "0 0 4px", fontFamily: T.font.mono, fontSize: "8px", letterSpacing: ".14em", textTransform: "uppercase", color: T.ink.faint }}>
                        Progress to {standing.tier.nextName}
                      </p>
                      <div style={{ height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${standing.tier.progressPercent}%`, background: T.accent.aurora, borderRadius: "2px", transition: "width 600ms" }} />
                      </div>
                      <p style={{ margin: "4px 0 0", fontFamily: T.font.mono, fontSize: "8px", color: T.ink.faint, textAlign: "right" }}>
                        {standing.tier.progressPercent}%
                      </p>
                    </div>
                  )}
                  {standing.suggestedAction && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: T.ink.faint, fontStyle: "italic", lineHeight: 1.5 }}>
                      {standing.suggestedAction}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: T.ink.faint }}>Loading your standing…</p>
              )}
            </div>

            {/* How points work */}
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                padding: "20px",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <p style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, marginBottom: "12px" }}>
                How points work
              </p>
              {[
                { label: "New library approved",   pts: "+50" },
                { label: "Major edit approved",     pts: "+15" },
                { label: "Wiki translation",        pts: "+15" },
                { label: "Minor edit approved",     pts: "+5" },
                { label: "Hours verified",          pts: "+5" },
                { label: "Status verified",         pts: "+5" },
                { label: "Daily streak",            pts: "+1" },
              ].map(({ label, pts }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.border.line}` }}>
                  <span style={{ fontSize: "12px", color: T.ink.dim }}>{label}</span>
                  <span style={{ fontFamily: T.font.mono, fontSize: "11px", color: T.accent.aurora }}>{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page renders**

Navigate to `http://localhost:3000/contribute/community`. Expected: page loads with hero, period tabs, leaderboard (empty or populated), and sidebar.

- [ ] **Step 3: Commit**

```bash
git add "apps/ui/src/app/[locale]/contribute/community/"
git commit -m "feat(ui): add full community leaderboard page at /contribute/community"
```

---

## Task 16: Profile OverviewTab — tier, points, streak

**Files:**

- Modify: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx`

The `OverviewTab` receives `profile: UserProfile` as a prop (already containing the new fields added in Task 12).

- [ ] **Step 1: Locate the stats grid in `OverviewTab.tsx`**

The OverviewTab renders a stats grid near the top. Find the section that renders contribution stats cards (the grid of stat boxes).

- [ ] **Step 2: Add tier, points, and streak stats**

In the stats grid array (the `stats` or equivalent array passed to the grid), append three new entries. The exact location depends on the current file structure — find the array of `{ label, value }` stat objects and append:

```typescript
  ...(profile.tier != null
    ? [{ label: "Tier", value: profile.tier }]
    : []),
  ...(profile.points != null
    ? [{ label: "Total points", value: profile.points.toLocaleString() }]
    : []),
  ...(profile.streak != null && profile.streak > 0
    ? [{ label: "Day streak", value: String(profile.streak) }]
    : []),
```

If the stats are rendered as individual JSX rather than a mapped array, add three new stat blocks with the same visual pattern as the existing ones. For example, after the existing stats divs:

```tsx
{
  profile.tier != null && (
    <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)" }}>
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "28px",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          color: T.ink.base,
          display: "block",
        }}
      >
        {profile.tier}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        Tier
      </span>
    </div>
  )
}
{
  profile.points != null && (
    <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)" }}>
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "28px",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          color: T.ink.base,
          display: "block",
        }}
      >
        {profile.points.toLocaleString()}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        Total points
      </span>
    </div>
  )
}
{
  ;(profile.streak ?? 0) > 0 && (
    <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)" }}>
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "28px",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          color: T.ink.base,
          display: "block",
        }}
      >
        {profile.streak}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        Day streak
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Verify the profile page renders correctly**

Navigate to a public profile page (e.g. `http://localhost:3000/profile/<username>`). Expected: tier, points, and streak stat cells appear in the overview stats grid (values may be defaults like "Reader", 0 until contributions exist).

- [ ] **Step 4: Commit**

```bash
git add "apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx"
git commit -m "feat(ui): show tier, points, and streak on profile overview tab"
```

---

## Task 17: Contribute layout nav-bar

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/layout.tsx`

- [ ] **Step 1: Replace the layout with one that includes a persistent bottom nav-bar**

```typescript
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

const NAV_ITEMS = [
  { href: "/contribute",             label: "Hub" },
  { href: "/contribute/community",   label: "Community" },
  { href: "/contribute/add",         label: "Add Library" },
  { href: "/contribute/edit",        label: "Edit" },
  { href: "/contribute/submissions", label: "My Submissions" },
] as const

export default async function ContributeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const navbarResult = await fetchNavbar(locale as Locale)

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <div style={{ background: "#030511" }}>
        {/* Persistent tab nav */}
        <nav
          style={{
            borderBottom: `1px solid ${T.border.line}`,
            background: "rgba(3,5,17,0.92)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: "56px",
            zIndex: 40,
          }}
        >
          <div
            className="mx-auto w-full max-w-5xl px-6 md:px-10"
            style={{ display: "flex", gap: "0", overflowX: "auto" }}
          >
            {NAV_ITEMS.map(({ href, label }) => (
              <GlobalLink
                key={href}
                href={href}
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  textDecoration: "none",
                  padding: "14px 16px",
                  whiteSpace: "nowrap",
                  transition: "color 150ms",
                  borderBottom: "2px solid transparent",
                }}
                className="hover:text-white"
                activeStyle={{
                  color: T.accent.aurora,
                  borderBottom: `2px solid ${T.accent.aurora}`,
                }}
              >
                {label}
              </GlobalLink>
            ))}
          </div>
        </nav>
        {children}
      </div>
    </>
  )
}
```

**Note:** `GlobalLink` may not support an `activeStyle` prop. If not, check whether the project uses a `usePathname` pattern to detect active routes. If `GlobalLink` is a thin wrapper around `next/link`, replace the active highlighting with a client component `ContributeNavBar` that reads `usePathname()`:

```typescript
// apps/ui/src/app/[locale]/contribute/_components/ContributeNavBar.tsx
"use client"
import { usePathname } from "next/navigation"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const NAV_ITEMS = [
  { href: "/contribute",             label: "Hub" },
  { href: "/contribute/community",   label: "Community" },
  { href: "/contribute/add",         label: "Add Library" },
  { href: "/contribute/edit",        label: "Edit" },
  { href: "/contribute/submissions", label: "My Submissions" },
] as const

export function ContributeNavBar() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: "rgba(3,5,17,0.92)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: "56px",
        zIndex: 40,
      }}
    >
      <div
        className="mx-auto w-full max-w-5xl px-6 md:px-10"
        style={{ display: "flex", gap: "0", overflowX: "auto" }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            href === "/contribute"
              ? pathname === "/contribute" || pathname === "/en/contribute"
              : pathname.includes(href.replace("/contribute", ""))

          return (
            <GlobalLink
              key={href}
              href={href}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: isActive ? T.accent.aurora : T.ink.faint,
                textDecoration: "none",
                padding: "14px 16px",
                whiteSpace: "nowrap",
                transition: "color 150ms",
                borderBottom: isActive
                  ? `2px solid ${T.accent.aurora}`
                  : "2px solid transparent",
              }}
            >
              {label}
            </GlobalLink>
          )
        })}
      </div>
    </nav>
  )
}
```

Then in the layout, replace the inline nav with `<ContributeNavBar />`.

- [ ] **Step 2: Verify the nav-bar appears and highlights correctly**

Navigate between `/contribute`, `/contribute/community`, `/contribute/submissions`. Expected: the active tab is highlighted in aurora.

- [ ] **Step 3: Commit**

```bash
git add "apps/ui/src/app/[locale]/contribute/layout.tsx" "apps/ui/src/app/[locale]/contribute/_components/ContributeNavBar.tsx"
git commit -m "feat(ui): add persistent bottom nav-bar to contribute layout"
```

---

## Task 18: Documentation

**Files:**

- Create: `docs/community-and-points-system.md`
- Modify: `docs/strapi-role-permissions.md`

- [ ] **Step 1: Create `docs/community-and-points-system.md`**

```markdown
# Community & Points System

The libraries.global rewards system recognises contributor effort through points, tiers, and badges. It is owned by the `rewards` Strapi v5 plugin.

---

## Point Values

| Action                 | Trigger                                                 | Points            |
| ---------------------- | ------------------------------------------------------- | ----------------- |
| `new_library_approved` | New library submission approved by editorial board      | +50               |
| `edit_accepted_major`  | Edit approved with 4 or more fields changed             | +15               |
| `wiki_translated`      | Wiki page translation approved                          | +15               |
| `photo_licensed_cc`    | CC-licensed photo accepted                              | +8                |
| `edit_accepted_minor`  | Edit approved with 1–3 fields changed                   | +5                |
| `hours_verified`       | Opening hours verified on-site                          | +5                |
| `status_verified`      | Operational status verified                             | +5                |
| `daily_streak`         | Any approved contribution on a consecutive calendar day | +1                |
| `manual_award`         | Admin manual award (reason required in metadata)        | Custom            |
| `manual_deduct`        | Admin manual deduction (reason required in metadata)    | Custom (negative) |

---

## Tier Thresholds

| Level | Name         | All-time points needed |
| ----- | ------------ | ---------------------- |
| I     | Reader       | 0                      |
| II    | Indexer      | 100                    |
| III   | Cartographer | 500                    |
| IV    | Archivist    | 1,500                  |
| V     | Scholar      | 4,000                  |
| VI    | Curator      | 9,000                  |

Tiers are computed from all-time points. The `tier` field on `user-profile` caches the current tier name so leaderboard queries do not need to recompute it on every row.

---

## Streak Mechanics

- A "streak" is the number of consecutive calendar days on which the user had an approved contribution.
- Streak is incremented when a new point event is awarded and `lastActivityDate` is yesterday.
- If `lastActivityDate` is today (a second award on the same day), streak does not increment.
- If `lastActivityDate` is any date earlier than yesterday, streak resets to 1.
- Streaks are tracked via the `streak` and `lastActivityDate` fields on `user-profile`.

---

## Badge Catalogue

| Badge ID       | Name         | Threshold                              |
| -------------- | ------------ | -------------------------------------- |
| `verifier`     | Verifier     | 10 combined hours/status verifications |
| `indexer`      | Indexer      | 10 new library submissions approved    |
| `photographer` | Photographer | 5 CC-licensed photos accepted          |
| `translator`   | Translator   | 3 wiki page translations approved      |
| `archivist`    | Archivist    | 50 edits (minor or major) approved     |
| `streaker`     | Dedicated    | 30 daily streak events in history      |

Badges are checked and awarded inside `rewards/server/services/badges.ts` after every `points.award()` call. Badge definitions live in code — not as a content type — so new badges require a code deploy.

---

## Manual Award / Deduction

Editorial staff with the `rewards:award` admin permission can manually award or deduct points via:

**Strapi admin → Rewards → Manual Award tab**

Required fields:

- **User ID (baUserId)**: the Better Auth user ID (visible in admin → User Profiles)
- **Action**: `manual_award` or `manual_deduct`
- **Points**: positive integer (sign applied automatically by action type)
- **Reason**: required text written into the event `metadata.reason` for auditability

All manual awards/deductions create a `point-event` record with `metadata.awardedBy` set to the admin's Strapi user ID.

---

## Integration with Content Moderation

Points are awarded in `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` inside `updateStatus()`, immediately after each approval side-effect (library creation, claim, etc.).

The call is wrapped in `try/catch` — a rewards failure never blocks an approval.

Action mapping:
| Submission type | Condition | Action | Points |
|-----------------|-----------|--------|--------|
| `new_library` | Approved | `new_library_approved` | 50 |
| `library_edit` | Approved, <4 fields | `edit_accepted_minor` | 5 |
| `library_edit` | Approved, 4+ fields | `edit_accepted_major` | 15 |
| `wiki_edit` | Approved, `fields.isTranslation = true` | `wiki_translated` | 15 |
| `wiki_edit` | Approved, not a translation | `edit_accepted_minor` | 5 |

---

## Security: Plugin-Only Profile Fields

The following fields on `user-profile` are written exclusively by the rewards plugin and must never appear in the `upsertProfile` allowlist in `apps/strapi/src/api/user-profile/controllers/user-profile.ts`:

- `points`
- `pointsThisMonth`
- `tier`
- `streak`
- `lastActivityDate`

These fields are read-only from the user's perspective. They are returned in public profile API responses so the frontend can display them.
```

- [ ] **Step 2: Update `docs/strapi-role-permissions.md`**

Find the section for `auth: false` routes table and append:

```markdown
| GET | `/api/rewards/leaderboard` | Public leaderboard — session validated internally if user header present |
| GET | `/api/rewards/my-standing` | User standing — 401 if no `X-Ba-User-Id` header |
| GET | `/api/rewards/my-history` | User history — 401 if no `X-Ba-User-Id` header |
| GET | `/api/rewards/how-it-works` | Static config — fully public |
```

Find the `upsertProfile` security section and add to the excluded fields list:

```markdown
**Plugin-only fields (never writable by upsertProfile):** `points`, `pointsThisMonth`, `tier`, `streak`, `lastActivityDate` — written exclusively by the `rewards` plugin service. See `docs/community-and-points-system.md`.
```

Find the Admin Panel RBAC section and append:

```markdown
### Rewards plugin

| Permission UID           | Display name                    | Who should have it |
| ------------------------ | ------------------------------- | ------------------ |
| `plugins::rewards.read`  | View rewards data               | Editors, admins    |
| `plugins::rewards.award` | Manually award or deduct points | Admins only        |
```

- [ ] **Step 3: Commit**

```bash
git add docs/community-and-points-system.md docs/strapi-role-permissions.md
git commit -m "docs: add community-and-points-system guide and update strapi-role-permissions"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement                                                     | Covered by    |
| -------------------------------------------------------------------- | ------------- |
| `rewards` Strapi v5 plugin                                           | Tasks 1–10    |
| `point-event` content type                                           | Task 2        |
| `badge-award` content type                                           | Task 2        |
| `points.ts` service (award, computeTier, updateStreak, getForPeriod) | Task 4        |
| `badges.ts` service + BADGE_DEFINITIONS                              | Task 5        |
| `leaderboard.ts` service (getLeaderboard, getStanding)               | Task 6        |
| Controller (7 handlers)                                              | Task 8        |
| Content-API routes (4) + Admin routes (3)                            | Task 9        |
| Admin panel (Overview, Event Log, Manual Award tabs)                 | Task 10       |
| user-profile schema additions (5 fields)                             | Task 3        |
| content-moderation integration                                       | Task 11       |
| Frontend API proxies (/api/leaderboard, /standing)                   | Task 13       |
| ContributeCommunitySection                                           | Task 14       |
| Community page (/contribute/community)                               | Task 15       |
| Profile OverviewTab update                                           | Task 16       |
| Contribute nav-bar                                                   | Task 17       |
| Documentation                                                        | Task 18       |
| UserProfile TypeScript type                                          | Task 12       |
| Plugin registered in config/plugins.ts                               | Task 1 step 4 |

**Gaps identified and resolved:**

- The spec mentions a "Reports" tab (Tab 4) with bar charts. This is deferred — the Manual Award tab covers the core admin need. Charts require a charting library not yet in the Strapi admin build and are out of scope for this initial plan.
- `globetrotter` badge (contributions to 5+ distinct countries) requires country-level metadata on point events. The `metadata` JSON field supports storing `country` but the check function needs cross-event aggregation. This badge is omitted from `BADGE_DEFINITIONS` in Task 5 — it can be added as a follow-on task once the metadata convention is established.

**Type consistency verified:**

- `PointAction` enum defined in `points.ts` Task 4 matches the schema enum in `point-event/schema.json` Task 2.
- `computeTier()` exported from `points.ts` and imported in `leaderboard.ts` — same function, no duplication.
- `LeaderboardEntry` type defined in `leaderboard.ts` and re-used as an import in `ContributeCommunitySection.tsx` and `community/page.tsx`.
- `Standing` type defined in `leaderboard.ts` and mirrored inline in `community/page.tsx` (acceptable — the page is RSC-only and the type is simple).
- `strapi.db.connection` table names (`rw_point_events`, `user_profiles`) match the `collectionName` values in the schemas.
- `strapi.documents("plugin::rewards.point-event")` and `strapi.documents("plugin::rewards.badge-award")` match the plugin name `"rewards"` and content-type singular names `"point-event"` / `"badge-award"`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-community-rewards.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
