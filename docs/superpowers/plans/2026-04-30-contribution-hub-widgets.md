# Contribution Hub Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personalised Welcome Back banner and a Quick Wins carousel to the authenticated contribution hub page, powered by pre-computed suggestions stored as a Strapi repeatable component on the user profile.

**Architecture:** A `contribute.quick-win` Strapi component is added as a repeatable field on `user-profile`. A new `quick-wins` service runs 5 data-gap rules in parallel and writes up to 20 wins back via Document Service. A cron job refreshes wins every 4 hours for active users. Two new Next.js server components render the banner and carousel below the existing hero, using DS `Card`, `Badge`, and `SectionHeader` primitives.

**Tech Stack:** Strapi v5 (Document Service, db.query, config/cron-tasks.ts), Next.js 15 App Router (RSC + `"use client"` carousel), Tailwind CSS v4, `T` design tokens, `@iconify/react`.

---

## Context for implementers

**Strapi is at** `apps/strapi/` — TypeScript, no test framework. Verify changes with `cd apps/strapi && npx tsc --noEmit`.

**Next.js UI is at** `apps/ui/` — TypeScript strict. Verify with `cd apps/ui && npx tsc --noEmit`.

**Key patterns:**

- Strapi service files in `src/api/{name}/services/` are auto-registered as `api::{name}.{filename}`
- `strapi.db.query(uid).findOne/findMany` for low-level reads; `strapi.documents(uid).update(...)` for writes that include repeatable components
- All Strapi → Next.js calls use `X-Service-Secret` header from `process.env.STRAPI_BRIDGE_SECRET`
- Design tokens are in `@/lib/design-tokens` exported as `T`
- DS primitives are in `@/components/ds` — use `Card`, `Badge`, `SectionHeader`, `Eyebrow`

**Existing files that will be modified:**

- `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json` — add `quickWins` + `quickWinsComputedAt`
- `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts` — add `getCountryRank`, extend `Standing` + `getStanding`
- `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` — invalidate wins on approval
- `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` — add `computeQuickWins` handler
- `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts` — register new route
- `apps/strapi/config/cron-tasks.ts` — add `quickWinsRefresh` job
- `apps/ui/src/lib/types/profile.ts` — add `QuickWin`, `ContributingStanding`
- `apps/ui/src/app/[locale]/contribute/page.tsx` — fetch + render widgets

---

## Task 1: Create `contribute.quick-win` Strapi component + update user-profile schema

**Files:**

