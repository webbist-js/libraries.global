# Drives Groundwork (Band 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the groundwork drives need. That means one gap registry that every surface derives from, a "Still right?" verify action, the search-index fields drives filter on, scoring for record corrections, and exact region gap stats.

**Architecture:**

- A pure registry, `packages/shared-data/gaps.ts`, defines each Gap once.
  - Strapi computes `completeness` and a new stored `gaps` array from it whenever a library is written.
  - The Meilisearch `needs` field becomes those stored gaps.
  - The UI's checklist, help panel, location pages and Find filter all read the same registry.
- Verification is a new `correction` kind (`verify`). Applying it stamps a new `verifiedSections` map on the library. An approved edit stamps the sections it sets. `lastVerifiedAt` becomes the latest of those stamps.
- The index gains the fields drives filter on.
- Region pages count gaps with Meilisearch facets instead of the first 100 records.

**Tech Stack:** TypeScript, Strapi v5 (Document Service, content-moderation and rewards plugins loaded from `dist/`), Meilisearch (`strapi-plugin-meilisearch` config in `apps/strapi/config/plugins.ts`), Next.js 16 RSC, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-noticeboard-and-drives-design.md` §3 (all), §9 "Location pages" (region stats from facets), §14 band 1. Decisions OD-3 (a confirmed "No" fills an accessibility question) and OD-5 (`lastVerifiedAt` is the latest per-section check) are accepted.

## Global Constraints

- Work on `dev` in the main tree. No worktrees. The only git write commands are `git add <files>` and `git commit`. Never stash, reset, checkout or restore.
- Strapi v5: read and write content with `strapi.documents()`. `strapi.db.query` is only for derived-field writes such as `completeness` and `gaps`, which are meant to skip the Change Records middleware.
- Restarting local Strapi and reseeding Meilisearch is allowed at any time.
  - Strapi runs `strapi develop`: saving a file under `apps/strapi/src` or `apps/strapi/config` reloads it.
  - Plugin code (`content-moderation`, `rewards`) loads from `dist/`. After changing it, run `pnpm --filter @repo/strapi build:plugins`, then `touch apps/strapi/src/index.ts` so Strapi reloads.
- `@repo/shared-data` is consumed from its built `dist/`. After changing it, run `pnpm --filter @repo/shared-data build` before the apps' tests or the dev servers can see the change.
- Pre-launch rules:
  - No new database migration files. New indexes go in `HOT_PATH_INDEXES` (`apps/strapi/database/migrations/shared/hot-path-index-sql.js`).
  - Local data is disposable.
  - Moved routes get no redirects.
- UI: colours and fonts come from `T`. Status is never shown by colour alone. Named exports only.
- The Strapi suite runs with `cd apps/strapi && npx vitest run`, and `npx tsc --noEmit` must be clean.
- The UI suite runs with `cd apps/ui && npx vitest run`. `npx tsc --noEmit` already shows two errors in `app/api/profile/me/prompts/__tests__/route.test.ts`; ignore those.
- Commits: conventional, scope `strapi`/`ui` where it's one app, header ≤ 100 chars, **no `Co-Authored-By` line**. The pre-commit hook runs `eslint --fix`; errors block it, warnings don't.
- Gap keys, exactly: `photo`, `hours`, `address`, `location`, `facilities`, `about`, `history`, `contact` (the eight completeness sections), plus `accessibility` and `services`.
- Verify sections, exactly: `hours`, `status`, `address`, `contact`.

---

### Task 1: The gap registry (`@repo/shared-data`)

**Files:**

- Create: `packages/shared-data/gaps.ts`
- Modify: `packages/shared-data/index.ts` (barrel export)
- Test: `apps/strapi/tests/gaps-registry.test.ts`

**Interfaces:**

- Produces, from `@repo/shared-data`:
  - `type GapKey`, `interface GapRecord`, `interface GapDefinition { key; label; phrase; completeness; filled(r) }`
  - `GAPS: readonly GapDefinition[]`, `GAP_KEYS: readonly GapKey[]`, `COMPLETENESS_GAP_KEYS: readonly GapKey[]`
  - `isGapKey(v: unknown): v is GapKey`, `gapDefinition(key: GapKey): GapDefinition`
  - `hasOpeningHours(openingTimes: unknown): boolean`
  - `gapsOf(r: GapRecord): GapKey[]`
  - `interface CompletenessSection { key: GapKey; label: string; filled: boolean }`
  - `completenessOf(r: GapRecord): { filled: number; total: number; percent: number; sections: CompletenessSection[] }`

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/gaps-registry.test.ts`:

```ts
import {
  COMPLETENESS_GAP_KEYS,
  completenessOf,
  GAP_KEYS,
  gapsOf,
  hasOpeningHours,
  isGapKey,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

const full = {
  heroImage: { id: 1 },
  openingTimes: hours,
  streetAddress: "96 Euston Road",
  location: { lat: 51.53, lng: -0.127 },
  accessibility: [{ id: 1 }],
  services: [{ id: 2 }],
  amenities: [],
  summary: "The national library of the UK.",
  foundedYear: "1973",
  website: "https://www.bl.uk",
}

describe("gap registry", () => {
  it("lists the ten keys, eight of them counted by completeness", () => {
    expect(GAP_KEYS).toEqual([
      "photo",
      "hours",
      "address",
      "location",
      "facilities",
      "about",
      "history",
      "contact",
      "accessibility",
      "services",
    ])
    expect(COMPLETENESS_GAP_KEYS).toEqual(GAP_KEYS.slice(0, 8))
    expect(isGapKey("hours")).toBe(true)
    expect(isGapKey("name")).toBe(false)
  })

  it("finds every gap in a bare record", () => {
    expect(gapsOf({})).toEqual(GAP_KEYS)
    expect(completenessOf({})).toMatchObject({
      filled: 0,
      total: 8,
      percent: 0,
    })
  })

  it("finds none in a full record", () => {
    expect(gapsOf(full)).toEqual([])
    expect(completenessOf(full).percent).toBe(100)
  })

  it("needs an enabled day with a whole timeframe for hours", () => {
    expect(hasOpeningHours(hours)).toBe(true)
    expect(
      hasOpeningHours({
        days: [{ day: "monday", enabled: false, timeframes: [] }],
      })
    ).toBe(false)
    expect(
      hasOpeningHours({
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: [{ startTime: "09:00", endTime: "" }],
          },
        ],
      })
    ).toBe(false)
    expect(hasOpeningHours(null)).toBe(false)
  })

  it("counts a confirmed No as an accessibility answer", () => {
    expect(gapsOf({ absentFacilities: ["Step-free entrance"] })).not.toContain(
      "accessibility"
    )
    // Wi-Fi is an amenity question, not an accessibility one.
    expect(gapsOf({ absentFacilities: ["Wi-Fi"] })).toContain("accessibility")
  })

  it("keeps facilities as any of accessibility, services or amenities", () => {
    const g = gapsOf({ amenities: [{ id: 3 }] })
    expect(g).not.toContain("facilities")
    expect(g).not.toContain("services")
    expect(g).toContain("accessibility")
  })

  it("scores completeness as the share of the eight sections", () => {
    // photo, hours, address, location filled: 4 of 8.
    expect(
      completenessOf({
        heroImage: { id: 1 },
        openingTimes: hours,
        streetAddress: "1 High St",
        location: { lat: 1, lng: 1 },
      })
    ).toMatchObject({ filled: 4, total: 8, percent: 50 })
    // Blank strings are not content.
    expect(completenessOf({ streetAddress: "  ", website: "" }).filled).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/strapi && npx vitest run tests/gaps-registry.test.ts`
Expected: FAIL. `GAP_KEYS` and the other exports aren't on `@repo/shared-data`.

- [ ] **Step 3: Write the registry**

`packages/shared-data/gaps.ts`:

```ts
// ── Gaps ──────────────────────────────────────────────────────────────────────
// The record sections a Library can lack: one definition for the stored
// completeness score, the search index's `needs`, the library page's
// checklist, location pages, Find libraries and drives. Eight count toward
// completeness; `accessibility` and `services` are the narrower gaps that
// filters and drives use.

import { FACILITY_CHECKLIST } from "./facility-checklist"

export type GapKey =
  | "photo"
  | "hours"
  | "address"
  | "location"
  | "facilities"
  | "about"
  | "history"
  | "contact"
  | "accessibility"
  | "services"

/** The library fields gaps read. Relations may be ids or full entries. */
export interface GapRecord {
  heroImage?: unknown
  openingTimes?: unknown
  streetAddress?: string | null
  location?: unknown
  accessibility?: unknown[] | null
  services?: unknown[] | null
  amenities?: unknown[] | null
  absentFacilities?: unknown
  summary?: string | null
  description?: unknown
  collectionStats?: unknown[] | null
  foundedYear?: string | null
  openedYear?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
}

export interface GapDefinition {
  key: GapKey
  /** Checklist and chip label. */
  label: string
  /** Lower-case phrase for sentences: "opening hours", "a photo". */
  phrase: string
  /** One of the eight sections the stored completeness score counts. */
  completeness: boolean
  /** True when the record has this section. */
  filled: (r: GapRecord) => boolean
}

const text = (v: unknown) => typeof v === "string" && v.trim() !== ""
const some = (v: unknown) => Array.isArray(v) && v.length > 0

/** An enabled day with at least one timeframe that has both ends. */
export function hasOpeningHours(openingTimes: unknown): boolean {
  const days = (openingTimes as { days?: unknown } | null | undefined)?.days
  if (!Array.isArray(days)) return false

  return days.some((d) => {
    const day = d as { enabled?: unknown; timeframes?: unknown } | null
    return (
      Boolean(day?.enabled) &&
      Array.isArray(day?.timeframes) &&
      day.timeframes.some((tf) => {
        const t = tf as { startTime?: unknown; endTime?: unknown } | null
        return text(t?.startTime) && text(t?.endTime)
      })
    )
  })
}

const ACCESSIBILITY_QUESTIONS: readonly string[] = FACILITY_CHECKLIST.filter(
  (c) => c.collection === "accessibility"
).map((c) => c.label)

/** A confirmed "No" to an accessibility question is an answer (OD-3). */
const answeredAccessibility = (absent: unknown) =>
  Array.isArray(absent) &&
  absent.some(
    (x) => typeof x === "string" && ACCESSIBILITY_QUESTIONS.includes(x)
  )

export const GAPS: readonly GapDefinition[] = [
  {
    key: "photo",
    label: "Photo",
    phrase: "a photo",
    completeness: true,
    filled: (r) => Boolean(r.heroImage),
  },
  {
    key: "hours",
    label: "Opening hours",
    phrase: "opening hours",
    completeness: true,
    filled: (r) => hasOpeningHours(r.openingTimes),
  },
  {
    key: "address",
    label: "Address",
    phrase: "an address",
    completeness: true,
    filled: (r) => text(r.streetAddress),
  },
  {
    key: "location",
    label: "Map location",
    phrase: "a map location",
    completeness: true,
    filled: (r) => Boolean(r.location),
  },
  {
    key: "facilities",
    label: "Facilities",
    phrase: "facilities",
    completeness: true,
    filled: (r) =>
      some(r.accessibility) || some(r.services) || some(r.amenities),
  },
  {
    key: "about",
    label: "About",
    phrase: "a description",
    completeness: true,
    filled: (r) =>
      text(r.summary) || some(r.description) || some(r.collectionStats),
  },
  {
    key: "history",
    label: "History",
    phrase: "a date from its history",
    completeness: true,
    filled: (r) => text(r.foundedYear) || text(r.openedYear),
  },
  {
    key: "contact",
    label: "Contact details",
    phrase: "contact details",
    completeness: true,
    filled: (r) => text(r.website) || text(r.phone) || text(r.email),
  },
  {
    key: "accessibility",
    label: "Accessibility",
    phrase: "accessibility details",
    completeness: false,
    filled: (r) =>
      some(r.accessibility) || answeredAccessibility(r.absentFacilities),
  },
  {
    key: "services",
    label: "Services",
    phrase: "services and amenities",
    completeness: false,
    filled: (r) => some(r.services) || some(r.amenities),
  },
]

export const GAP_KEYS: readonly GapKey[] = GAPS.map((g) => g.key)

export const COMPLETENESS_GAP_KEYS: readonly GapKey[] = GAPS.filter(
  (g) => g.completeness
).map((g) => g.key)

export const isGapKey = (v: unknown): v is GapKey =>
  typeof v === "string" && (GAP_KEYS as readonly string[]).includes(v)

export const gapDefinition = (key: GapKey): GapDefinition =>
  GAPS.find((g) => g.key === key)!

/** The record's gaps, in registry order. */
export function gapsOf(r: GapRecord): GapKey[] {
  return GAPS.filter((g) => !g.filled(r)).map((g) => g.key)
}

export interface CompletenessSection {
  key: GapKey
  label: string
  filled: boolean
}

/** The eight completeness sections and the 0–100 score stored on a library. */
export function completenessOf(r: GapRecord): {
  filled: number
  total: number
  percent: number
  sections: CompletenessSection[]
} {
  const sections = GAPS.filter((g) => g.completeness).map((g) => ({
    key: g.key,
    label: g.label,
    filled: g.filled(r),
  }))
  const filled = sections.filter((s) => s.filled).length

  return {
    filled,
    total: sections.length,
    percent: Math.round((filled / sections.length) * 100),
    sections,
  }
}
```

In `packages/shared-data/index.ts`, add to the barrel at the end:

```ts
export * from "./gaps"
```

- [ ] **Step 4: Build and run the test to verify it passes**

Run: `pnpm --filter @repo/shared-data build && cd apps/strapi && npx vitest run tests/gaps-registry.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared-data/gaps.ts packages/shared-data/index.ts apps/strapi/tests/gaps-registry.test.ts
git commit -m "feat: add one gap registry for completeness, search and drives"
```

---

### Task 2: Strapi stores `gaps` beside `completeness`

**Files:**

- Modify: `apps/strapi/src/api/library/content-types/library/schema.json` (new `gaps` attribute after `completeness`)
- Modify: `apps/strapi/src/utils/library-completeness.ts`
- Modify: `apps/strapi/src/documentMiddlewares/change-records.ts` (`LIBRARY_IGNORED`)
- Modify: `apps/strapi/src/utils/populate-shapes.ts` (`LIBRARY_LIST_FIELDS`)
- Test: `apps/strapi/tests/library-completeness.test.ts` (new)

**Interfaces:**

- Consumes: `completenessOf`, `gapsOf`, `GapKey` (Task 1).
- Produces: a `gaps` JSON attribute on `api::library.library` (string array of `GapKey`). It's written by `refreshLibraryCompleteness` and the bootstrap backfill, and returned by the library list and detail REST shapes. `computeCompleteness(l)` keeps its signature (returns a number). New `computeGaps(l: CompletenessSource): GapKey[]`.

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/library-completeness.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import {
  COMPLETENESS_FIELDS,
  computeCompleteness,
  computeGaps,
  refreshLibraryCompleteness,
} from "../src/utils/library-completeness"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

describe("library completeness and gaps", () => {
  it("reads absentFacilities, so a confirmed No can fill accessibility", () => {
    expect(COMPLETENESS_FIELDS).toContain("absentFacilities")
  })

  it("scores from the registry", () => {
    expect(computeCompleteness({ openingTimes: hours, website: "x" })).toBe(25)
    expect(computeGaps({ openingTimes: hours })).not.toContain("hours")
    expect(computeGaps({})).toContain("accessibility")
  })

  it("stores completeness and gaps together when either changed", async () => {
    const update = vi.fn(async () => ({}))
    const strapi: any = {
      documents: () => ({
        findOne: vi.fn(async () => ({ openingTimes: hours })),
      }),
      db: { query: () => ({ update }) },
      log: { warn: vi.fn() },
    }

    await refreshLibraryCompleteness(strapi, {
      id: 7,
      documentId: "lib1",
      locale: "en",
      publishedAt: null,
      completeness: 13,
      gaps: null,
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        completeness: 13,
        gaps: computeGaps({ openingTimes: hours }),
      },
    })
  })

  it("writes nothing when both are unchanged", async () => {
    const update = vi.fn(async () => ({}))
    const strapi: any = {
      documents: () => ({
        findOne: vi.fn(async () => ({ openingTimes: hours })),
      }),
      db: { query: () => ({ update }) },
      log: { warn: vi.fn() },
    }

    await refreshLibraryCompleteness(strapi, {
      id: 7,
      documentId: "lib1",
      locale: "en",
      publishedAt: null,
      completeness: 13,
      gaps: computeGaps({ openingTimes: hours }),
    })

    expect(update).not.toHaveBeenCalled()
  })
})
```

(`computeCompleteness({ openingTimes, website })` is 2 of 8 sections, so 25. `{ openingTimes }` alone is 1 of 8, which rounds to 13.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/strapi && npx vitest run tests/library-completeness.test.ts`
Expected: FAIL. `computeGaps` isn't exported, and `COMPLETENESS_FIELDS` lacks `absentFacilities`.

- [ ] **Step 3: Implement**

In `apps/strapi/src/utils/library-completeness.ts`:

1. Import from the registry: `import { completenessOf, gapsOf, type GapKey } from "@repo/shared-data"`.
2. Add `absentFacilities?: unknown` to `CompletenessSource`, and `"absentFacilities"` to `COMPLETENESS_FIELDS` (after `"email"`). `COMPLETENESS_TRIGGER_KEYS` spreads this list, so the lifecycle now recomputes when the facility answers change.
3. Replace the body of `computeCompleteness` with `return completenessOf(l).percent`. Keep its doc comment's first line, and note that the eight sections come from `@repo/shared-data` `GAPS`.
4. Add, after it:

```ts
/** The record's gaps (registry order), stored beside completeness. */
export function computeGaps(l: CompletenessSource): GapKey[] {
  return gapsOf(l)
}
```

5. Keep `compactHours` and `DAYS`: other modules may import them. Check with `grep -rn "compactHours\|DAYS" apps/strapi/src`, and leave them unchanged if anything imports them.
6. `LibraryRow` gains `gaps?: unknown`. In `refreshLibraryCompleteness`, compute both values. Write only when either changed, comparing the gaps arrays with `JSON.stringify`:

```ts
const completeness = computeCompleteness(source)
const gaps = computeGaps(source)
if (
  completeness !== row.completeness ||
  JSON.stringify(gaps) !== JSON.stringify(row.gaps ?? null)
) {
  await strapi.db
    .query(LIBRARY)
    .update({ where: { id: row.id }, data: { completeness, gaps } })
}

return completeness
```

