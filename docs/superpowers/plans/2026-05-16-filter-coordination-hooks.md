# Filter Coordination Hooks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the repeated array-toggle pattern and the geo-lookup debounce into two shared hooks — `useFilters<T>` and `useGeoLookup` — so Library index and Events pages compose from the same primitives, and the same logic is never duplicated.

**Architecture:** `useFilters<T>` owns array toggling and page-reset-on-change only. URL sync stays in page components. `useGeoLookup` owns the 600ms debounce and Nominatim call; any component that needs "find nearby" composes it. Both hooks live in `apps/ui/src/hooks/`. The five identical toggle functions in `LibraryIndexSidebar` and the duplicated geo-debounce in `LibraryIndexGrid` and `EventsProgrammePage` are replaced with calls to these hooks.

**Tech Stack:** React 19, TypeScript, Vitest, `@testing-library/react`.

---

## File Map

| Action | Path                                                           | Responsibility                                      |
| ------ | -------------------------------------------------------------- | --------------------------------------------------- |
| Create | `apps/ui/src/hooks/useFilters.ts`                              | Generic array-toggle + page-reset state transitions |
| Create | `apps/ui/src/hooks/useGeoLookup.ts`                            | Debounced Nominatim geo-lookup                      |
| Create | `apps/ui/src/hooks/__tests__/useFilters.test.ts`               | Toggle, reset, and page-reset assertions            |
| Create | `apps/ui/src/hooks/__tests__/useGeoLookup.test.ts`             | Debounce and result-callback assertions             |
| Modify | `apps/ui/src/components/library-index/LibraryIndexSidebar.tsx` | Replace 5 toggle functions with `useFilters`        |
| Modify | `apps/ui/src/components/library-index/LibraryIndexGrid.tsx`    | Replace inline geo-debounce with `useGeoLookup`     |
| Modify | `apps/ui/src/components/events/EventsProgrammePage.tsx`        | Replace inline geo-debounce with `useGeoLookup`     |

---

### Task 1: Create `useFilters` with failing tests

**Files:**

- Create: `apps/ui/src/hooks/__tests__/useFilters.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/ui/src/hooks/__tests__/useFilters.test.ts
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DEFAULT_FILTERS } from "@/components/library-index/types"
import { useFilters } from "@/hooks/useFilters"

describe("useFilters — toggleArrayItem", () => {
  it("adds a value to an empty array and resets page to 0", () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useFilters(DEFAULT_FILTERS, onChange))
    act(() => result.current.toggleArrayItem("libraryTypes", "National", true))
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      libraryTypes: ["National"],
      page: 0,
    })
  })

  it("removes a value from the array and resets page to 0", () => {
    const onChange = vi.fn()
    const base = { ...DEFAULT_FILTERS, libraryTypes: ["National", "Public"] }
    const { result } = renderHook(() => useFilters(base, onChange))
    act(() => result.current.toggleArrayItem("libraryTypes", "National", false))
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: ["Public"],
      page: 0,
    })
  })

  it("does not add a duplicate value", () => {
    const onChange = vi.fn()
    const base = { ...DEFAULT_FILTERS, libraryTypes: ["National"] }
    const { result } = renderHook(() => useFilters(base, onChange))
    act(() => result.current.toggleArrayItem("libraryTypes", "National", true))
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: ["National"],
      page: 0,
    })
  })
})

describe("useFilters — toggleArrayItems (group toggle)", () => {
  it("adds multiple values at once and resets page", () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useFilters(DEFAULT_FILTERS, onChange))
    act(() =>
      result.current.toggleArrayItems(
        "libraryTypes",
        ["National", "Public"],
        true
      )
    )
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      libraryTypes: ["National", "Public"],
      page: 0,
    })
  })

  it("removes multiple values at once and resets page", () => {
    const onChange = vi.fn()
    const base = {
      ...DEFAULT_FILTERS,
      libraryTypes: ["National", "Public", "Academic"],
    }
    const { result } = renderHook(() => useFilters(base, onChange))
    act(() =>
      result.current.toggleArrayItems(
        "libraryTypes",
        ["National", "Public"],
        false
      )
    )
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: ["Academic"],
      page: 0,
    })
  })
})

describe("useFilters — resetFields", () => {
  it("merges partial reset and resets page", () => {
    const onChange = vi.fn()
    const base = {
      ...DEFAULT_FILTERS,
      libraryTypes: ["National"],
      statuses: ["open"],
    }
    const { result } = renderHook(() => useFilters(base, onChange))
    act(() =>
      result.current.resetFields({
        libraryTypes: [],
        statuses: [],
        featured: false,
        accessibilityNames: [],
        serviceNames: [],
        operatorTypes: [],
      })
    )
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: [],
      statuses: [],
      featured: false,
      accessibilityNames: [],
      serviceNames: [],
      operatorTypes: [],
      page: 0,
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd apps/ui && pnpm test src/hooks/__tests__/useFilters.test.ts
```