- Create: `apps/strapi/src/components/contribute/quick-win.json`
- Modify: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`

- [ ] **Step 1: Create the components/contribute directory and component schema**

```bash
mkdir -p apps/strapi/src/components/contribute
```

Create `apps/strapi/src/components/contribute/quick-win.json`:

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

- [ ] **Step 2: Add `quickWins` and `quickWinsComputedAt` to user-profile schema**

In `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`, add two fields at the end of `"attributes"`, before the closing `}`:

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

The full closing of the attributes object becomes:

```json
    "lastActivityDate": { "type": "string" },
    "quickWins": {
      "type": "component",
      "component": "contribute.quick-win",
      "repeatable": true
    },
    "quickWinsComputedAt": {
      "type": "datetime"
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/components/contribute/quick-win.json \
        apps/strapi/src/api/user-profile/content-types/user-profile/schema.json
git commit -m "feat(strapi): add contribute.quick-win component + user-profile schema fields"
```

---

## Task 2: Implement the quick-wins service

**Files:**

- Create: `apps/strapi/src/api/user-profile/services/quick-wins.ts`

This service is auto-registered as `api::user-profile.quick-wins` because it lives in the `services/` directory of the `user-profile` API.

- [ ] **Step 1: Create the service file**

Create `apps/strapi/src/api/user-profile/services/quick-wins.ts`:

```ts
type QuickWin = {
  winId: string
  type:
    | "add_library"
    | "add_nearby_library"
    | "verify_hours"
    | "add_hero_image"
    | "translate_wiki"
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

export default ({ strapi }: { strapi: any }) => ({
  // ── Public API ────────────────────────────────────────────────────────────

  async computeAndSave(baUserId: string): Promise<void> {
    const wins = await (this as any).computeForUser(baUserId)

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) return

    await strapi.documents("api::user-profile.user-profile" as any).update({
      documentId: profile.documentId,
      data: {
        quickWins: wins,
        quickWinsComputedAt: new Date(),
      },
    })
  },

  async computeForUser(baUserId: string): Promise<QuickWin[]> {
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, populate: { languages: true } })

    if (!profile) return []

    const [libraryWins, nearbyWins, hoursWins, imageWins, wikiWins] =
      await Promise.all([
        (this as any).ruleAddLibrary(profile),
        (this as any).ruleAddNearbyLibrary(profile),
        (this as any).ruleVerifyHours(profile),
        (this as any).ruleAddHeroImage(profile),
        (this as any).ruleTranslateWiki(profile),
      ])

    const all: QuickWin[] = [
      ...libraryWins,
      ...nearbyWins,
      ...hoursWins,
      ...imageWins,
      ...wikiWins,
    ]

    // Deduplicate by winId
    const seen = new Set<string>()
    const deduped = all.filter((w) => {
      if (seen.has(w.winId)) return false
      seen.add(w.winId)
      return true
    })

    // Sort: profile country match first → higher points → shorter time
    const profileCountry = profile.country ?? null
    deduped.sort((a, b) => {
      const aMatch = a.computedForCountry === profileCountry ? 1 : 0
      const bMatch = b.computedForCountry === profileCountry ? 1 : 0
      if (bMatch !== aMatch) return bMatch - aMatch
      if (b.points !== a.points) return b.points - a.points
      return a.estimatedMinutes - b.estimatedMinutes
    })

    return deduped.slice(0, 20)
  },

  // ── Rules ─────────────────────────────────────────────────────────────────

  async ruleAddLibrary(profile: any): Promise<QuickWin[]> {
    const wins: QuickWin[] = []

    if (profile.country) {
      // Find matching country doc
      const countryDoc = await strapi.db.query("api::country.country").findOne({
        where: { name: { $containsi: profile.country } },
      })

      if (countryDoc) {
        const count = await strapi.db.query("api::library.library").count({
          where: {
            country: { id: countryDoc.id },
            publishedAt: { $ne: null },
          },
        })
        if (count < 50) {
          wins.push({
            winId: `add_library-${profile.country.toLowerCase().replace(/\s+/g, "-")}`,
            type: "add_library",
            title: `Add a library in ${countryDoc.name}`,
            description: `${countryDoc.name} has only ${count} ${count === 1 ? "library" : "libraries"} in the index. Add one you know.`,
            points: 50,
            estimatedMinutes: 10,
            rewardLabel: "CARTOGRAPHER",
            actionUrl: "/contribute/add",
            computedForCountry: profile.country,
          })
        }
      }
    }

    // Always add a generic global win as fallback
    wins.push({
      winId: "add_library-global",
      type: "add_library",
      title: "Add a missing library",
      description:
        "Know a library that isn't in the atlas? Add it and earn 50 points.",
      points: 50,
      estimatedMinutes: 10,
      rewardLabel: "CARTOGRAPHER",
      actionUrl: "/contribute/add",
    })

    return wins
  },

  async ruleAddNearbyLibrary(profile: any): Promise<QuickWin[]> {
    if (!profile.city) return []

    // Find published libraries in the same city
    const libraries = await strapi.db.query("api::library.library").findMany({
      where: {
        city: { $containsi: profile.city },
        publishedAt: { $ne: null },
      },
      limit: 3,
      select: ["id", "name", "slug", "entityRef", "city"],
    })

    return libraries.map((lib: any) => ({
      winId: `add_nearby_library-${lib.entityRef ?? lib.slug}`,
      type: "add_nearby_library" as const,
      title: `Add a branch near ${lib.name}`,
      description: `${lib.name} in ${lib.city} may have branches not yet in the atlas. Add one you know.`,
      points: 12,
      estimatedMinutes: 2,
      rewardLabel: "PIN",
      actionUrl: "/contribute/add",
      targetEntityRef: lib.entityRef ?? undefined,
      computedForCountry: profile.country ?? undefined,
    }))
  },

  async ruleVerifyHours(profile: any): Promise<QuickWin[]> {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    const where: Record<string, unknown> = {
      publishedAt: { $ne: null },
      $or: [
        { lastVerifiedAt: { $lt: cutoff.toISOString() } },
        { lastVerifiedAt: { $null: true } },
      ],
    }

    // Try country-filtered first
    if (profile.country) {
      const countryDoc = await strapi.db
        .query("api::country.country")
        .findOne({ where: { name: { $containsi: profile.country } } })
      if (countryDoc) {
        where.country = { id: countryDoc.id }
      }
    }

    const libraries = await strapi.db.query("api::library.library").findMany({
      where,
      orderBy: { lastVerifiedAt: "asc" },
      limit: 4,
      select: ["id", "name", "slug", "entityRef", "lastVerifiedAt"],
    })

    return libraries.map((lib: any) => {
      const monthsAgo = lib.lastVerifiedAt
        ? Math.floor(
            (Date.now() - new Date(lib.lastVerifiedAt).getTime()) /
              (30 * 24 * 60 * 60 * 1000)
          )
        : null
      const ageText = monthsAgo
        ? `Last verified ${monthsAgo} month${monthsAgo === 1 ? "" : "s"} ago.`
        : "Never verified."

      return {
        winId: `verify_hours-${lib.entityRef ?? lib.slug}`,
        type: "verify_hours" as const,
        title: `Confirm hours · ${lib.name}`,
        description: `${ageText} Has anything changed?`,
        points: 5,
        estimatedMinutes: 1,
        rewardLabel: "VERIFIER",
        actionUrl: `/contribute/edit/${lib.slug}`,
        targetEntityRef: lib.entityRef ?? undefined,
        computedForCountry: profile.country ?? undefined,
      }
    })
  },

  async ruleAddHeroImage(profile: any): Promise<QuickWin[]> {
    const where: Record<string, unknown> = {
      publishedAt: { $ne: null },
      heroImage: { $null: true },
    }

    if (profile.country) {
      const countryDoc = await strapi.db
        .query("api::country.country")
        .findOne({ where: { name: { $containsi: profile.country } } })
      if (countryDoc) {
        where.country = { id: countryDoc.id }
      }
    }

    const libraries = await strapi.db.query("api::library.library").findMany({
      where,
      limit: 3,
      select: ["id", "name", "slug", "entityRef"],
    })

    return libraries.map((lib: any) => ({
      winId: `add_hero_image-${lib.entityRef ?? lib.slug}`,
      type: "add_hero_image" as const,
      title: `Add a hero image`,
      description: `${lib.name} has no photography in the atlas yet.`,
      points: 8,
      estimatedMinutes: 3,
      rewardLabel: "PHOTOGRAPHER",
      actionUrl: `/contribute/edit/${lib.slug}`,
      targetEntityRef: lib.entityRef ?? undefined,
      computedForCountry: profile.country ?? undefined,
    }))
  },

  async ruleTranslateWiki(profile: any): Promise<QuickWin[]> {
    const languages: { code: string }[] = Array.isArray(profile.languages)
      ? profile.languages
      : []
    if (languages.length === 0) return []

    const wins: QuickWin[] = []

    for (const lang of languages.slice(0, 3)) {
      // Find wiki articles that don't have a localisation for this language
      // Query articles in English that are missing the target locale
      try {
        const articles = await strapi.db
          .query("api::wiki-article.wiki-article")
          .findMany({
            where: {
              publishedAt: { $ne: null },
              locale: "en",
            },
            limit: 2,
            select: ["id", "documentId", "title", "slug"],
          })

        for (const article of articles) {
          // Check if a localisation exists for this language
          const localised = await strapi.db
            .query("api::wiki-article.wiki-article")
            .findOne({
              where: { documentId: article.documentId, locale: lang.code },
            })

          if (!localised) {
            wins.push({
              winId: `translate_wiki-${article.slug}-${lang.code}`,
              type: "translate_wiki",
              title: `Translate one wiki page`,
              description: `"${article.title}" is missing ${lang.code.toUpperCase()}. You're a marked native reviewer.`,
              points: 15,
              estimatedMinutes: 5,
              rewardLabel: "TRANSLATOR",
              actionUrl: `/contribute/wiki/${article.slug}`,
              targetSlug: article.slug,
              computedForLanguage: lang.code,
            })
            break // one win per language
          }
        }
      } catch {
        // wiki-article content type may not exist — skip silently
      }
    }

    return wins
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/api/user-profile/services/quick-wins.ts
git commit -m "feat(strapi): add quick-wins service with 5 personalised rules"
```

---

## Task 3: Extend leaderboard service with country rank

**Files:**

- Modify: `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`

- [ ] **Step 1: Add `countryRank` and `country` to the `Standing` type**

In `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts`, find the `Standing` type definition (around line 20) and add two fields:

```ts
export type Standing = {
  globalRank: number | null
  countryRank: number | null
  country: string | null
  tier: TierInfo
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}
```

- [ ] **Step 2: Add `getCountryRank` method**

At the end of the exported service object (before the final `}`), add:

```ts
  async getCountryRank(
    baUserId: string,
    country: string
  ): Promise<number | null> {
    if (!country) return null

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) return null

    const result = (await strapi.db.connection
      .count({ count: "*" })
      .from("user_profiles")
      .where("country", country)
      .where("points", ">", profile.points ?? 0)) as { count: string }[]

    return Number(result[0]?.count ?? 0) + 1
  },
