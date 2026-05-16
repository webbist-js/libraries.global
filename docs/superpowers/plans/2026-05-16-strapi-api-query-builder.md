# Strapi API Query Builder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Strapi filter-building into a shared internal `query-builder` module, use it inside `fetchOneBySlug`, and replace the raw `fetch('/api/regions?...')` in `LibraryIndexGeoFilterBar` with a typed `fetchRegionsByCountry` function that routes through the typed Strapi client.

**Architecture:** `BaseStrapiClient.fetchOneBySlug` currently hard-codes two filter shapes (`{ $eq: slug }` and `{ $null: true }`) inline. Extracting these into `query-builder.ts` gives the codebase one canonical place to express Strapi filter atoms. The `LibraryIndexGeoFilterBar` currently calls a bespoke Next.js API route (`/api/regions`) via a raw `fetch` — a shallow adapter that duplicates auth logic already present in `PublicClient`. Replacing it with `PublicStrapiClient.fetchMany(..., { useProxy: true })` routed through a typed `fetchRegionsByCountry` function removes the raw fetch, the custom route, and the manual URL construction in one stroke. The `/api/public-proxy` route already allows `api/regions`, so no allowlist change is needed.

**Tech Stack:** TypeScript, Next.js 15 App Router, Vitest, MeiliSearch-independent (pure Strapi client layer).

---

## File Map

| Action | Path                                                                | Responsibility                                              |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Create | `apps/ui/src/lib/strapi-api/query-builder.ts`                       | Strapi filter atom helpers (`eqOrNull`, `eqFilter`)         |
| Create | `apps/ui/src/lib/__tests__/strapi-query-builder.test.ts`            | Unit tests for query-builder                                |
| Modify | `apps/ui/src/lib/strapi-api/base.ts`                                | `fetchOneBySlug` calls `eqOrNull` instead of inline ternary |
| Create | `apps/ui/src/lib/strapi-api/content/regions.ts`                     | `fetchRegionsByCountry` — typed, client-safe, proxy-routed  |
| Modify | `apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx` | Use `fetchRegionsByCountry` instead of raw fetch            |
| Delete | `apps/ui/src/app/api/regions/route.ts`                              | Obsolete after GeoFilterBar is migrated                     |

---

### Task 1: Write failing tests for `query-builder`

**Files:**

- Create: `apps/ui/src/lib/__tests__/strapi-query-builder.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// apps/ui/src/lib/__tests__/strapi-query-builder.test.ts
import { describe, expect, it } from "vitest"

import { eqFilter, eqOrNull } from "@/lib/strapi-api/query-builder"

describe("eqOrNull", () => {
  it("returns $eq filter for a non-empty string", () => {
    expect(eqOrNull("foo")).toEqual({ $eq: "foo" })
  })

  it("returns $null filter for empty string", () => {
    expect(eqOrNull("")).toEqual({ $null: true })
  })

  it("returns $null filter for null", () => {
    expect(eqOrNull(null)).toEqual({ $null: true })
  })

  it("returns $null filter for undefined", () => {
    expect(eqOrNull(undefined)).toEqual({ $null: true })
  })
})

describe("eqFilter", () => {
  it("returns $eq filter", () => {
    expect(eqFilter("bar")).toEqual({ $eq: "bar" })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail (module not found)**

```bash
cd apps/ui && pnpm test src/lib/__tests__/strapi-query-builder.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/strapi-api/query-builder'`.

---

### Task 2: Create `query-builder.ts` and make tests pass

**Files:**

- Create: `apps/ui/src/lib/strapi-api/query-builder.ts`

- [ ] **Step 1: Create the query-builder module**

```typescript
// apps/ui/src/lib/strapi-api/query-builder.ts

/** Produces `{ $eq: value }` for a non-empty string, or `{ $null: true }` otherwise. */
export function eqOrNull(value: string | null | undefined) {
  return value && value.length > 0 ? { $eq: value } : { $null: true }
}

/** Produces `{ $eq: value }`. */
export function eqFilter(value: string) {
  return { $eq: value }
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd apps/ui && pnpm test src/lib/__tests__/strapi-query-builder.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/lib/strapi-api/query-builder.ts apps/ui/src/lib/__tests__/strapi-query-builder.test.ts
git commit -m "feat(strapi-client): add query-builder module with eqOrNull and eqFilter"
```

---

### Task 3: Use `eqOrNull` inside `fetchOneBySlug`

**Files:**

- Modify: `apps/ui/src/lib/strapi-api/base.ts`

- [ ] **Step 1: Add the import at the top of `base.ts`**

Add this import after the existing import block (before `export const API_ENDPOINTS`):

```typescript
import { eqOrNull } from "@/lib/strapi-api/query-builder"
```