Expected: FAIL — `@/hooks/useFilters` module not found.

---

### Task 2: Implement `useFilters`

**Files:**

- Create: `apps/ui/src/hooks/useFilters.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/ui/src/hooks/useFilters.ts
interface FilterStateBase {
  page: number
}

export function useFilters<T extends FilterStateBase>(
  filters: T,
  onChange: (next: T) => void
) {
  function toggleArrayItem(key: keyof T, value: string, checked: boolean) {
    const current = (filters[key] as string[]) ?? []
    const next = checked
      ? [...new Set([...current, value])]
      : current.filter((v) => v !== value)
    onChange({ ...filters, [key]: next, page: 0 })
  }

  function toggleArrayItems(key: keyof T, values: string[], checked: boolean) {
    const current = (filters[key] as string[]) ?? []
    const next = checked
      ? [...new Set([...current, ...values])]
      : current.filter((v) => !values.includes(v))
    onChange({ ...filters, [key]: next, page: 0 })
  }

  function resetFields(partial: Partial<T>) {
    onChange({ ...filters, ...partial, page: 0 })
  }

  return { toggleArrayItem, toggleArrayItems, resetFields }
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd apps/ui && pnpm test src/hooks/__tests__/useFilters.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/hooks/useFilters.ts apps/ui/src/hooks/__tests__/useFilters.test.ts
git commit -m "feat(hooks): add useFilters generic array-toggle hook"
```

---

### Task 3: Create `useGeoLookup` with failing tests

**Files:**

- Create: `apps/ui/src/hooks/__tests__/useGeoLookup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/ui/src/hooks/__tests__/useGeoLookup.test.ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockGeocodePlaceName = vi.fn()
vi.mock("@/lib/geo-lookup", () => ({
  geocodePlaceName: mockGeocodePlaceName,
}))

const { useGeoLookup } = await import("@/hooks/useGeoLookup")

beforeEach(() => {
  vi.useFakeTimers()
  mockGeocodePlaceName.mockResolvedValue({
    lat: 51.5,
    lng: -0.1,
    countryCode: "GB",
    countrySlug: "united-kingdom",
    continentSlug: "europe",
    displayName: "London, England, UK",
  })
})

afterEach(() => {
  vi.useRealTimers()
  mockGeocodePlaceName.mockReset()
})

describe("useGeoLookup", () => {
  it("does not call geocoder when query is shorter than minLength", async () => {
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("Lo", onResult))
    await act(() => vi.runAllTimersAsync())
    expect(mockGeocodePlaceName).not.toHaveBeenCalled()
  })

  it("calls geocoder after debounce with query of sufficient length", async () => {
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("London", onResult))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(mockGeocodePlaceName).toHaveBeenCalledWith("London")
  })

  it("calls onResult with the geocoder result", async () => {
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("London", onResult))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ countrySlug: "united-kingdom" })
    )
  })

  it("does not call onResult when geocoder returns null", async () => {
    mockGeocodePlaceName.mockResolvedValue(null)
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("nowhere", onResult))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(onResult).not.toHaveBeenCalled()
  })

  it("debounces — only fires once if query changes rapidly", async () => {
    const onResult = vi.fn()
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useGeoLookup(q, onResult),
      { initialProps: { q: "Lon" } }
    )
    rerender({ q: "Lond" })
    rerender({ q: "Londo" })
    rerender({ q: "London" })
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(mockGeocodePlaceName).toHaveBeenCalledTimes(1)
    expect(mockGeocodePlaceName).toHaveBeenCalledWith("London")
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd apps/ui && pnpm test src/hooks/__tests__/useGeoLookup.test.ts
```