```

- [ ] **Step 3: Extend `getStanding` to also fetch and return country rank**

In `getStanding`, the profile query currently only fetches `{ points, pointsThisMonth, tier, streak }`. Replace that type annotation (around line 113) to also include `country`:

```ts
const profile = (await strapi.db
  .query("api::user-profile.user-profile")
  .findOne({ where: { baUserId } })) as {
  points: number
  pointsThisMonth: number
  tier: string
  streak: number
  country: string | null
} | null
```

Then in the early-return block (when `!profile`), update to include the new fields:

```ts
if (!profile) {
  return {
    globalRank: null,
    countryRank: null,
    country: null,
    tier: computeTier(0),
    streak: 0,
    totalPoints: 0,
    pointsThisMonth: 0,
    recentBadges: [],
    suggestedAction: "Make your first contribution to start earning points.",
  }
}
```

Then before the final `return` in `getStanding`, add the country rank computation:

```ts
const countryRank = profile.country
  ? await (this as any).getCountryRank(baUserId, profile.country)
  : null
```

And update the final return to include it:

```ts
return {
  globalRank,
  countryRank,
  country: profile.country ?? null,
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/rewards/server/services/leaderboard.ts
git commit -m "feat(strapi): add countryRank to leaderboard standing"
```

---

## Task 4: Cron job + auth-bridge compute endpoint + invalidation hooks

**Files:**

- Modify: `apps/strapi/config/cron-tasks.ts`
- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`
- Modify: `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`

- [ ] **Step 1: Add cron job to `config/cron-tasks.ts`**

Replace the full contents of `apps/strapi/config/cron-tasks.ts` with:

```ts
// https://docs.strapi.io/dev-docs/configurations/cron

const sayHelloJob = {
  task: ({ strapi }: { strapi: any }) => {
    console.warn("A beautiful start to the week!")
  },
  options: {
    rule: "0 0 1 * * 1",
  },
}

const quickWinsRefreshJob = {
  task: async ({ strapi }: { strapi: any }) => {
    strapi.log.info("[quick-wins] Starting refresh for active users")
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const profiles = await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({
        where: {
          lastActivityDate: { $gte: cutoff.toISOString().slice(0, 10) },
        },
        select: ["baUserId"],
      })

    strapi.log.info(`[quick-wins] Refreshing wins for ${profiles.length} users`)

    for (let i = 0; i < profiles.length; i += 50) {
      const batch = profiles.slice(i, i + 50)
      await Promise.all(
        batch.map((p: { baUserId: string }) =>
          strapi
            .service("api::user-profile.quick-wins")
            .computeAndSave(p.baUserId)
            .catch((err: unknown) =>
              strapi.log.warn(`[quick-wins] Failed for ${p.baUserId}:`, err)
            )
        )
      )
    }

    strapi.log.info("[quick-wins] Refresh complete")
  },
  options: {
    rule: "0 */4 * * *",
  },
}

export default {
  sayHelloJob,
  quickWinsRefreshJob,
}
```

- [ ] **Step 2: Add `computeQuickWins` handler to auth-bridge controller**

In `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`, add at the end of the exported object (before the final `}`):

```ts
  async computeQuickWins(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId } = ctx.request.body as { baUserId?: string }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    try {
      await strapi
        .service("api::user-profile.quick-wins")
        .computeAndSave(baUserId)
    } catch (err) {
      strapi.log.warn("[quick-wins] computeAndSave failed:", err)
    }

    return ctx.send({ ok: true })
  },
```

- [ ] **Step 3: Register the route in auth-bridge routes**

In `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`, add the following entry to the `routes` array (after the last existing route):

```ts
    {
      method: "POST",
      path: "/auth-bridge/compute-quick-wins",
      handler: "auth-bridge.computeQuickWins",
      config: { auth: false, policies: [], middlewares: [] },
    },
```

- [ ] **Step 4: Add invalidation in `upsertProfile` when country or languages change**

In `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`, in the `upsertProfile` handler, after the `await (existing ? ... : ...)` update block (around line 169), add:

```ts
// Recompute quick wins if personalisation fields changed
if (baUserId && ("country" in data || "languages" in data)) {
  strapi
    .service("api::user-profile.quick-wins")
    .computeAndSave(baUserId)
    .catch((err: unknown) =>
      strapi.log.warn("[quick-wins] upsertProfile recompute failed:", err)
    )
}
```

- [ ] **Step 5: Add invalidation call in submission approval**

In `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`, find the block that awards points for `new_library` approval (around line 297). After the existing try/catch block that calls `rewards.award`, add:

```ts
// Invalidate quick wins for the submitter after approval
if (status === "approved" && submission?.submittedByUserId) {
  try {
    await strapi
      .service("api::user-profile.quick-wins")
      .computeAndSave(submission.submittedByUserId)
  } catch (err) {
    strapi.log.warn("[quick-wins] Post-approval recompute failed:", err)
  }
}
```

Place this block after the final rewards try/catch (around line 363), just before `return updated`.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 7: Commit**

```bash
git add apps/strapi/config/cron-tasks.ts \
        apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts \
        apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts \
        apps/strapi/src/plugins/content-moderation/server/services/submission.ts
git commit -m "feat(strapi): add quick-wins cron job, compute endpoint, and invalidation hooks"
```

---

## Task 5: Frontend TypeScript types

**Files:**

- Modify: `apps/ui/src/lib/types/profile.ts`

- [ ] **Step 1: Add `QuickWin` and `ContributingStanding` types**

In `apps/ui/src/lib/types/profile.ts`, append to the end of the file:

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

export type TierInfo = {
  level: number
  name: string
  nextName: string | null
  nextThreshold: number | null
  progressPercent: number
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/types/profile.ts
git commit -m "feat(ui): add QuickWin and ContributingStanding TypeScript types"
```

---

## Task 6: Build `TierProgressRing` SVG component

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/_components/TierProgressRing.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/app/[locale]/contribute/_components/TierProgressRing.tsx`:

```tsx
import { T } from "@/lib/design-tokens"

const SIZE = 72
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TierProgressRing({
  percent,
  label,
}: {
  readonly percent: number
  readonly label: string
}) {
  const filled = CIRCUMFERENCE * (1 - percent / 100)

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ flexShrink: 0 }}
      aria-label={`${percent}% progress to next tier`}
      role="img"
    >
      {/* Track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={T.ink.ghost}
        strokeWidth={STROKE}
      />
      {/* Progress arc */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={T.accent.violet}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={filled}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
      {/* Centre label */}
      <text
        x={SIZE / 2}
        y={SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: T.font.mono,
          fontSize: "13px",
          fill: T.ink.base,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </text>
    </svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/\[locale\]/contribute/_components/TierProgressRing.tsx
git commit -m "feat(ui): add TierProgressRing SVG component"
```

---

## Task 7: Build `WelcomeBackWidget` component

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/_components/WelcomeBackWidget.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/app/[locale]/contribute/_components/WelcomeBackWidget.tsx`:

```tsx
import { Card } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { ContributingStanding } from "@/lib/types/profile"

import { TierProgressRing } from "./TierProgressRing"

export function WelcomeBackWidget({
  standing,
}: {
  readonly standing: ContributingStanding
}) {
  const {
    firstName,
    streak,
    globalRank,
    countryRank,
    country,
    tier,
    totalPoints,
    pointsToNext,
    nextTierName,
    pendingSubmissions,
  } = standing

  const rankText =
    globalRank != null
      ? countryRank != null && country
        ? `ranked #${globalRank} globally / #${countryRank} in ${country}`
        : `ranked #${globalRank} globally`
      : null

  const pendingText =
    pendingSubmissions > 0
      ? `${pendingSubmissions} ${pendingSubmissions === 1 ? "submission" : "submissions"} awaiting review. `
      : ""

  const nextTierText =
    pointsToNext != null && nextTierName
      ? `You're ${pointsToNext} pts away from `
      : null

  return (
    <Card
      style={{
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
      }}
    >
      {/* Left: text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.1rem, 2vw, 1.4rem)",
            fontWeight: 600,
            color: T.ink.base,
            margin: "0 0 8px",
            lineHeight: 1.25,
          }}
        >
          Welcome back,{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 400,
              color: T.accent.aurora,
            }}
          >
            {firstName}
          </em>
          .{" "}
          {streak > 0 && (
            <>
              You&apos;re on a{" "}
              <strong style={{ color: T.ink.base }}>{streak}-day streak</strong>
              {rankText && (
                <>
                  {" "}
                  and <strong style={{ color: T.ink.base }}>{rankText}</strong>
                </>
              )}
              .
            </>
          )}
        </h2>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {pendingText}
          {nextTierText && (
            <>
              {nextTierText}
              <strong
                style={{
                  color: T.ink.base,
                  fontFamily: T.font.mono,
                  fontSize: "12px",
                  letterSpacing: ".06em",
                }}
              >
                {nextTierName} · tier {tier.level + 1}
              </strong>
              .
            </>
          )}
        </p>
      </div>

      {/* Right: tier ring */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <TierProgressRing
          percent={tier.progressPercent}
          label={`${tier.progressPercent}%`}
        />
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.dim,
              margin: "0 0 2px",
            }}
          >
            To next tier
          </p>
          {tier.nextThreshold != null && (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.low,
                margin: 0,
                letterSpacing: ".04em",
              }}
            >
              {totalPoints.toLocaleString()} /{" "}
              {tier.nextThreshold.toLocaleString()} pts
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/\[locale\]/contribute/_components/WelcomeBackWidget.tsx
git commit -m "feat(ui): add WelcomeBackWidget component"
```

---

## Task 8: Build `QuickWinCard` component

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/_components/QuickWinCard.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/app/[locale]/contribute/_components/QuickWinCard.tsx`:

```tsx
import { Icon } from "@iconify/react"

import { Badge, Card } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { QuickWin, QuickWinType } from "@/lib/types/profile"

const ICON_MAP: Record<QuickWinType, { icon: string; color: string }> = {
  add_library: { icon: "mdi:plus-box", color: T.accent.ember },
  add_nearby_library: { icon: "mdi:plus-box", color: T.accent.ember },
  verify_hours: { icon: "mdi:text-box-outline", color: T.accent.aurora },
  add_hero_image: { icon: "mdi:image-outline", color: T.accent.violet },
  translate_wiki: { icon: "mdi:translate", color: T.accent.ok },
}

const CTA_LABEL: Record<QuickWinType, string> = {
  add_library: "BEGIN →",
  add_nearby_library: "BEGIN →",
  verify_hours: "VERIFY →",
  add_hero_image: "ATTACH →",
  translate_wiki: "OPEN →",
}

export function QuickWinCard({ win }: { readonly win: QuickWin }) {
  const { icon, color } = ICON_MAP[win.type]
  const ctaLabel = CTA_LABEL[win.type]

  return (
    <Card
      as="article"
      hover
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        height: "100%",
        cursor: "pointer",
      }}
      className="hover:border-white/14"
    >
      {/* Top row: icon + meta */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: `${color}14`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon icon={icon} width={18} style={{ color }} />
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          +{win.points} PTS · ~{win.estimatedMinutes} MIN
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontFamily: T.font.serif,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
            margin: "0 0 6px",
            lineHeight: 1.3,
          }}
        >
          {win.title}
        </h3>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "12px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.65,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {win.description}
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "12px",
          borderTop: `1px solid ${T.border.line}`,
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            REWARD ·
          </span>
          <Badge label={win.rewardLabel} color="dim" />
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            · {win.points} PTS
          </span>
        </div>
        <Link
          href={win.actionUrl}
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/\[locale\]/contribute/_components/QuickWinCard.tsx
git commit -m "feat(ui): add QuickWinCard component"
```

---

## Task 9: Build `QuickWinsCarousel` client component

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/_components/QuickWinsCarousel.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/app/[locale]/contribute/_components/QuickWinsCarousel.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { QuickWin } from "@/lib/types/profile"

import { QuickWinCard } from "./QuickWinCard"

const PAGE_SIZE = 4

export function QuickWinsCarousel({ wins }: { readonly wins: QuickWin[] }) {
  const [page, setPage] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const totalPages = Math.ceil(wins.length / PAGE_SIZE)

  const prev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const next = useCallback(
    () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    [totalPages]
  )

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    el.addEventListener("keydown", handler)
    return () => el.removeEventListener("keydown", handler)
  }, [prev, next])

  const visibleWins = wins.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div ref={containerRef} tabIndex={-1} style={{ outline: "none" }}>
      {/* Counter + arrows */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Curated for you · {page + 1} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["←", "→"] as const).map((arrow, i) => {
            const disabled = i === 0 ? page === 0 : page >= totalPages - 1
            return (
              <button
                key={arrow}
                onClick={i === 0 ? prev : next}
                disabled={disabled}
                aria-label={i === 0 ? "Previous page" : "Next page"}
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: `1px solid ${T.border.line}`,
                  background: T.bg.deep,
                  color: disabled ? T.ink.ghost : T.ink.dim,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontFamily: T.font.sans,
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color 150ms, border-color 150ms",
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                {arrow}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards grid */}
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        style={{ alignItems: "stretch" }}
      >
        {visibleWins.map((win) => (
          <QuickWinCard key={win.winId} win={win} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/\[locale\]/contribute/_components/QuickWinsCarousel.tsx
git commit -m "feat(ui): add QuickWinsCarousel client component"
```

---

## Task 10: Build `QuickWinsSection` wrapper

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/_components/QuickWinsSection.tsx`

- [ ] **Step 1: Create the component**

Create `apps/ui/src/app/[locale]/contribute/_components/QuickWinsSection.tsx`:

```tsx
import { T } from "@/lib/design-tokens"
import type { QuickWin } from "@/lib/types/profile"

import { QuickWinsCarousel } from "./QuickWinsCarousel"

export function QuickWinsSection({ wins }: { readonly wins: QuickWin[] }) {
  return (
    <section style={{ padding: "48px 0 0" }}>
      <div className="mx-auto w-full max-w-5xl px-6 md:px-10">
        {/* Section heading */}
        <div style={{ marginBottom: "28px" }}>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: T.ink.base,
              margin: 0,
            }}
          >
            Quick{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: T.accent.aurora,
              }}
            >
              wins
            </em>
            .
          </h2>
        </div>

        {/* Carousel (client) */}
        <QuickWinsCarousel wins={wins} />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/\[locale\]/contribute/_components/QuickWinsSection.tsx
git commit -m "feat(ui): add QuickWinsSection wrapper component"
```

---

## Task 11: Add Next.js API routes for standing and quick wins

**Files:**

- Create: `apps/ui/src/app/api/contribute/standing/route.ts`
- Create: `apps/ui/src/app/api/contribute/quick-wins/route.ts`

These routes are for future client-side refresh (e.g. refetch on window focus). The contribute page itself calls Strapi directly server-side.

- [ ] **Step 1: Create `/api/contribute/standing` route**

Create `apps/ui/src/app/api/contribute/standing/route.ts`:

```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""

export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Ba-User-Id": baUserId,
        "X-Service-Secret": SECRET,
      },
    })
    if (!res.ok)
      return NextResponse.json({ error: "Upstream error" }, { status: 502 })
    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `/api/contribute/quick-wins` route**

Create `apps/ui/src/app/api/contribute/quick-wins/route.ts`:

```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""
const READONLY_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY ?? ""
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&populate[quickWins]=true&fields[0]=quickWinsComputedAt`,
      {
        cache: "no-store",
        headers: READONLY_TOKEN
          ? { Authorization: `Bearer ${READONLY_TOKEN}` }
          : {},
      }
    )
    if (!res.ok) return NextResponse.json({ data: [], total: 0 })
    const json = (await res.json()) as {
      data?: { quickWins?: unknown[]; quickWinsComputedAt?: string }[]
    }
    const profile = json.data?.[0]
    const wins = profile?.quickWins ?? []
    const computedAt = profile?.quickWinsComputedAt ?? null

    // Fire-and-forget recompute if stale
    if (
      !computedAt ||
      Date.now() - new Date(computedAt).getTime() > FOUR_HOURS_MS
    ) {
      fetch(`${STRAPI}/api/auth-bridge/compute-quick-wins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": SECRET,
        },
        body: JSON.stringify({ baUserId }),
      }).catch(() => {})
    }

    return NextResponse.json({ data: wins, total: wins.length, computedAt })
  } catch {
    return NextResponse.json({ data: [], total: 0, computedAt: null })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/app/api/contribute/standing/route.ts \
        apps/ui/src/app/api/contribute/quick-wins/route.ts
git commit -m "feat(ui): add /api/contribute/standing and /api/contribute/quick-wins routes"
```

---

## Task 12: Wire up `contribute/page.tsx` with server-side fetches and widget rendering

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/page.tsx`

- [ ] **Step 1: Add two server-side fetch helpers to `contribute/page.tsx`**

In `apps/ui/src/app/[locale]/contribute/page.tsx`, add the following imports at the top (after existing imports):

```ts
import type {
  ContributingStanding,
  QuickWin,
  TierInfo,
} from "@/lib/types/profile"
import { WelcomeBackWidget } from "./_components/WelcomeBackWidget"
import { QuickWinsSection } from "./_components/QuickWinsSection"
```

Then add two new fetch functions after the existing `fetchProfileRole` function:

```ts
async function fetchStanding(
  baUserId: string
): Promise<ContributingStanding | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  if (!secret) return null
  try {
    const res = await fetch(`${strapi}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Ba-User-Id": baUserId,
        "X-Service-Secret": secret,
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: {
        globalRank?: number | null
        countryRank?: number | null
        country?: string | null
        tier?: TierInfo
        streak?: number
        totalPoints?: number
        pointsThisMonth?: number
        suggestedAction?: string
      }
    }
    const d = json.data
    if (!d) return null

    const tier = d.tier ?? {
      level: 1,
      name: "Reader",
      nextName: "Indexer",
      nextThreshold: 100,
      progressPercent: 0,
    }
    const pointsToNext =
      tier.nextThreshold != null
        ? tier.nextThreshold - (d.totalPoints ?? 0)
        : null

    // Fetch pending submission count
    const subRes = await fetch(
      `${strapi}/api/content-moderation/submissions/my`,
      {
        cache: "no-store",
        headers: {
          "X-Service-Secret": secret,
          "X-Ba-User-Id": baUserId,
          "X-Ba-User-Email": "",
        },
      }
    )
    let pendingSubmissions = 0
    if (subRes.ok) {
      const subJson = (await subRes.json()) as { data?: { status?: string }[] }
      pendingSubmissions = (subJson.data ?? []).filter(
        (s) => s.status === "pending" || s.status === "needs_info"
      ).length
    }

    return {
      firstName: "", // filled below from profile
      streak: d.streak ?? 0,
      globalRank: d.globalRank ?? null,
      countryRank: d.countryRank ?? null,
      country: d.country ?? null,
      tier,
      totalPoints: d.totalPoints ?? 0,
      pointsToNext: pointsToNext != null ? Math.max(0, pointsToNext) : null,
      nextTierName: tier.nextName,
      pendingSubmissions,
    }
  } catch {
    return null
  }
}

