# Library Search Module Deepening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `LibrarySearchParams` middleman — `searchLibraries` accepts `LibraryIndexFilterState` directly, and `LibraryIndexGrid` passes `filters` without a manual mapping shim.

**Architecture:** `LibrarySearchParams` duplicates `LibraryIndexFilterState` with renamed fields. `LibraryIndexGrid` currently does an 18-line manual mapping between them. Eliminating `LibrarySearchParams` and updating `searchLibraries` to accept `LibraryIndexFilterState` directly removes the duplication and hides the MeiliSearch field-name differences from callers. The 0→1 page offset translation stays hidden inside `searchLibraries` as before.

**Tech Stack:** TypeScript, MeiliSearch JS SDK (`meilisearch`), Vitest, React.

---

## File Map

| Action | Path                                                        | Responsibility                                                                             |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Modify | `apps/ui/src/lib/meilisearch.ts`                            | Remove `LibrarySearchParams`; update `searchLibraries` to accept `LibraryIndexFilterState` |
| Modify | `apps/ui/src/components/library-index/LibraryIndexGrid.tsx` | Replace 18-line mapping shim with `searchLibraries(filters)`                               |
| Create | `apps/ui/src/lib/__tests__/meilisearch.test.ts`             | Unit tests for filter building and page offset                                             |

---

### Task 1: Write failing tests for `searchLibraries`

**Files:**

- Create: `apps/ui/src/lib/__tests__/meilisearch.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// apps/ui/src/lib/__tests__/meilisearch.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSearch = vi.fn().mockResolvedValue({
  hits: [],
  totalHits: 0,
  estimatedTotalHits: 0,
  facetDistribution: {},
})

vi.mock("meilisearch", () => ({
  Meilisearch: vi.fn(() => ({
    index: () => ({ search: mockSearch }),
  })),
}))

// Must import AFTER mock is declared so the singleton picks up the mock
const { searchLibraries } = await import("@/lib/meilisearch")
const { DEFAULT_FILTERS } = await import("@/components/library-index/types")

beforeEach(() => {
  mockSearch.mockClear()
})

describe("searchLibraries", () => {
  it("translates 0-indexed page to MeiliSearch 1-indexed page", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, page: 0 })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ page: 1 })
    )
  })

  it("translates page 2 to MeiliSearch page 3", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, page: 2 })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ page: 3 })
    )
  })

  it("builds libraryType filter from libraryTypes array", async () => {
    await searchLibraries({
      ...DEFAULT_FILTERS,
      libraryTypes: ["National", "Public"],
    })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining(
          'libraryType IN ["National", "Public"]'
        ),
      })
    )
  })

  it("builds operationalStatus filter from statuses array", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, statuses: ["open"] })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining('operationalStatus IN ["open"]'),
      })
    )
  })

  it("wraps single continentSlug in geo filter", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, continentSlug: "europe" })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining('continent_slug IN ["europe"]'),
      })
    )
  })

  it("adds _geoRadius filter when nearLat and nearLng are set", async () => {
    await searchLibraries({ ...DEFAULT_FILTERS, nearLat: 51.5, nearLng: -0.1 })
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        filter: expect.stringContaining("_geoRadius(51.5, -0.1,"),
      })
    )
  })

  it("produces no filter string when all filters are empty", async () => {
    await searchLibraries(DEFAULT_FILTERS)
    expect(mockSearch).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ filter: undefined })
    )
  })
})
```

- [ ] **Step 2: Run tests — confirm they all fail (function signature mismatch)**

```bash
cd apps/ui && pnpm test src/lib/__tests__/meilisearch.test.ts
```

Expected: FAIL — `searchLibraries` currently expects `LibrarySearchParams`, not `LibraryIndexFilterState`.

---

### Task 2: Update `searchLibraries` to accept `LibraryIndexFilterState`

**Files:**

- Modify: `apps/ui/src/lib/meilisearch.ts`

- [ ] **Step 1: Add import for `LibraryIndexFilterState` at the top of `meilisearch.ts`**

```typescript
import type { LibraryIndexFilterState } from "@/components/library-index/types"
```

- [ ] **Step 2: Delete the `LibrarySearchParams` interface (lines 42–63)**