Expected: FAIL — `@/hooks/useGeoLookup` module not found.

---

### Task 4: Implement `useGeoLookup`

**Files:**

- Create: `apps/ui/src/hooks/useGeoLookup.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/ui/src/hooks/useGeoLookup.ts
import { useEffect, useRef } from "react"

import { geocodePlaceName, type GeoResult } from "@/lib/geo-lookup"

interface UseGeoLookupOptions {
  debounceMs?: number
  minLength?: number
}

export function useGeoLookup(
  query: string,
  onResult: (result: GeoResult) => void,
  options: UseGeoLookupOptions = {}
) {
  const { debounceMs = 600, minLength = 3 } = options
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    if (q.length < minLength) return
    debounce.current = setTimeout(async () => {
      const result = await geocodePlaceName(q)
      if (result) onResult(result)
    }, debounceMs)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd apps/ui && pnpm test src/hooks/__tests__/useGeoLookup.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/hooks/useGeoLookup.ts apps/ui/src/hooks/__tests__/useGeoLookup.test.ts
git commit -m "feat(hooks): add useGeoLookup debounced geo-lookup hook"
```

---

### Task 5: Refactor `LibraryIndexSidebar` to use `useFilters`

**Files:**

- Modify: `apps/ui/src/components/library-index/LibraryIndexSidebar.tsx`

- [ ] **Step 1: Add `useFilters` import at the top of `LibraryIndexSidebar.tsx`**

```typescript
import { useFilters } from "@/hooks/useFilters"
```

- [ ] **Step 2: Add hook instantiation at the top of the component body (after the props destructuring)**

```typescript
const { toggleArrayItem, toggleArrayItems, resetFields } = useFilters(
  filters,
  onChange
)
```

- [ ] **Step 3: Delete the five toggle functions and `resetAll` (lines 263–318)**

Remove these functions entirely:

```typescript
function isGroupChecked(types: string[]): boolean { ... }
function toggleGroup(types: string[], checked: boolean) { ... }
function toggleStatus(value: string, checked: boolean) { ... }
function toggleAccessibility(value: string, checked: boolean) { ... }
function toggleService(value: string, checked: boolean) { ... }
function toggleOperator(value: string, checked: boolean) { ... }
const resetAll = () => onChange({ ... })
```

- [ ] **Step 4: Replace each call site in the JSX**

| Old call                              | New call                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `toggleGroup(types, checked)`         | `toggleArrayItems("libraryTypes", types, checked)`                                                                              |
| `isGroupChecked(types)`               | `types.every((t) => filters.libraryTypes.includes(t))`                                                                          |
| `toggleStatus(value, checked)`        | `toggleArrayItem("statuses", value, checked)`                                                                                   |
| `toggleAccessibility(value, checked)` | `toggleArrayItem("accessibilityNames", value, checked)`                                                                         |
| `toggleService(value, checked)`       | `toggleArrayItem("serviceNames", value, checked)`                                                                               |
| `toggleOperator(value, checked)`      | `toggleArrayItem("operatorTypes", value, checked)`                                                                              |
| `resetAll()`                          | `resetFields({ libraryTypes: [], statuses: [], featured: false, accessibilityNames: [], serviceNames: [], operatorTypes: [] })` |