async function fetchQuickWins(baUserId: string): Promise<QuickWin[]> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapi}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&populate[quickWins]=true&fields[0]=quickWinsComputedAt&fields[1]=firstName`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        quickWins?: QuickWin[]
        quickWinsComputedAt?: string
        firstName?: string
      }[]
    }
    return json.data?.[0]?.quickWins ?? []
  } catch {
    return []
  }
}

async function fetchFirstName(baUserId: string): Promise<string> {
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapi}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=firstName`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return ""
    const json = (await res.json()) as { data?: { firstName?: string }[] }
    return json.data?.[0]?.firstName ?? ""
  } catch {
    return ""
  }
}
```

- [ ] **Step 2: Update `ContributePage` to fetch and pass new data**

Replace the `ContributePage` function with:

```tsx
export default async function ContributePage() {
  const session = await getSessionSSR(await headers())

  const [
    libraryCount,
    roleData,
    submissionStats,
    standing,
    quickWins,
    firstName,
  ] = await Promise.all([
    fetchLibraryCount(),
    session?.user
      ? fetchProfileRole(session.user.id)
      : Promise.resolve({ isVerifiedLibrarian: false }),
    session?.user
      ? fetchMySubmissionStats(session.user.id)
      : Promise.resolve(null),
    session?.user ? fetchStanding(session.user.id) : Promise.resolve(null),
    session?.user ? fetchQuickWins(session.user.id) : Promise.resolve([]),
    session?.user ? fetchFirstName(session.user.id) : Promise.resolve(""),
  ])

  const heroStats = {
    libraryCount,
    ...(submissionStats
      ? {
          myPending: submissionStats.pending,
          myApproved: submissionStats.approved,
          myTotal: submissionStats.total,
        }
      : {}),
  }

  // Attach firstName to standing
  const standingWithName: typeof standing = standing
    ? { ...standing, firstName: firstName || "Contributor" }
    : null

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeHeroSection stats={heroStats} isSignedIn={!!session?.user} />
      {session?.user && standingWithName && (
        <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
          <WelcomeBackWidget standing={standingWithName} />
        </div>
      )}
      {session?.user && quickWins.length > 0 && (
        <QuickWinsSection wins={quickWins} />
      )}
      <ContributeNavBar />
      <ContributePathCards
        isSignedIn={!!session?.user}
        isVerifiedLibrarian={roleData.isVerifiedLibrarian}
      />
      <ContributeGuidelinesSection />
      <ContributeCommunitySection />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: `TypeScript: No errors found`

- [ ] **Step 4: Smoke test — start the dev server and visit `/contribute` while signed in**

```bash
cd apps/ui && pnpm dev
```

Open `http://localhost:3000/en/contribute` while signed in. You should see:

- The existing hero section unchanged
- Below the hero: `WelcomeBackWidget` card with your name, streak, rank, and tier ring
- Below that: `QuickWinsSection` with cards (may show "Add a missing library" global win initially, more after cron runs)
- Page nav bar below the widgets

If quick wins are empty (no pre-computed data yet), trigger a one-off compute by calling the bridge route:

```bash
curl -X POST http://127.0.0.1:1337/api/auth-bridge/compute-quick-wins \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: <your-bridge-secret>" \
  -d '{"baUserId":"<your-ba-user-id>"}'
```

Then refresh the page.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/app/\[locale\]/contribute/page.tsx
git commit -m "feat(ui): wire WelcomeBackWidget and QuickWinsSection into contribute hub"
```