Remove this block entirely:

```typescript
export interface LibrarySearchParams {
  query?: string
  libraryTypes?: string[]
  operationalStatuses?: string[]
  continentSlugs?: string[]
  countrySlugs?: string[]
  regionSlugs?: string[]
  areaSlugs?: string[]
  featured?: boolean
  accessibilityNames?: string[]
  serviceNames?: string[]
  operatorTypes?: string[]
  sort?: "name:asc" | "name:desc" | "featured:desc,name:asc"
  page?: number
  hitsPerPage?: number
  withFacets?: boolean
  nearLat?: number
  nearLng?: number
  nearRadius?: number
}
```

- [ ] **Step 3: Replace the `searchLibraries` signature and destructuring**

Replace the current function signature and destructuring (lines 67–87) with:

```typescript
export async function searchLibraries(
  filters: LibraryIndexFilterState,
  options: { hitsPerPage?: number; withFacets?: boolean } = {}
) {
  const {
    query,
    libraryTypes,
    statuses: operationalStatuses,
    continentSlug,
    countrySlug,
    regionSlug,
    areaSlug,
    featured,
    accessibilityNames,
    serviceNames,
    operatorTypes,
    sort,
    page,
    nearLat,
    nearLng,
    nearRadius,
  } = filters

  const { hitsPerPage = 24, withFacets = false } = options

  const continentSlugs = continentSlug ? [continentSlug] : []
  const countrySlugs = countrySlug ? [countrySlug] : []
  const regionSlugs = regionSlug ? [regionSlug] : []
  const areaSlugs = areaSlug ? [areaSlug] : []
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd apps/ui && pnpm test src/lib/__tests__/meilisearch.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/lib/meilisearch.ts apps/ui/src/lib/__tests__/meilisearch.test.ts
git commit -m "refactor(search): searchLibraries accepts LibraryIndexFilterState directly"
```

---

### Task 3: Simplify `LibraryIndexGrid` call site

**Files:**

- Modify: `apps/ui/src/components/library-index/LibraryIndexGrid.tsx`

- [ ] **Step 1: Replace the manual mapping block (lines 90–108) with a direct call**

Replace:

```typescript
searchLibraries({
  query: filters.query,
  libraryTypes: filters.libraryTypes,
  operationalStatuses: filters.statuses,
  continentSlugs: filters.continentSlug ? [filters.continentSlug] : [],
  countrySlugs: filters.countrySlug ? [filters.countrySlug] : [],
  regionSlugs: filters.regionSlug ? [filters.regionSlug] : [],
  areaSlugs: filters.areaSlug ? [filters.areaSlug] : [],
  featured: filters.featured || undefined,
  accessibilityNames: filters.accessibilityNames,
  serviceNames: filters.serviceNames,
  operatorTypes: filters.operatorTypes,
  sort: filters.nearLat != null ? undefined : filters.sort,
  page: filters.page,
  hitsPerPage: PAGE_SIZE,
  nearLat: filters.nearLat,
  nearLng: filters.nearLng,
  nearRadius: filters.nearRadius,
})
```

With:

```typescript
searchLibraries(filters, { hitsPerPage: PAGE_SIZE })
```

- [ ] **Step 2: Remove the now-unused `LibrarySearchParams` import if present**

Check line 12 of `LibraryIndexGrid.tsx` — remove `LibrarySearchParams` from the import if it's listed.

- [ ] **Step 3: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 4: Run the full test suite**

```bash
cd apps/ui && pnpm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexGrid.tsx
git commit -m "refactor(library-index): eliminate LibrarySearchParams mapping shim in grid"
```

---

## Self-Review

**Spec coverage:**

- ✅ `LibrarySearchParams` removed
- ✅ `searchLibraries` accepts `LibraryIndexFilterState` directly
- ✅ Manual mapping shim in `LibraryIndexGrid` eliminated
- ✅ Page offset translation stays hidden inside `searchLibraries`
- ✅ Tests assert filter building and page offset behaviour

**Placeholder scan:** None found.

**Type consistency:** `LibraryIndexFilterState` imported from `@/components/library-index/types` in both `meilisearch.ts` and `LibraryIndexGrid.tsx` — consistent.