7. In `backfillLibraryCompleteness`:
   - The filter becomes `{ $or: [{ completeness: { $null: true } }, { gaps: { $null: true } }] }`.
   - Add `"gaps"` to its `fields`.
   - Write `{ completeness: computeCompleteness(row), gaps: computeGaps(row) }`.
   - This is the existing bootstrap pass, extended, not a new backfill. It becomes a no-op once every row has both.
8. Find where `refreshLibraryCompleteness` is called (`grep -rn refreshLibraryCompleteness apps/strapi/src`; it's `src/lifeCycles/entityRef.ts`). Make sure the row it passes carries `gaps` (add `"gaps"` to whatever select or fields list builds that row).

In `schema.json`, add after `"completeness"`:

```json
    "gaps": {
      "type": "json"
    },
```

In `change-records.ts`, add `"gaps",` to `LIBRARY_IGNORED`, right after `"completeness",`, with the comment `// derived, like completeness`.

In `populate-shapes.ts`, add `"gaps",` to `LIBRARY_LIST_FIELDS` after `"completeness",`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/strapi && npx vitest run tests/library-completeness.test.ts tests/meilisearch-config.test.ts tests/change-records-middleware.test.ts tests/populate-shapes-schema.test.ts`
Expected: PASS. If `populate-shapes-schema.test.ts` or `meilisearch-config.test.ts` assert exact field lists, update them to include `gaps`, and say so in the report.

- [ ] **Step 5: Run the whole Strapi suite and typecheck**

Run: `cd apps/strapi && npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 6: Reload and check live**

Saving `schema.json` already reloaded Strapi. Wait for `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:1337/_health` to return `204`. The bootstrap backfill fills `gaps` on every row. Then:

Run: `curl -s "http://127.0.0.1:1337/api/libraries?pagination[limit]=1&fields[0]=gaps&fields[1]=completeness" -H "Authorization: Bearer $(grep STRAPI_REST_READONLY_API_KEY apps/ui/.env.local | cut -d= -f2)" | head -c 400`
Expected: one library with a `gaps` array and a `completeness` number. If the read-only key isn't in `apps/ui/.env.local`, check `apps/strapi/.env` for a token, or say in the report that the live check was skipped.

- [ ] **Step 7: Commit**

```bash
git add apps/strapi/src/api/library/content-types/library/schema.json apps/strapi/src/utils/library-completeness.ts apps/strapi/src/documentMiddlewares/change-records.ts apps/strapi/src/utils/populate-shapes.ts apps/strapi/src/lifeCycles apps/strapi/tests apps/strapi/types/generated
git commit -m "feat(strapi): store each library's gaps beside its completeness"
```

---

### Task 3: The verify action in Strapi

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/server/utils/library-verify.ts`
- Modify: `apps/strapi/src/api/library/content-types/library/schema.json` (new `verifiedSections`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json` (`evidenceType` gains `on_site_visit`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/utils/library-record.ts` (`applyLibraryRecord` stamps per section)
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (dispatch, verified points)
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission-policy.ts` (a verify needs sections and evidence)
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/moderation.ts` (`review()` for verify)
- Modify: `apps/strapi/src/utils/populate-shapes.ts` (`verifiedSections` in `LIBRARY_LIST_FIELDS`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/utils/publish-guard.ts` (`verifiedSections` in `META_KEYS`)
- Test: `apps/strapi/tests/content-moderation/library-verify.test.ts` (new); `apps/strapi/tests/content-moderation/approve-once.test.ts` and `library-record.test.ts` (additions)

**Interfaces:**

- Produces, from `utils/library-verify.ts`:
  - `VERIFY_SECTIONS = ["hours", "status", "address", "contact"] as const` and `type VerifySection`
  - `SECTION_FIELDS: Record<VerifySection, readonly string[]>`:
    - `hours`: `openingTimes`
    - `status`: `operationalStatus`
    - `address`: `streetAddress`, `city`, `postalCode`, `district`
    - `contact`: `website`, `phone`, `email`
  - `isVerification(fields: unknown): boolean`
  - `verifySections(fields: unknown): VerifySection[]`: valid, deduped, in `VERIFY_SECTIONS` order
  - `sectionsSetBy(data: Record<string, unknown>): VerifySection[]`: sections with at least one field set to a non-null value in a record update
  - `stampSections(current: unknown, sections: readonly VerifySection[], at: Date): Record<VerifySection, string>`: a merged map of ISO strings
  - `latestStamp(map: Record<string, string>): string | null`
  - `applyVerification(strapi, submission): Promise<ApplyRecordOutcome>`
  - `verifyReview(strapi, submission): Promise<{ sections: VerifySection[]; current: Record<string, unknown>; verifiedSections: Record<string, string> } | null>`
- Library attribute `verifiedSections` (JSON, `i18n.localized: false`): `{ hours?: ISO, status?: ISO, address?: ISO, contact?: ISO }`.
- Submission `evidenceType` enum value `on_site_visit`.

- [ ] **Step 1: Write the failing tests**

`apps/strapi/tests/content-moderation/library-verify.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import {
  applyVerification,
  isVerification,
  latestStamp,
  sectionsSetBy,
  stampSections,
  verifySections,
} from "../../src/plugins/content-moderation/server/utils/library-verify"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const AT = new Date("2026-10-05T12:00:00.000Z")

describe("verify helpers", () => {
  it("recognises a verify correction and keeps valid sections in order", () => {
    expect(isVerification({ kind: "verify" })).toBe(true)
    expect(isVerification({ kind: "record" })).toBe(false)
    expect(
      verifySections({
        kind: "verify",
        sections: ["contact", "hours", "hours", "nope"],
      })
    ).toEqual(["hours", "contact"])
    expect(verifySections({ kind: "verify" })).toEqual([])
  })

  it("names the sections a record update sets", () => {
    expect(
      sectionsSetBy({ openingTimes: { days: [] }, city: "York", phone: null })
    ).toEqual(["hours", "address"])
    expect(sectionsSetBy({ name: "X" })).toEqual([])
    expect(sectionsSetBy({ operationalStatus: "unknown" })).toEqual([])
  })

  it("merges stamps and finds the latest", () => {
    const map = stampSections(
      { hours: "2025-01-01T00:00:00.000Z" },
      ["status"],
      AT
    )
    expect(map).toEqual({
      hours: "2025-01-01T00:00:00.000Z",
      status: AT.toISOString(),
    })
    expect(latestStamp(map)).toBe(AT.toISOString())
    expect(latestStamp({})).toBeNull()
    expect(stampSections("junk", ["hours"], AT)).toEqual({
      hours: AT.toISOString(),
    })
  })
})

describe("applyVerification", () => {
  it("stamps the confirmed sections and lastVerifiedAt, changing nothing else", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(AT)
    const { strapi, store } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: "lib00000000000000000001",
          slug: "lib",
          name: "Library",
          locale: "en",
          verifiedSections: { contact: "2025-01-01T00:00:00.000Z" },
        },
      ],
    })

    const outcome = await applyVerification(strapi, {
      documentId: "s1",
      targetDocumentId: "lib00000000000000000001",
      fields: { kind: "verify", sections: ["hours", "status"] },
    })

    expect(outcome).toBe("applied")
    const lib = store[LIBRARY]![0]!
    expect(lib.verifiedSections).toEqual({
      contact: "2025-01-01T00:00:00.000Z",
      hours: AT.toISOString(),
      status: AT.toISOString(),
    })
    expect(new Date(lib.lastVerifiedAt).toISOString()).toBe(AT.toISOString())
    expect(lib.name).toBe("Library")
    vi.useRealTimers()
  })

  it("is a noop without sections or without the library", async () => {
    const { strapi } = makeFakeStrapi({ [LIBRARY]: [] })
    expect(
      await applyVerification(strapi, {
        documentId: "s1",
        targetDocumentId: "lib00000000000000000001",
        fields: { kind: "verify", sections: ["hours"] },
      })
    ).toBe("noop")
    expect(
      await applyVerification(strapi, {
        documentId: "s2",
        targetDocumentId: "lib00000000000000000001",
        fields: { kind: "verify", sections: [] },
      })
    ).toBe("noop")
  })
})
```

Add to `apps/strapi/tests/content-moderation/approve-once.test.ts`. Reuse its `LIBRARY_SEED` and `setup` helpers, and add a `pendingVerify()` builder like `pendingHoursEdit()`: `submissionType: "correction"`, `fields: { kind: "verify", sections: ["hours", "address"] }`, `evidenceType: "on_site_visit"`. Then:

```ts
it("awards hours_verified for a confirmed hours section, and the base correction points", async () => {
  const verify = pendingVerify()
  const { svc, award } = setup(verify)
  await svc.updateStatus(verify.documentId, "approved", REVIEWER)
  const actions = award.mock.calls.map((c: unknown[]) => c[1])
  expect(actions).toContain("hours_verified")
  expect(actions).not.toContain("status_verified")
  expect(actions).toContain("correction_approved")
})
```

Add to `apps/strapi/tests/content-moderation/library-record.test.ts`, inside `describe("applyLibraryRecord")`:

```ts
it("stamps only the verifiable sections an edit sets", async () => {
  const { strapi, store } = memoised({
    [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Old", locale: "en" }],
  })
  await applyLibraryRecord(strapi, {
    documentId: "s1",
    targetDocumentId: ID,
    fields: { kind: "record", city: "York" },
  })
  const lib = store[LIBRARY]![0]!
  expect(Object.keys(lib.verifiedSections ?? {})).toEqual(["address"])
  expect(lib.lastVerifiedAt).toBeTruthy()
})

it("leaves lastVerifiedAt alone for an edit with no verifiable section", async () => {
  const { strapi, store } = memoised({
    [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Old", locale: "en" }],
  })
  await applyLibraryRecord(strapi, {
    documentId: "s1",
    targetDocumentId: ID,
    fields: { kind: "record", name: "New" },
  })
  const lib = store[LIBRARY]![0]!
  expect(lib.lastVerifiedAt).toBeUndefined()
  expect(lib.contentUpdatedAt).toBeInstanceOf(Date)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/strapi && npx vitest run tests/content-moderation/library-verify.test.ts tests/content-moderation/library-record.test.ts tests/content-moderation/approve-once.test.ts`
Expected: FAIL. `library-verify` doesn't exist, no `verifiedSections` stamping happens, and no `hours_verified` is awarded for a verify.

- [ ] **Step 3: Write `utils/library-verify.ts`**

```ts
import type { ApplyRecordOutcome } from "./library-record"
import { defaultLocale } from "./locales"
import { applyToPublished } from "./publish-guard"

/**
 * "Still right?": a `correction` with `fields.kind: "verify"` confirms some
 * of a library's sections without changing them. Approval stamps each one in
 * `verifiedSections`, and `lastVerifiedAt` becomes the latest stamp. An
 * approved edit stamps the sections it sets (applyLibraryRecord). Sections
 * are shared by every locale version, so stamps are too.
 */

const LIBRARY = "api::library.library"

export const VERIFY_SECTIONS = [
  "hours",
  "status",
  "address",
  "contact",
] as const
export type VerifySection = (typeof VERIFY_SECTIONS)[number]

export const SECTION_FIELDS: Record<VerifySection, readonly string[]> = {
  hours: ["openingTimes"],
  status: ["operationalStatus"],
  address: ["streetAddress", "city", "postalCode", "district"],
  contact: ["website", "phone", "email"],
}

export function isVerification(fields: unknown): boolean {
  return (
    !!fields &&
    typeof fields === "object" &&
    (fields as { kind?: unknown }).kind === "verify"
  )
}

/** The confirmed sections: valid ones only, once each, in VERIFY_SECTIONS order. */
export function verifySections(fields: unknown): VerifySection[] {
  const raw = (fields as { sections?: unknown } | null)?.sections
  const asked = new Set(Array.isArray(raw) ? raw : [])

  return VERIFY_SECTIONS.filter((s) => asked.has(s))
}

/**
 * The sections a record update sets: a non-null value for one of its fields.
 * Setting the status to "unknown" checks nothing.
 */
export function sectionsSetBy(data: Record<string, unknown>): VerifySection[] {
  return VERIFY_SECTIONS.filter((s) =>
    SECTION_FIELDS[s].some((f) => {
      const v = data[f]
      return (
        v !== undefined &&
        v !== null &&
        !(f === "operationalStatus" && v === "unknown")
      )
    })
  )
}

export function stampSections(
  current: unknown,
  sections: readonly VerifySection[],
  at: Date
): Record<VerifySection, string> {
  const map: Partial<Record<VerifySection, string>> = {}
  if (current && typeof current === "object" && !Array.isArray(current))
    for (const s of VERIFY_SECTIONS) {
      const v = (current as Record<string, unknown>)[s]
      if (typeof v === "string") map[s] = v
    }
  for (const s of sections) map[s] = at.toISOString()

  return map as Record<VerifySection, string>
}

export function latestStamp(map: Record<string, string>): string | null {
  const stamps = Object.values(map).filter((v) => typeof v === "string")

  return stamps.length > 0 ? stamps.sort()[stamps.length - 1]! : null
}

type Submission = {
  documentId: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
}

async function findLibrary(
  strapi: any,
  submission: Submission,
  base: string,
  fields: string[]
) {
  if (submission.targetDocumentId)
    return strapi.documents(LIBRARY).findOne({
      documentId: submission.targetDocumentId,
      locale: base,
      fields: ["documentId", ...fields],
    })
  if (!submission.targetSlug) return null
  const [library] = await strapi.documents(LIBRARY).findMany({
    filters: { slug: { $eq: submission.targetSlug } },
    locale: base,
    fields: ["documentId", ...fields],
    limit: 1,
  })

  return library ?? null
}

export async function applyVerification(
  strapi: any,
  submission: Submission
): Promise<ApplyRecordOutcome> {
  const sections = verifySections(submission.fields)
  if (sections.length === 0) return "noop"
  const base = await defaultLocale(strapi)
  const library = await findLibrary(strapi, submission, base, [
    "verifiedSections",
  ])
  if (!library) {
    strapi.log?.warn?.(
      `[content-moderation] verify ${submission.documentId}: library not found; nothing applied`
    )

    return "noop"
  }
  const verifiedSections = stampSections(
    library.verifiedSections,
    sections,
    new Date()
  )
  const mode = await applyToPublished(
    strapi,
    LIBRARY,
    library.documentId,
    { verifiedSections, lastVerifiedAt: latestStamp(verifiedSections) },
    { locale: base }
  )

  return mode === "draft_only" ? "applied_draft" : "applied"
}

/** The live values a Moderator checks a verification against. */
export async function verifyReview(strapi: any, submission: Submission) {
  if (!isVerification(submission.fields)) return null
  const sections = verifySections(submission.fields)
  const base = await defaultLocale(strapi)
  const fields = [
    ...new Set(sections.flatMap((s) => SECTION_FIELDS[s])),
    "verifiedSections",
  ]
  const library = await findLibrary(strapi, submission, base, fields)
  const current: Record<string, unknown> = {}
  for (const f of fields)
    if (f !== "verifiedSections" && library && f in library)
      current[f] = library[f]

  return {
    sections,
    current,
    verifiedSections: stampSections(library?.verifiedSections, [], new Date()),
  }
}
```

Check `applyToPublished`'s return type in `publish-guard.ts`. If it returns `{ mode }` rather than the mode string, destructure it, as `applyFacilityAnswers` does.

- [ ] **Step 4: Wire it in**

- **`library-record.ts` `applyLibraryRecord`:**
  - Add `"verifiedSections"` to the `fields` that its `findLibrary` reads.
  - Replace the default-locale write payload `{ ...data, contentUpdatedAt: now, lastVerifiedAt: now }` with:

```ts
const touched = sectionsSetBy(data)
const stamps = touched.length
  ? stampSections(library.verifiedSections, touched, now)
  : null
const payload = localized
  ? data
  : {
      ...data,
      contentUpdatedAt: now,
      ...(stamps
        ? { verifiedSections: stamps, lastVerifiedAt: latestStamp(stamps) }
        : {}),
    }
```

Pass `payload` to `applyToLocale`. Import `sectionsSetBy`, `stampSections` and `latestStamp` from `./library-verify`. `library-verify.ts` imports only a type from `library-record.ts`, so there's no runtime cycle.

- **`services/submission.ts`:**
  - Import `applyVerification`, `isVerification` and `verifySections`.
  - In the correction/library_edit apply branch, add an arm before the facilities fallback: `isVerification(submission.fields) ? await applyVerification(strapi, submission) : await (this as any).applyFacilityAnswers(submission)`. Keep the record and photo arms as they are.
  - In the verified points block, widen the condition with `|| (submission?.submissionType === "correction" && isVerification(submission.fields))`. For a verify, the actions come from the sections:

```ts
const actions = isVerification(submission.fields)
  ? verifySections(submission.fields).flatMap((s) =>
      s === "hours"
        ? (["hours_verified"] as const)
        : s === "status"
          ? (["status_verified"] as const)
          : []
    )
  : verifiedActions(submission.fields, locale !== base)
```

    Loop over `actions` instead of calling `verifiedActions` inline. The existing correction points block already gives a verify `correction_approved` (2), because its kind isn't photo or source. Leave that as it is.

- **`services/submission-policy.ts` `check()`:** for `submissionType === "correction"` with `fields.kind === "verify"`, refuse with 400 when `verifySections(fields)` is empty ("Choose at least one section to confirm.") or when there's neither an http(s) `evidenceUrl` nor `evidenceType === "on_site_visit"` ("Add the page you checked, or say you checked in person."). Put this beside the other field checks, so `create` and `finalize` both run it.
- **`services/moderation.ts` `review()`:** for `correction`, use `isVerification(s.fields) ? verifyReview(strapi, s).catch(() => null) : recordReview(strapi, s).catch(() => null)`.
- **`schema.json` (library):** add after `"contentUpdatedAt"`:

```json
    "verifiedSections": {
      "type": "json",
      "pluginOptions": { "i18n": { "localized": false } }
    },
```

- **Submission `schema.json`:** add `"on_site_visit"` to the `evidenceType` enum, after `"on_site_photo"`.
- **`populate-shapes.ts`:** add `"verifiedSections",` to `LIBRARY_LIST_FIELDS` after `"lastVerifiedAt",`.
- **`publish-guard.ts`:** add `"verifiedSections",` to `META_KEYS` beside `"lastVerifiedAt"`, so a stamp never counts as a divergent draft.
- **The UI's moderation types:** if `apps/ui/src/components/moderation/submissionMeta.ts` lists evidence types for display, add `on_site_visit: "Checked in person"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/strapi && npx vitest run tests/content-moderation && npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 6: Build the plugins and reload**

Run: `pnpm --filter @repo/strapi build:plugins && touch apps/strapi/src/index.ts`, then wait for `/_health` to return 204.

- [ ] **Step 7: Commit**

```bash
git add apps/strapi apps/ui/src/components/moderation/submissionMeta.ts
git commit -m "feat(strapi): confirm a library's sections with a verify correction"
```

(Stage only the files this task changed. `git add apps/strapi` would also pick up any unrelated changes, so check `git status --short` first and stage paths explicitly if anything else is modified.)

---

### Task 4: Record corrections score like edits

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (the correction points block)
- Test: `apps/strapi/tests/content-moderation/approve-once.test.ts`

**Interfaces:**

- Consumes: `LIBRARY_FIELDS` (the set already used by the `library_edit` block in the same file), `isRecordCorrection`.

- [ ] **Step 1: Write the failing test**

Add a `pendingRecordCorrection()` builder to `approve-once.test.ts`: `submissionType: "correction"`, `fields: { kind: "record", city: "York", phone: "01904 000000", previous: {} }`, targeting the seeded library. Then:

```ts
it("scores a record correction like a claimant's edit", async () => {
  const c = pendingRecordCorrection()
  const { svc, award } = setup(c)
  await svc.updateStatus(c.documentId, "approved", REVIEWER)
  expect(award).toHaveBeenCalledWith(
    "u4",
    "edit_accepted_minor",
    5,
    expect.anything(),
    `${c.documentId}:edit_accepted_minor`
  )
  const actions = award.mock.calls.map((x: unknown[]) => x[1])
  expect(actions).not.toContain("correction_approved")
})
```

(Use `submittedByUserId: "u4"` in the builder.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/strapi && npx vitest run tests/content-moderation/approve-once.test.ts`
Expected: FAIL. It awards `correction_approved` (2) today.

- [ ] **Step 3: Implement**

The `library_edit` points block counts allowlisted fields and awards `edit_accepted_minor` (5) for 1–3 or `edit_accepted_major` (15) for 4+. Extract its counting into a small local helper, `editAction(fields): ["edit_accepted_minor", 5] | ["edit_accepted_major", 15]`. Use it in the `library_edit` block, and in the correction block as a new first arm: `isRecordCorrection(submission.fields) ? editAction(submission.fields) : kind === "photo" ? … : kind === "source" ? … : ["correction_approved", 2]`. The idempotency key stays `${documentId}:${action}`.

- [ ] **Step 4: Run the tests, build and commit**

Run: `cd apps/strapi && npx vitest run && npx tsc --noEmit && cd ../.. && pnpm --filter @repo/strapi build:plugins && touch apps/strapi/src/index.ts`
Expected: all pass.

In the Knowledge article "Points, streaks and tiers", the "An accepted correction: 2 points" line becomes true only for free-text corrections. Note this in the report for the controller, who updates the content.

```bash
git add apps/strapi/src/plugins/content-moderation/server/services/submission.ts apps/strapi/tests/content-moderation/approve-once.test.ts
git commit -m "feat(strapi): score structured record corrections like claimant edits"
```

---

### Task 5: Index fields for gaps, verification, sources and places

**Files:**

- Modify: `apps/strapi/config/plugins.ts`
- Modify: `apps/strapi/src/utils/library-search-fields.ts`
- Modify: `apps/strapi/src/utils/populate-shapes.ts` (`LIBRARY_LIST_FIELDS` gains `source` and `createdAt` if missing)
- Modify: `apps/strapi/database/migrations/shared/hot-path-index-sql.js`
- Test: `apps/strapi/tests/library-search-fields.test.ts`, `apps/strapi/tests/meilisearch-config.test.ts`

**Interfaces:**

- Consumes: stored `gaps` (Task 2), `verifiedSections` (Task 3), `isGapKey` (Task 1).
- Produces these Meilisearch library document fields:
  - `needs: GapKey[]`: the stored gaps, or the legacy three-key derivation when `gaps` isn't an array yet
  - `created_ts: number`: unix seconds
  - `last_verified_ts`, `verified_hours_ts`, `verified_status_ts`, `verified_address_ts`, `verified_contact_ts`: unix seconds, omitted when unknown
  - `source: string | null`
- Settings changes:
  - filterable gains `completeness`, `id`, `source`, `created_ts` and the verified timestamps
  - sortable gains `id`
  - searchable gains `area_name`

- [ ] **Step 1: Write the failing tests**

In `apps/strapi/tests/library-search-fields.test.ts`, add:

```ts
describe("drive fields", () => {
  it("uses the stored gaps as needs", () => {
    expect(
      librarySearchFields(
        { gaps: ["hours", "contact", "bogus"], openingTimes: null },
        null,
        null
      ).needs
    ).toEqual(["hours", "contact"])
  })

  it("falls back to the three legacy needs before gaps are stored", () => {
    expect(librarySearchFields({}, null, null).needs).toEqual([
      "hours",
      "photo",
      "facilities",
    ])
  })

  it("adds created and verified timestamps in seconds", () => {
    const f = librarySearchFields(
      {
        createdAt: "2026-10-01T00:00:00.000Z",
        lastVerifiedAt: "2026-10-03T00:00:00.000Z",
        verifiedSections: { hours: "2026-10-02T00:00:00.000Z", nope: "x" },
      },
      null,
      null
    )
    expect(f.created_ts).toBe(Date.parse("2026-10-01T00:00:00.000Z") / 1000)
    expect(f.last_verified_ts).toBe(
      Date.parse("2026-10-03T00:00:00.000Z") / 1000
    )
    expect(f.verified_hours_ts).toBe(
      Date.parse("2026-10-02T00:00:00.000Z") / 1000
    )
    expect(f).not.toHaveProperty("verified_status_ts")
  })
})
```

Update the two existing `librarySearchFields` expectations in this file so they also expect the absent timestamps to be omitted. Those fixtures have no `createdAt`, so `created_ts` is omitted too.

In `apps/strapi/tests/meilisearch-config.test.ts`, add:

```ts
describe("library index serves drives", () => {
  it("filters on what drive scopes and gaps need", () => {
    const {
      filterableAttributes = [],
      sortableAttributes = [],
      searchableAttributes = [],
    } = meili.library.settings
    for (const key of [
      "completeness",
      "id",
      "source",
      "created_ts",
      "last_verified_ts",
      "verified_hours_ts",
      "verified_status_ts",
      "verified_address_ts",
      "verified_contact_ts",
      "needs",
      "area_slug",
    ])
      expect(filterableAttributes).toContain(key)
    expect(sortableAttributes).toContain("id")
    expect(searchableAttributes).toContain("area_name")
  })
})
```

(Use whatever variable the file already uses for the plugin config; the existing tests call it `meili`.)

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/strapi && npx vitest run tests/library-search-fields.test.ts tests/meilisearch-config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`library-search-fields.ts`:

- Import `isGapKey` from `@repo/shared-data`.
- Keep `libraryNeeds` as the legacy fallback, and update its doc comment to say so.
- Add:

```ts
const seconds = (v: unknown): number | null => {
  if (typeof v !== "string" && !(v instanceof Date)) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}

const VERIFIED_SECTIONS = ["hours", "status", "address", "contact"] as const

/** The stored gaps, or the legacy derivation for a row not yet backfilled. */
function needsOf(entry: Record<string, unknown>): string[] {
  return Array.isArray(entry.gaps)
    ? entry.gaps.filter(isGapKey)
    : libraryNeeds(entry)
}

/** Unix seconds for when the library was created and when each section was last checked. */
export function timestampFields(
  entry: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {}
  const created = seconds(entry.createdAt)
  if (created != null) out.created_ts = created
  const last = seconds(entry.lastVerifiedAt)
  if (last != null) out.last_verified_ts = last
  const map = entry.verifiedSections
  if (map && typeof map === "object" && !Array.isArray(map))
    for (const s of VERIFIED_SECTIONS) {
      const t = seconds((map as Record<string, unknown>)[s])
      if (t != null) out[`verified_${s}_ts`] = t
    }

  return out
}
```

- In `librarySearchFields`, set `needs: needsOf(entry)` and spread `...timestampFields(entry)`.
- Export `TIMESTAMP_FIELD_NAMES = ["created_ts", "last_verified_ts", ...VERIFIED_SECTIONS.map((s) => `verified\_${s}\_ts`)]`.

`config/plugins.ts`:

- `LIBRARY_FIELDS` gains `"gaps"`, `"source"`, `"createdAt"`, `"lastVerifiedAt"`, `"verifiedSections"`.
- Fetched-only fields stay out of the document. Replace the `LIBRARY_DOC_KEYS` filter with:

```ts
// Fetched only to derive other fields; never stored as is.
const DERIVE_ONLY = new Set([
  "location",
  "gaps",
  "verifiedSections",
  "lastVerifiedAt",
  "createdAt",
])
const LIBRARY_DOC_KEYS = [
  "id",
  ...LIBRARY_FIELDS.filter((f) => !DERIVE_ONLY.has(f)),
]
```

- `LIBRARY_SEARCH_FIELDS` gains `...TIMESTAMP_FIELD_NAMES` (imported).
- `filterableAttributes` gains `"completeness"`, `"id"` and `"source"`. The timestamps arrive through `...LIBRARY_SEARCH_FIELDS`.
- `sortableAttributes` becomes `["name", "featured", "completeness", "_geo", "id"]`.
- `searchableAttributes` gains `"area_name"` after `"region_name"`.
- Fix the stale comment above `LIBRARY_SEARCH_FIELDS` ("completeness is already a document key"): it's a document key and is now filterable too.

`populate-shapes.ts`: make sure `LIBRARY_LIST_FIELDS` contains `"source"` and `"createdAt"` (with `gaps` and `verifiedSections` from Tasks 2–3). The meilisearch-config test "the core list route returns every field the seed reads" enforces this.

`hot-path-index-sql.js`: add after `index("libraries", ["library_type"]),`:

```js
    // Drives and Find libraries filter or sort on these (also in Meilisearch).
    index("libraries", ["completeness"]),
    index("libraries", ["last_verified_at"]),
    index("libraries", ["source"]),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/strapi && npx vitest run && npx tsc --noEmit`
Expected: all pass. Update the `transformEntry` fixture expectations in `meilisearch-config.test.ts` for the new keys, and add `source` to its displayed-keys expectation.

- [ ] **Step 5: Reload, reseed and check live**

Saving `config/plugins.ts` reloads Strapi. Wait for `/_health` to return 204, then:

Run: `pnpm --filter @repo/strapi seed:meilisearch`
Expected: the library index is rebuilt with no errors.

Run: `curl -s "http://localhost:7701/indexes/library/search" -H "Authorization: Bearer $(grep MEILISEARCH_ADMIN_API_KEY apps/strapi/.env | cut -d= -f2)" -H 'Content-Type: application/json' -d '{"q":"","limit":0,"facets":["needs"],"filter":"completeness < 50"}' | head -c 600`
Expected: a `facetDistribution.needs` object with gap keys (`hours`, `accessibility`, `contact`…), and no filter error. If the admin key variable has a different name in `.env`, find it with `grep -i meili apps/strapi/.env`.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/config/plugins.ts apps/strapi/src/utils/library-search-fields.ts apps/strapi/src/utils/populate-shapes.ts apps/strapi/database/migrations/shared/hot-path-index-sql.js apps/strapi/tests/library-search-fields.test.ts apps/strapi/tests/meilisearch-config.test.ts
git commit -m "feat(strapi): index gaps, verification, sources and creation for drives"
```

---

### Task 6: The UI reads the gap registry

**Files:**

- Modify: `apps/ui/src/components/library/library-page.helpers.ts` (`computeCompleteness`, `recordChecklist`)
- Modify: `apps/ui/src/components/library/LibrarySidebar.tsx` (`libraryChecklist` passes the registry fields)
- Modify: `apps/ui/src/components/library/LibraryHelpPanel.tsx` (`tasksFor` keyed by gap keys)
- Modify: `apps/ui/src/components/location/location-page.helpers.ts` (`GAP_DEFS`, `recordGaps`)
- Modify: `apps/ui/src/components/index-page/find-helpers.ts` (`NEED_KEYS`)
- Modify: callers that use completeness section keys: `apps/ui/src/lib/strapi-api/content/server.ts` (~line 1954, the task-card gap computation) and `apps/ui/src/app/[locale]/contribute/index/[slug]/page.tsx` (~line 135)
- Tests: `apps/ui/src/components/library/__tests__/library-page.helpers.test.ts`, `apps/ui/src/components/location/__tests__/location-page.helpers.test.ts`, the find-helpers tests (`apps/ui/src/components/index-page/__tests__/`), and any test that asserts checklist keys

**Interfaces:**

- Consumes: `completenessOf`, `gapsOf`, `gapDefinition`, `GapKey`, `GapRecord` from `@repo/shared-data` (Task 1; rebuild shared-data first).
- Produces:
  - UI `computeCompleteness(library)`: same return shape (`{ filled, total, sections }`), with sections from the registry (keys `photo`, `hours`, `address`, `location`, `facilities`, `about`, `history`, `contact`)
  - `recordChecklist(library)`: `{ done, total, items }`, where `items` are the same eight with `key: GapKey` and `label`
  - `ChecklistKey` = the eight completeness `GapKey`s
  - `GAP_DEFS` on location pages: keys `hours`, `photo`, `accessibility`, `contact`
  - Find `NEED_KEYS` (in order, each label prefixed "Missing ", lower-cased after the first word):
    - `hours`: "Missing opening hours"
    - `photo`: "Missing photo"
    - `accessibility`: "Missing accessibility details"
    - `services`: "Missing services and amenities"
    - `contact`: "Missing contact details"
    - `address`: "Missing address"

- [ ] **Step 1: Write the failing tests**

In `library-page.helpers.test.ts`, replace the `recordChecklist` and `computeCompleteness` expectations with registry-based ones:

```ts
describe("recordChecklist", () => {
  it("lists the eight completeness sections in registry order", () => {
    const { items, total, done } = recordChecklist({})
    expect(items.map((i) => i.key)).toEqual([
      "photo",
      "hours",
      "address",
      "location",
      "facilities",
      "about",
      "history",
      "contact",
    ])
    expect(total).toBe(8)
    expect(done).toBe(0)
  })

  it("matches the stored completeness score's sections", () => {
    const lib = { streetAddress: "1 High St", phone: "0123" }
    const { done } = recordChecklist(lib)
    expect(done).toBe(computeCompleteness(lib).filled)
    expect(done).toBe(2)
  })
})
```

In `location-page.helpers.test.ts`, add:

```ts
it("shows location pages the four gaps visitors need first", () => {
  expect(GAP_DEFS.map((g) => g.key)).toEqual([
    "hours",
    "photo",
    "accessibility",
    "contact",
  ])
  expect(recordGaps({ absentFacilities: ["Hearing loop"] })).not.toContain(
    "accessibility"
  )
})
```

In the find-helpers tests, add an assertion that `ALL_NEED_KEYS` equals `["hours", "photo", "accessibility", "services", "contact", "address"]`, and that `findStateFromParams(new URLSearchParams("needs=hours,facilities"))` keeps only `hours`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @repo/shared-data build && cd apps/ui && npx vitest run src/components/library src/components/location src/components/index-page`
Expected: FAIL on the new expectations.

- [ ] **Step 3: Implement**

**`library-page.helpers.ts`:**

- Import `completenessOf`, `type CompletenessSection as RegistrySection`, `type GapKey` and `type GapRecord` from `@repo/shared-data`.
- `computeCompleteness(library: GapRecord)` returns `{ filled, total, sections }` from `completenessOf(library)`, without `percent`. Keep the exported `CompletenessSection` type as an alias of the registry's.
- `ChecklistKey` becomes `Extract<GapKey, "photo" | "hours" | "address" | "location" | "facilities" | "about" | "history" | "contact">`.
- `recordChecklist(library: GapRecord)` maps `completenessOf(library).sections` to `{ key, label, done: filled }`.
- Remove the old field-by-field code.

**`LibrarySidebar.tsx` `libraryChecklist`:** pass every `GapRecord` field the library has:

- `heroImage`, `openingTimes`, `streetAddress`, `location`
- `accessibility`, `services`, `amenities`, `absentFacilities`
- `summary`, `description`, `collectionStats`
- `foundedYear`, `openedYear`
- `website`, `phone`, `email`

Read the ones not on the `Lib` type through the existing `asRecord(library)`. The checklist panel's markup is unchanged; it renders the new labels. In `LibraryRecordPanel`'s label column the old items were Name and Links: they become the registry's labels.

**`LibraryHelpPanel.tsx` `tasksFor`:** key the tasks by the new checklist keys, keeping their titles, icons and tints:

- `facilities` → "Add accessibility details" (`href: "#access"`)
- `about` → "Describe the collections" (category "Collections")
- `photo` → "Share a photo" (`hubHref("photo", library)`)
- `hours` → "Add the opening hours" (category "Opening hours")
- `address` → "Add the address" (category "Address or location")
- `location` → "Put it on the map" (meta "About 1 minute", icon `mdi:map-marker-radius-outline`, category "Address or location")
- `history` → "Add a date from its history" (category "Something else")
- `contact` → "Add the official website" (category "Website or catalogue")

The order of `all` stays: accessibility-like first, then about, photo, hours, address, location, history, contact. Keep `.slice(0, 3)`.

**`location-page.helpers.ts`:**

```ts
const LOCATION_GAPS = ["hours", "photo", "accessibility", "contact"] as const

/** The gaps shown on location pages: the details visitors need first. */
export const GAP_DEFS = LOCATION_GAPS.map((key) => {
  const g = gapDefinition(key)
  return { key, label: g.label, phrase: g.phrase }
})

export type GapKey = (typeof LOCATION_GAPS)[number]

export function recordGaps(library: GapRecord): GapKey[] {
  const gaps = new Set(gapsOf(library))
  return LOCATION_GAPS.filter((k) => gaps.has(k))
}
```

Keep `gapLabel` and `describeGaps` working off `GAP_DEFS`. The region controller returns no `absentFacilities` for its libraries, so the "accessibility" chip relies on the relation alone there. That's fine.

**`find-helpers.ts`:** use the `NEED_KEYS` list above. `NeedKey` follows from it.

**Callers:**

- `server.ts` ~1954: the task-card helper reads `computeCompleteness(entry).sections`. Map any section key it compares against: `collections` → `about`, `photo` stays, `contact` stays.
- The Index editor `[slug]/page.tsx`: only uses the counts, so it's unchanged except the type.
- Grep `apps/ui/src` for `"collections"`, `"links"`, `"photos"` and `"name"` used as checklist or section keys, and update each. `ContributeSection.tsx` and `wizard.types.ts` only mention keys in comments; update the comments.

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`
Expected: all pass; only the two known tsc errors.

- [ ] **Step 5: Check a library page renders**

Run: `rtk proxy curl -s http://localhost:3000/libraries | grep -o 'href="/[a-z-]*/[a-z-]*/[a-z0-9-]*/[a-z0-9-]*"' | head -1` to find a library URL. Then run `rtk proxy curl -s http://localhost:3000<that path> | grep -o "Map location\|Contact details\|Completeness" | sort -u`.
Expected: the new labels are present. If the dev server needs the rebuilt shared-data, it picks up `dist/` on the next request; if it doesn't, say so in the report rather than restarting the UI server.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/library apps/ui/src/components/location apps/ui/src/components/index-page apps/ui/src/lib/strapi-api/content/server.ts 'apps/ui/src/app/[locale]/contribute/index/[slug]/page.tsx'
git commit -m "feat(ui): read every gap from the shared registry"
```

---

### Task 7: Find libraries filters by area and by source

**Files:**

- Modify: `apps/ui/src/lib/find-places.ts`
- Modify: `apps/ui/src/lib/find-search.ts` (`FindQuery.source`, `findFilter`, `PLACE_LIMIT`, the area facet query in `searchFind`, `FindLocation.areas`)
- Modify: `apps/ui/src/components/index-page/find-helpers.ts` (`FindState.source`, URL parse and serialise, `findQueryOf`, place-chain helpers)
- Tests: `apps/ui/src/lib/__tests__/find-search.test.ts` (or wherever `findFilter` is tested), find-helpers tests

**Interfaces:**

- Produces:
  - `FindPlaceLevel = "continent" | "country" | "region" | "area"`; `FIND_PLACE_LEVELS` gains `"area"` last
  - `FindQuery.source?: string`: `findFilter` adds `source = "<key>"`
  - URL params: `area=<slug>`, `source=<key>`; both round-trip through `findStateFromParams` and `findStateToParams`

- [ ] **Step 1: Write the failing tests**

```ts
it("filters by an area and by a source dataset", () => {
  const filter = findFilter(
    {
      place: { level: "area", slug: "schuyler-county-ny" },
      source: "imls-pls",
    },
    []
  )
  expect(filter).toContain('area_slug = "schuyler-county-ny"')
  expect(filter).toContain('source = "imls-pls"')
})
```

```ts
it("round-trips area and source through the URL", () => {
  const state = findStateFromParams(
    new URLSearchParams(
      "region=new-york&area=schuyler-county-ny&source=imls-pls"
    )
  )
  expect(state.place).toEqual({ level: "area", slug: "schuyler-county-ny" })
  expect(state.source).toBe("imls-pls")
  const back = findStateToParams(state)
  expect(back.get("area")).toBe("schuyler-county-ny")
  expect(back.get("source")).toBe("imls-pls")
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/ui && npx vitest run src/lib src/components/index-page`
Expected: FAIL. `"area"` isn't a level and `source` isn't wired.

- [ ] **Step 3: Implement**

- `find-places.ts`: add `"area"` to the union and to `FIND_PLACE_LEVELS`.
- `find-search.ts`:
  - `FindQuery.source?: string`.
  - In `findFilter`: `if (q.source) parts.push(\`source = ${JSON.stringify(q.source)}\`)`.
  - `PLACE_LIMIT.area = FIND_MAX_REACHABLE`.
  - In `searchFind`'s multiSearch, add an `area_slug` distinct query gated on a chosen region, mirroring the existing `region_slug` query gated on a country, and expose `areas` on `FindLocation`.
  - Follow the existing region code exactly. Don't change how continent, country and region behave.
- `find-helpers.ts`:
  - `FindState.source: string | null`.
  - Parse with `params.get("source")`; serialise when set.
  - `findQueryOf` copies it.
  - `PLACE_LEVELS` is derived from `FIND_PLACE_LEVELS`, so `area=` is read first automatically.
  - Extend `placePath`, `pickPlace` and `placeChoices` for the area level the same way they handle region: picking an area keeps its region; clearing a region clears the area.
  - If the Location filter UI renders one select per level from these helpers, an Area select appears once a region is chosen. Let it, and label it with the region's Place Labels if the existing region select does the same for its country's labels; otherwise "Area". Report what it shows.
- No UI control for `source`: it's a URL-only filter for drive links.

- [ ] **Step 4: Run tests, typecheck and check live**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`, then `rtk proxy curl -s "http://localhost:3000/libraries?source=imls-pls" -o /dev/null -w "%{http_code}\n"`
Expected: all pass; the page returns 200.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/find-places.ts apps/ui/src/lib/find-search.ts apps/ui/src/components/index-page apps/ui/src/lib/__tests__
git commit -m "feat(ui): let Find libraries filter by area and by source dataset"
```

---

### Task 8: Region pages count gaps with Meilisearch

**Files:**

- Modify: `apps/ui/src/lib/find-search.ts` (new `placeGapCounts`)
- Modify: `apps/ui/src/app/[locale]/[continent]/[country]/[region]/page.tsx` (fetches the counts)
- Modify: `apps/ui/src/components/region/RegionDetailPage.tsx` (uses them)
- Tests: `apps/ui/src/lib/__tests__/` (the `placeGapCounts` maths) and the region page helpers tests if the help-body logic moves into a helper

**Interfaces:**

- Produces: `placeGapCounts(level: FindPlaceLevel, slug: string, locale?: string): Promise<{ total: number; gaps: Partial<Record<GapKey, number>> }>`. It runs one `limit: 0` search with facets `["needs", "locale"]`, filtered by the place and the search locale. `total` comes from the `locale` facet (`countOf`); `gaps` is the `needs` distribution filtered by `isGapKey`.
- `RegionDetailPage` gets a new prop `gapCounts: { total: number; gaps: Partial<Record<GapKey, number>> } | null`.

- [ ] **Step 1: Write the failing test**

Mock `meiliClient` the way the existing find-search tests do (look in `apps/ui/src/lib/__tests__` for how `searchFind` or `libraryTotal` is tested). Assert that `placeGapCounts("region", "new-york", "en")`:

- sends `filter` containing `region_slug = "new-york"` and the locale clause, with `limit: 0` and `facets: ["needs", "locale"]`
- returns `{ total: 1083, gaps: { hours: 1083, photo: 1002 } }` for a mocked `facetDistribution` of `{ locale: { en: 1083 }, needs: { hours: 1083, photo: 1002, bogus: 5 } }`

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run src/lib/__tests__`
Expected: FAIL. `placeGapCounts` doesn't exist.

- [ ] **Step 3: Implement**

- `placeGapCounts` sits next to `libraryTotal` in `find-search.ts`. Wrap the search in `try/catch` and return `null` on failure (widen the return type to include `| null`).
- In the region `page.tsx`, call it with `("region", regionSlug, locale)` alongside the existing fetches, and pass `gapCounts` to `RegionDetailPage`.
- In `RegionDetailPage.tsx`:
  - **Hero stat:** when `gapCounts` is present, "Details still missing" is the sum of `gapCounts.gaps[k]` over the four `GAP_DEFS` keys. It drops the "Across the first N records" note.
  - **Help body:** the "most often X and Y" sentence uses the two `GAP_DEFS` keys with the highest counts in `gapCounts.gaps`. "N of M records here are missing details" becomes "Libraries here are most often missing X and Y", because the facets count gaps, not libraries with gaps.
  - **Fallback:** when `gapCounts` is null (search down), keep today's first-100 computation and note.
  - **Unchanged:** the per-library chips and the `LocationHelpPanel` actions still use the 100 rows.

- [ ] **Step 4: Run the tests, typecheck and check live**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`. Then find a region path with libraries, e.g. `rtk proxy curl -s http://localhost:3000/north-america/united-states/new-york | grep -o "still missing\|Across the first" | sort | uniq -c`.
Expected: "still missing" is present and "Across the first" isn't.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/find-search.ts apps/ui/src/lib/__tests__ 'apps/ui/src/app/[locale]/[continent]/[country]/[region]/page.tsx' apps/ui/src/components/region/RegionDetailPage.tsx
git commit -m "feat(ui): count a region's missing details with search facets"
```

---

### Task 9: "Still right?" on the library page, and its review panel

**Files:**

- Create: `apps/ui/src/components/library/LibraryVerify.tsx` (the confirm panel the drawer shows)
- Create: `apps/ui/src/components/library/verify.logic.ts` (pure: sections available, payload builder, evidence rule)
- Modify: `apps/ui/src/components/library/LibraryCorrection.tsx` (context gains `verify(sections)`; the drawer renders `LibraryVerify` in verify mode; new `OpenVerifyLink`)
- Modify: `apps/ui/src/components/library/LibrarySections.tsx` ("Still right?" in the Visit section for hours, status and address; the "Checked …" line reads `verifiedSections.hours` when present)
- Modify: `apps/ui/src/components/library/LibrarySidebar.tsx` (`LibraryLinksPanel`: "Still right?" for contact when the library has a website, phone or email)
- Create: `apps/ui/src/components/moderation/VerificationPanel.tsx`
- Modify: `apps/ui/src/app/[locale]/contribute/moderation/[documentId]/page.tsx` (`PANELS.correction`: `kind === "verify"` → `VerificationPanel`)
- Tests: `apps/ui/src/components/library/__tests__/verify.logic.test.ts`, `apps/ui/src/components/library/__tests__/LibraryVerify.test.ts`, `apps/ui/src/components/moderation/__tests__/VerificationPanel.test.ts`

**Interfaces:**

- Consumes: Strapi's verify kind (Task 3). The submission body:

```ts
{
  submissionType: "correction",
  targetEntityType: "library",
  targetSlug,
  fields: { kind: "verify", sections, libraryName },
  evidenceUrl?,
  evidenceType: "other" | "on_site_visit",
}
```

`on_site_visit` is used when "I checked in person" is ticked; otherwise `other`, with `evidenceUrl` required.

- The moderation detail's `review` for a verify is `{ sections, current, verifiedSections }` (Task 3 `verifyReview`).
- Produces, from `verify.logic.ts`:
  - `VERIFY_SECTIONS = ["hours", "status", "address", "contact"] as const`
  - `availableSections(library): VerifySection[]`: only sections the library has a value for:
    - hours if `hasOpeningHours`
    - status if `operationalStatus` is set and isn't `"unknown"`
    - address if `streetAddress`
    - contact if any of website, phone or email
  - `verifyPayload({ slug, name, sections, source, inPerson })`: the body above
  - `verifyProblem({ sections, source, inPerson }): string | null`. It returns null when valid. Messages:
    - "Choose at least one section to confirm."
    - "Add the page you checked, or tick “I checked in person”."
    - "The source must be a web address."

- [ ] **Step 1: Write the failing tests**

`verify.logic.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  availableSections,
  verifyPayload,
  verifyProblem,
} from "../verify.logic"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

describe("verify logic", () => {
  it("offers only sections the record has", () => {
    expect(
      availableSections({
        openingTimes: hours,
        operationalStatus: "open",
        phone: "1",
      })
    ).toEqual(["hours", "status", "contact"])
    expect(availableSections({ operationalStatus: "unknown" })).toEqual([])
  })

  it("needs a section and a source or an in-person check", () => {
    expect(verifyProblem({ sections: [], source: "", inPerson: false })).toBe(
      "Choose at least one section to confirm."
    )
    expect(
      verifyProblem({ sections: ["hours"], source: "", inPerson: false })
    ).toBe("Add the page you checked, or tick “I checked in person”.")
    expect(
      verifyProblem({
        sections: ["hours"],
        source: "not a url",
        inPerson: false,
      })
    ).toBe("The source must be a web address.")
    expect(
      verifyProblem({ sections: ["hours"], source: "", inPerson: true })
    ).toBeNull()
  })

  it("builds the verify correction", () => {
    expect(
      verifyPayload({
        slug: "lib",
        name: "Library",
        sections: ["hours"],
        source: "https://lib.example/hours",
        inPerson: false,
      })
    ).toEqual({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: "lib",
      fields: { kind: "verify", sections: ["hours"], libraryName: "Library" },
      evidenceType: "other",
      evidenceUrl: "https://lib.example/hours",
    })
    expect(
      verifyPayload({
        slug: "lib",
        name: "Library",
        sections: ["status"],
        source: "",
        inPerson: true,
      })
    ).toMatchObject({ evidenceType: "on_site_visit" })
  })
})
```

`LibraryVerify.test.ts` (happy-dom; mock `fetch` and the session as the other component tests in this folder do). Render `LibraryVerify` for a library with hours and a website:

- It shows checkboxes "Opening hours" and "Contact details", both ticked by default.
- "Send" without a source or the in-person tick shows the second message, in an element with `role="alert"`.
- With the in-person box ticked, "Send" POSTs `/api/submissions` with `fields.kind === "verify"`, then shows "Thanks. A Moderator will check it."

`VerificationPanel.test.ts`: given `fields: { kind: "verify", sections: ["hours", "contact"] }` and `review: { current: { website: "https://x", openingTimes: hours }, verifiedSections: { hours: "2025-01-01T00:00:00.000Z" } }`, it renders:

- a heading "Confirms these are still right"
- "Opening hours" with the live hours, using the existing `LibraryHoursTable` or a compact summary
- "Previously checked 1 Jan 2025"
- "Contact details" with `https://x`

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/ui && npx vitest run src/components/library/__tests__/verify.logic.test.ts src/components/library/__tests__/LibraryVerify.test.ts src/components/moderation/__tests__/VerificationPanel.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

**`verify.logic.ts`:** pure functions as specified. Import `hasOpeningHours` from `@repo/shared-data`. Accept a URL with `/^https?:\/\//i.test(source.trim())`. The section labels are:

- hours: "Opening hours"
- status: "Open or closed"
- address: "Address"
- contact: "Contact details"

**`LibraryVerify.tsx`** (client):

- A form in the drawer, titled "Is this still right?", with the lead "Confirm what you’ve checked. A Moderator reviews it, then it shows as checked today."
- One checkbox per available section, labelled with the section label and a one-line current value:
  - hours: "Mon 09:00–17:00 …", using the existing hours summary helper in `library-page.helpers.ts` (or the first two open days)
  - status: the status label
  - address: the street address and city
  - contact: the website host, or else the phone or email
- A "Where did you check?" input (the same style as the wizard's Source field) and an "I checked in person" checkbox.
- Errors from `verifyProblem` go in a `role="alert"` paragraph.
- **Send** POSTs `verifyPayload(...)` to `/api/submissions`. On a 401, show "Sign in to confirm" with a link to `/auth/signin?callbackUrl=<this page>`. On success, show "Thanks. A Moderator will check it." and a Close button.
- Use the drawer's existing button styles. Colours come from `T`.

**`LibraryCorrection.tsx`:**

- The provider's state becomes `{ category: string | null } | { verify: VerifySection[] } | null`.
- The context gains `verify(sections: VerifySection[])`. `useCorrectionDrawer()` returns `{ open, verify }`, with a no-op `verify` in the fallback.
- When the state is a verify, the drawer renders `<LibraryVerify library={library} initial={sections} onDone={close} />` instead of `ContributionWizard`. Keep the drawer chrome: title "Still right?", the close button and focus handling.
- Add `OpenVerifyLink({ sections, children, className })`, a button styled like `OpenCorrectionLink` that calls `verify(sections)`.

**`LibrarySections.tsx` (`LibraryVisitSection`):**

- Next to the existing hours actions, add `<OpenVerifyLink sections={["hours", "status"]}>Still right?</OpenVerifyLink>` when the library has hours.
- Next to the address when there is one: `sections={["address"]}`.
- The "Checked {date}" text uses `verifiedSections.hours` when it's a string, else `lastVerifiedAt` as today.

**`LibrarySidebar.tsx` (`LibraryLinksPanel`):** when the library has a website, phone or email, add a small `OpenVerifyLink sections={["contact"]}` at the foot of the panel: "Still right?".

**`VerificationPanel.tsx`:** follow the structure of `FacilitiesPanel.tsx` (same file style and props pattern: `{ fields, review }`). For each confirmed section, list the label, its live value from `review.current`, and "Previously checked {date}" from `review.verifiedSections`, or else "Not checked before". Show the evidence the same way other panels do; check how the review page passes `evidenceUrl`/`evidenceType` and reuse it, showing "Checked in person" for `on_site_visit`.

**Review page `PANELS.correction`:** add `if (d.fields?.kind === "verify") return <VerificationPanel fields={d.fields} review={d.review} />` before the facilities branch.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`
Expected: all pass; only the two known tsc errors.

- [ ] **Step 5: Check it end to end**

With Strapi running (plugins built in Task 3), sign in locally and send a verify, then approve it. The moderator fixture is in the git-ignored `qa/tests/playwright/TEST-USERS.local.md`: read it, don't paste from it. If you can't drive a browser session, check the POST with a unit-level fetch mock only, and say in the report that the live round trip was not run.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/library apps/ui/src/components/moderation 'apps/ui/src/app/[locale]/contribute/moderation/[documentId]/page.tsx'
git commit -m "feat(ui): let readers confirm a library's details are still right"
```

---

### Task 10: Vocabulary, docs and the Knowledge note

**Files:**

- Modify: `CONTEXT.md` (new terms: **Gap**, **Verification**; Avoid lists)
- Modify: `CLAUDE.md`:
  - the Library schema table: `gaps` and `verifiedSections` rows
  - the Scale target bullet on the index's derived fields: `needs` now lists every gap key
  - Development Notes: shared-data must be rebuilt after edits
- Modify: `docs/community-and-points-system.md`, `docs/user-touchpoints.md` (record corrections score 5/15; verify confirmations)

- [ ] **Step 1: Write the entries**

CONTEXT.md:

```markdown
**Gap**:
A record section a Library lacks, as `packages/shared-data/gaps.ts` defines it: photo, hours, address, location, facilities, about, history, contact (the eight completeness sections), accessibility and services. Strapi stores each library's gaps beside its completeness; the search index's `needs` is that list.
_Avoid_: missing field, hole, need (in prose)

**Verification**:
A Submission (`correction` with `kind: "verify"`) confirming that some of a Library's sections (hours, status, address, contact) are still right, without changing them. Approval stamps each section in `verifiedSections`; an approved edit stamps the sections it sets. `lastVerifiedAt` is the latest stamp.
_Avoid_: check-in, confirmation (as a type name)
```

Follow the file's existing format exactly (bold term, colon, definition, `_Avoid_:` line) and its placement order.

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md CLAUDE.md docs/community-and-points-system.md docs/user-touchpoints.md
git commit -m "docs: describe gaps, verification and the new scoring"
```
