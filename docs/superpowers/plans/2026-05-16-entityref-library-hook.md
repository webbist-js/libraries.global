# Entity Reference — Library Lifecycle Hook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Library Entity Reference auto-generation to the existing `entityRef.ts` lifecycle hook, producing `{continent}:{country}:{region}:{area}:{library}` (5 segments) when a Library belongs to an Area, and `{continent}:{country}:{region}:{library}` (4 segments) otherwise. See ADR-0002 for why Area is included.

**Architecture:** The existing `entityRef.ts` handles Country, Region, and Area via `afterCreate`/`afterUpdate` lifecycle subscribers. Library has direct `continent`, `country`, `region`, and `area` (optional) relations on its schema. Adding Library to `TRACKED_UIDS` and writing a new branch in `computeEntityRef` is the minimal correct change. No other files need touching.

**Tech Stack:** Strapi v5 Document Service API, TypeScript. No automated test framework is configured for Strapi plugins — verification is manual via Strapi admin.

---

## File Map

| Action | Path                                      | Responsibility                                                  |
| ------ | ----------------------------------------- | --------------------------------------------------------------- |
| Modify | `apps/strapi/src/lifeCycles/entityRef.ts` | Add `api::library.library` to tracked UIDs and compute function |

---

### Task 1: Add Library to `TRACKED_UIDS`

**Files:**

- Modify: `apps/strapi/src/lifeCycles/entityRef.ts`

- [ ] **Step 1: Add `"api::library.library"` to the `TrackedUID` union type**

```typescript
type TrackedUID =
  | "api::country.country"
  | "api::region.region"
  | "api::area.area"
  | "api::library.library"
```

- [ ] **Step 2: Add `"api::library.library"` to the `TRACKED_UIDS` array**

```typescript
const TRACKED_UIDS: TrackedUID[] = [
  "api::country.country",
  "api::region.region",
  "api::area.area",
  "api::library.library",
]
```

---

### Task 2: Add Library branch to `computeEntityRef`

**Files:**

- Modify: `apps/strapi/src/lifeCycles/entityRef.ts`

- [ ] **Step 1: Add the Library branch inside `computeEntityRef`, after the existing `api::area.area` block**

Add this block before the closing `} catch {` at line 79:

```typescript
if (uid === "api::library.library") {
  const e = await strapi.documents(uid).findOne({
    documentId,
    fields: ["slug"],
    populate: {
      continent: { fields: ["slug"] },
      country: { fields: ["slug"] },
      region: { fields: ["slug"] },
      area: { fields: ["slug"] },
    } as never,
  })
  const el = e as {
    slug?: string
    continent?: { slug?: string }
    country?: { slug?: string }
    region?: { slug?: string }
    area?: { slug?: string } | null
  } | null

  if (el?.slug && el.continent?.slug && el.country?.slug && el.region?.slug) {
    const parts = [el.continent.slug, el.country.slug, el.region.slug]
    if (el.area?.slug) parts.push(el.area.slug)
    parts.push(el.slug)
    return parts.join(":")
  }
}
```

- [ ] **Step 2: Typecheck the Strapi app**

```bash
cd apps/strapi && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/lifeCycles/entityRef.ts
git commit -m "feat(strapi): auto-generate entityRef for Library on create/update"
```

---

### Task 3: Manual verification

The lifecycle hook fires after every `afterCreate` and `afterUpdate` event on the tracked models. There is no automated test for Strapi lifecycle hooks — verify manually.

- [ ] **Step 1: Start Strapi**

```bash
cd apps/strapi && pnpm dev
```

- [ ] **Step 2: Create or update a test Library in the Strapi admin**

Open `http://127.0.0.1:1337/admin` → Content Manager → Library → create or open an existing Library.

Ensure the Library has:

- A `continent` relation set
- A `country` relation set
- A `region` relation set
- An `area` relation set (for the 5-segment case) OR left blank (for the 4-segment case)

Save the Library.

- [ ] **Step 3: Verify the `entityRef` field was populated**

On the Library record, the `entityRef` field should now contain a colon-separated slug path.

**Expected (with Area):** `europe:united-kingdom:greater-london:camden:barbican-library`
**Expected (without Area):** `europe:united-kingdom:scotland:national-library-of-scotland`

If `entityRef` is still blank or contains the old `GB-BL-001` format, check the Strapi server logs for errors from `maybeUpdateEntityRef`.

- [ ] **Step 4: Test update path — rename the Library slug**

Change the `slug` field on the Library and save. Verify the `entityRef` updates to reflect the new slug.

- [ ] **Step 5: Test a Library without Area**

Open a Library that has no `area` relation set. Save it (or trigger an update). Verify the `entityRef` is a 4-segment path: `{continent}:{country}:{region}:{library}`.

---

## Self-Review

**Spec coverage:**

- ✅ Library added to `TRACKED_UIDS`
- ✅ 5-segment format when Area is present (`continent:country:region:area:library`)
- ✅ 4-segment format when no Area (`continent:country:region:library`)
- ✅ Uses `slug` field at every level (consistent with geographic entities)
- ✅ Silent failure on missing relations preserved (non-critical, matches existing pattern)
- ✅ ADR-0002 respected (Area included when present)

**Placeholder scan:** None found.

**Type consistency:** `TrackedUID` union updated in all three places it appears (type, array, `computeEntityRef` branch) — consistent.