- [ ] **Step 5: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexSidebar.tsx
git commit -m "refactor(library-index): replace 5 toggle functions with useFilters hook"
```

---

### Task 6: Replace geo-debounce in `LibraryIndexGrid` with `useGeoLookup`

**Files:**

- Modify: `apps/ui/src/components/library-index/LibraryIndexGrid.tsx`

- [ ] **Step 1: Add `useGeoLookup` import**

```typescript
import { useGeoLookup } from "@/hooks/useGeoLookup"
```

- [ ] **Step 2: Remove the `geoDebounce` ref declaration (line 40)**

Delete:

```typescript
const geoDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
```

- [ ] **Step 3: Remove the geo-lookup `useEffect` block (lines 131–151) and replace with the hook**

Delete:

```typescript
useEffect(() => {
  if (filters.nearLat != null) return
  if (geoDebounce.current) clearTimeout(geoDebounce.current)
  const q = filters.query.trim()
  if (q.length < 3) return
  geoDebounce.current = setTimeout(async () => {
    const result = await geocodePlaceName(q)
    if (!result) return
    if (!result.continentSlug && !result.countrySlug) return
    onFiltersChange({
      ...filters,
      continentSlug: result.continentSlug ?? filters.continentSlug,
      countrySlug: result.countrySlug ?? filters.countrySlug,
      page: 0,
    })
  }, 600)
  return () => {
    if (geoDebounce.current) clearTimeout(geoDebounce.current)
  }
}, [filters.query]) // eslint-disable-line react-hooks/exhaustive-deps
```

Add the hook call (place it near the other hooks, after the `useEffect` for search):

```typescript
useGeoLookup(filters.nearLat != null ? "" : filters.query, (result) => {
  if (!result.continentSlug && !result.countrySlug) return
  onFiltersChange({
    ...filters,
    continentSlug: result.continentSlug ?? filters.continentSlug,
    countrySlug: result.countrySlug ?? filters.countrySlug,
    page: 0,
  })
})
```

- [ ] **Step 4: Remove `geocodePlaceName` import (it's no longer called directly)**

Delete this import line:

```typescript
import { geocodePlaceName } from "@/lib/geo-lookup"
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexGrid.tsx
git commit -m "refactor(library-index): replace inline geo-debounce with useGeoLookup"
```

---

### Task 7: Replace geo-debounce in `EventsProgrammePage` with `useGeoLookup`

**Files:**

- Modify: `apps/ui/src/components/events/EventsProgrammePage.tsx`

- [ ] **Step 1: Add `useGeoLookup` import**

```typescript
import { useGeoLookup } from "@/hooks/useGeoLookup"
```

- [ ] **Step 2: Remove the `geoDebounce` ref (line 50)**

Delete:

```typescript
const geoDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
```

- [ ] **Step 3: Remove the geo-lookup `useEffect` block (lines 54–70) and replace with the hook**

Delete:

```typescript
useEffect(() => {
  if (geoDebounce.current) clearTimeout(geoDebounce.current)
  const q = filters.search.trim()
  if (q.length < 3 || filters.countryCode) return
  geoDebounce.current = setTimeout(async () => {
    const result = await geocodePlaceName(q)
    if (!result?.countryCode) return
    setFilters((prev) => ({
      ...prev,
      countryCode: result.countryCode!,
      page: 1,
    }))
  }, 600)
  return () => {
    if (geoDebounce.current) clearTimeout(geoDebounce.current)
  }
}, [filters.search]) // eslint-disable-line react-hooks/exhaustive-deps
```

Add the hook call after the `useState` declarations:

```typescript
useGeoLookup(filters.countryCode ? "" : filters.search, (result) => {
  if (!result.countryCode) return
  setFilters((prev) => ({ ...prev, countryCode: result.countryCode!, page: 1 }))
})
```

- [ ] **Step 4: Remove unused imports**

Remove `useEffect`, `useRef`, and `geocodePlaceName` from imports if no longer used elsewhere in the file. Check the full file before removing `useEffect` — it may be used in other places.

- [ ] **Step 5: Typecheck**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 6: Run full test suite**

```bash
cd apps/ui && pnpm test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/ui/src/components/events/EventsProgrammePage.tsx
git commit -m "refactor(events): replace inline geo-debounce with useGeoLookup"
```

---

## Self-Review

**Spec coverage:**

- ✅ `useFilters<T>` generic hook with array toggling and page-reset
- ✅ `useGeoLookup` debounced geo-lookup hook, composable
- ✅ URL sync stays in page components (untouched)
- ✅ Serialisation helpers stay in feature-specific types files (untouched)
- ✅ Library index sidebar toggle functions replaced
- ✅ Geo-debounce replaced in both `LibraryIndexGrid` and `EventsProgrammePage`
- ✅ Both hooks are independently testable

**Placeholder scan:** None found.

**Type consistency:** `FilterStateBase` constraint requires `page: number` — matches both `LibraryIndexFilterState` (page: 0) and events `FilterState` (page: 1). Array keys are typed via `keyof T` — safe.