- [ ] **Step 2: Replace the inline ternary in `fetchOneBySlug` (line 211)**

Replace:

```typescript
const slugFilter = slug && slug.length > 0 ? { $eq: slug } : { $null: true }
```

With:

```typescript
const slugFilter = eqOrNull(slug)
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/lib/strapi-api/base.ts
git commit -m "refactor(strapi-client): fetchOneBySlug uses eqOrNull from query-builder"
```

---

### Task 4: Create typed `fetchRegionsByCountry` function

**Files:**

- Create: `apps/ui/src/lib/strapi-api/content/regions.ts`

The public proxy already allows `api/regions` — see `ALLOWED_STRAPI_ENDPOINTS` in `lib/strapi-api/request-auth.ts`. No allowlist changes needed.

- [ ] **Step 1: Create the file**

```typescript
// apps/ui/src/lib/strapi-api/content/regions.ts
import { PublicStrapiClient } from "@/lib/strapi-api"

export interface RegionOption {
  slug: string
  name: string
}

export async function fetchRegionsByCountry(
  countrySlug: string
): Promise<RegionOption[]> {
  try {
    const result = await PublicStrapiClient.fetchMany(
      "api::region.region",
      {
        filters: { country: { slug: { $eq: countrySlug } } },
        fields: ["name", "slug"],
        sort: { name: "asc" },
        pagination: { pageSize: 200 },
      } as never,
      { cache: "force-cache" },
      { useProxy: true }
    )
    return (result.data ?? [])
      .filter(
        (r): r is typeof r & { slug: string; name: string } =>
          typeof r.slug === "string" && typeof r.name === "string"
      )
      .map((r) => ({ slug: r.slug, name: r.name }))
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/strapi-api/content/regions.ts
git commit -m "feat(strapi-client): add fetchRegionsByCountry — typed, proxy-routed"
```

---

### Task 5: Update `LibraryIndexGeoFilterBar` and delete the `/api/regions` route

**Files:**

- Modify: `apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx`
- Delete: `apps/ui/src/app/api/regions/route.ts`

- [ ] **Step 1: Replace the `fetchRegions` helper in `LibraryIndexGeoFilterBar.tsx`**

Remove the `RegionOption` interface (lines 13–16) and the `fetchRegions` function (lines 27–44):

```typescript
// DELETE these lines:
interface RegionOption {
  slug: string
  name: string
}

async function fetchRegions(countrySlug: string): Promise<RegionOption[]> {
  try {
    const res = await fetch(
      `/api/regions?countrySlug=${encodeURIComponent(countrySlug)}`,
      { cache: "force-cache" }
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { name?: string; slug?: string }[]
    }

    return (json.data ?? [])
      .filter((r) => r.slug && r.name)
      .map((r) => ({ slug: r.slug!, name: r.name! }))
  } catch {
    return []
  }
}
```

Replace with this import at the top of the file (after the existing imports):

```typescript
import {
  fetchRegionsByCountry,
  type RegionOption,
} from "@/lib/strapi-api/content/regions"
```

- [ ] **Step 2: Update the `useEffect` that calls `fetchRegions`**

Replace:

```typescript
const load = slug ? fetchRegions(slug) : Promise.resolve([] as RegionOption[])
```

With:

```typescript
const load = slug
  ? fetchRegionsByCountry(slug)
  : Promise.resolve([] as RegionOption[])
```

- [ ] **Step 3: Delete the now-obsolete `/api/regions` route**

```bash
git rm apps/ui/src/app/api/regions/route.ts
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 5: Run the full test suite**

```bash
cd apps/ui && pnpm test
```

Expected: All tests pass (including the query-builder tests from Task 1).

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx
git commit -m "refactor(library-index): GeoFilterBar uses typed fetchRegionsByCountry, delete /api/regions route"
```

---

## Self-Review

**Spec coverage:**

- ✅ `query-builder.ts` created with `eqOrNull` and `eqFilter`
- ✅ `fetchOneBySlug` in `base.ts` uses `eqOrNull` — filter shapes no longer hard-coded inline
- ✅ `fetchRegionsByCountry` created in `content/regions.ts` — typed, proxy-routed, client-safe
- ✅ GeoFilterBar raw `fetch('/api/regions?...')` replaced with typed function call
- ✅ `/api/regions` Next.js route deleted — no duplicate auth/URL logic
- ✅ `useProxy: true` routes through `/api/public-proxy` which already allows `api/regions` in `ALLOWED_STRAPI_ENDPOINTS`

**Placeholder scan:** None found.

**Type consistency:** `RegionOption` defined in `content/regions.ts` and re-imported in `LibraryIndexGeoFilterBar.tsx` — one definition, two consumers.
