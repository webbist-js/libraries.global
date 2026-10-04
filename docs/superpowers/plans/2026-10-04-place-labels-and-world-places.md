# Place labels, Location Request removal and the world place import: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Location Requests and the boundary drill-down map, name each country's Regions and Areas in its own words, and fill the local atlas with every country's Regions and Areas.

**Architecture:** Four workstreams from the spec (`docs/superpowers/specs/2026-10-04-place-labels-and-world-places-design.md`). A and B delete code. C adds two Country fields, one label helper (`placeLabels`) and the places that use it. D is a new ingest under `apps/strapi/scripts/ingests/gazetteer/`: pure planning modules (unit-tested) plus a REST CLI that writes through the existing `StrapiClient`.

**Tech Stack:** Next.js 16 (App Router), Strapi v5 (Document Service, REST), `@repo/access`, Vitest, tsx, Meilisearch, GeoNames dumps.

## Global Constraints

- **Never commit.** The working tree carries other sessions' uncommitted work (`git status` shows ~200 paths, including `submission.ts`, `populate-shapes.ts`, the place controllers, `strapi-client.ts`, `FindFilterSidebar.tsx`, `CLAUDE.md`). Edit only the lines a step names; never revert, reformat or stage anything else. The owner commits.
- Work in the main tree (`/Users/alexbennett/Development/personal/libraries.global`). No worktrees, no side directories.
- Node 22 (`nvm use`), pnpm. Strapi v5: `strapi.documents()` only. After any change under `apps/strapi/src/plugins/content-moderation/`, run `pnpm --filter @repo/strapi build:plugins`.
- No migration files and no redirects (pre-launch). New database indexes go in `HOT_PATH_INDEXES` (`apps/strapi/database/migrations/shared/hot-path-index-sql.js`).
- Region and Area stay the schema and data terms. Place Labels are UI only.
- Scale rules from CLAUDE.md: never load every library; the import loads Regions and Areas (not libraries) and writes with at most 8 requests in flight.
- UI: colours and fonts from `T` (`lib/design-tokens.ts`); status never colour alone. Copy is plain, sentence case, no em dashes in new UI strings.
- Lint (ESLint + SonarJS) and typecheck must stay clean for touched files.

### Commands

| What             | Command (from repo root unless noted)                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Access tests     | `cd packages/access && pnpm test`                                                                                                     |
| Access build     | `pnpm --filter @repo/access build`                                                                                                    |
| Strapi one test  | `cd apps/strapi && npx vitest run tests/<path>`                                                                                       |
| Strapi all tests | `pnpm --filter @repo/strapi test`                                                                                                     |
| Strapi typecheck | `pnpm --filter @repo/strapi typecheck`                                                                                                |
| Plugin build     | `pnpm --filter @repo/strapi build:plugins`                                                                                            |
| Strapi types     | `cd apps/strapi && pnpm strapi ts:generate-types`                                                                                     |
| UI one test      | `cd apps/ui && npx vitest run "<path>"`                                                                                               |
| UI all tests     | `pnpm --filter @repo/ui test`                                                                                                         |
| UI typecheck     | `pnpm --filter @repo/ui typecheck`                                                                                                    |
| Lint one file    | `cd apps/ui && npx eslint -c ./eslint.config.mjs "<path>"` (UI) or `cd apps/strapi && npx eslint -c ../../eslint.config.mjs "<path>"` |

---

## File map

**Workstream A (Location Requests out):** `packages/access/src/capabilities.ts`; content-moderation `server/{content-types/submission/schema.json, services/submission.ts, services/submission-policy.ts, services/notifications.ts, controllers/moderation.ts, utils/params.ts, utils/target-labels.ts, utils/submission-summary.ts, utils/email-templates.ts}`, `admin/src/components/submissionMeta.ts`; UI moderation (`components/moderation/*`, review page, target route), `components/contributions/contributions.ts`, `lib/role-application.ts`, the Index editor files (Task 3), Playwright.

**Workstream B (boundaries out):** UI `components/map/{InteractiveMap.tsx, LibraryPinPanel.tsx, map.types.ts, map.helpers.ts}`, `components/area/AreaDetailPage.tsx`, `lib/strapi-api/{request-auth.ts, cache-tags.ts}`, `public/boundaries/`, `scripts/download-boundaries.mjs`; Strapi place controllers and routes, four schemas, `utils/populate-shapes.ts`, `scripts/{world-countries.ts, populate-world-countries.ts, strapi-client.ts, populate-eu-boundaries.ts}`.

**Workstream C (labels):** Strapi `api/country/content-types/country/schema.json`, `utils/populate-shapes.ts`, region and area `detail` controllers, `config/plugins.ts` (library index); UI `components/location/location-page.helpers.ts`, Country/Region/Area pages, `lib/find-search.ts`, `components/index-page/FindFilterSidebar.tsx`, the place picker (Task 9).

**Workstream D (import):** new `apps/strapi/scripts/ingests/gazetteer/{types.ts, match.ts, slugs.ts, plan.ts, geonames.ts, curated.ts, country-profiles.ts, import.ts, README.md, data/seed-data.json, data/england.json}`; Region and Area schemas (`geonamesId`), `hot-path-index-sql.js`, `src/seeds/datasets.ts`; tests under `apps/strapi/tests/ingests/`.

---

### Task 1: `@repo/access` without Location Requests

**Files:**

- Modify: `packages/access/src/capabilities.ts` (lines 12, 32, 55, 127, 279–280)
- Modify: `packages/access/tests/capabilities.test.ts` (lines ~142–160)

**Interfaces:**

- Produces: `SUBMISSION_TYPES` without `"location_request"`; `Capability` without `"submit.locationRequest"`. Tasks 2 and 3 rely on `"location_request"` no longer type-checking as a `SubmissionType`.

- [ ] **Step 1: Change the tests first**

In `packages/access/tests/capabilities.test.ts`, replace the test `"gives every signed-in user role applications and location requests"` with:

```ts
it("gives every signed-in user role applications", () => {
  const c = resolveCapabilities(input({ grants: [] }))
  expect(c.set.has("submit.roleApplication")).toBe(true)
  expect(canSubmit(c, "role_application")).toBe(true)
  expect(c.moderation).toEqual([])
  expect(c.set.has("moderate.queue")).toBe(false)
})

it("has no Location Request submission type", () => {
  const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
  expect(SUBMISSION_TYPES).not.toContain("location_request")
  expect(canSubmit(c, "location_request" as never)).toBe(false)
})
```

Add `SUBMISSION_TYPES` to the import list from `"../src"` (alphabetical: after `resolveCapabilities`). In the test `"gives signed-out users empty editor locales and no moderation"`, delete the line `expect(canSubmit(c, "location_request")).toBe(false)`.

- [ ] **Step 2: Run them and see the new one fail**

Run: `cd packages/access && npx vitest run tests/capabilities.test.ts`
Expected: FAIL on "has no Location Request submission type" (`SUBMISSION_TYPES` still contains it).

- [ ] **Step 3: Remove the type**

In `packages/access/src/capabilities.ts`:

- delete `"location_request",` from `SUBMISSION_TYPES`;
- delete `location_request: "index",` from `QUEUE_OF_SUBMISSION_TYPE`;
- delete `| "submit.locationRequest"` from `Capability`;
- delete `set.add("submit.locationRequest")` in `resolveCapabilities`;
- delete the two lines `case "location_request":` / `return c.set.has("submit.locationRequest")` in `canSubmit`.

Then `grep -rn "location_request\|locationRequest" packages/access` must print nothing.

- [ ] **Step 4: Run the package tests and build**

Run: `cd packages/access && pnpm test && cd ../.. && pnpm --filter @repo/access build`
Expected: typecheck passes, all tests PASS, build writes `dist/`.

---

### Task 2: Strapi content-moderation without Location Requests

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json`
- Modify: `.../server/utils/params.ts` (lines ~293–434)
- Modify: `.../server/services/submission-policy.ts` (imports, `checkLocationRequest`, the `check()` branch and doc comment)
- Modify: `.../server/services/submission.ts` (imports, `TARGETABLE_TYPES`, `newLibraryHierarchy`, `LOCATION_UIDS`, `uniquePlaceSlug`, `applyLocationRequest`, `WAITING_LIBRARIES_MAX`, `linkWaitingLibraries`, `create()`'s `targetEntityType` spread, the approval branch, `setModeratorTarget`)
- Modify: `.../server/controllers/moderation.ts` (imports, `setTarget`)
- Modify: `.../server/services/notifications.ts`, `.../server/utils/email-templates.ts`, `.../server/utils/target-labels.ts`, `.../server/utils/submission-summary.ts`, `.../admin/src/components/submissionMeta.ts`
- Delete: `apps/strapi/tests/content-moderation/location-request.test.ts`
- Modify: `apps/strapi/tests/content-moderation/moderation-api.test.ts` (~1000–1030), `drafts.test.ts` (~179–220), `target-labels.test.ts`

**Interfaces:**

- Consumes: Task 1 (`location_request` is no longer a `SubmissionType`).
- Produces: `setModeratorTarget(documentId: string, target: ModeratorTarget | undefined)` returning `{ error: "not_found" | "wrong_type" | "not_open" | "conflict" | "tampered" } | { data: { documentId: string; moderatorTarget: ModeratorTarget | null } }`. `PUT /moderation/submissions/:documentId/target` accepts only `continent`, `country`, `region`, `area`. `newLibraryHierarchy` is gone; `libraryHierarchy` (sync) is what approval uses.

`submission.ts` already has uncommitted edits from another session. Change only the blocks below.

- [ ] **Step 1: Delete the Location Request tests and update the rest**

```bash
rm apps/strapi/tests/content-moderation/location-request.test.ts
grep -n "location_request\|moderatorEdit\|locationRequest\|proposedRegion\|typeLabel" apps/strapi/tests/content-moderation/*.test.ts
```

For each hit:

- `moderation-api.test.ts` (~1000–1030): delete the test case(s) that `PUT …/target` with `name`/`typeLabel` or use a `location_request` submission. Keep every place-target test.
- `drafts.test.ts` (~179–220): the test `"create drops moderatorTarget and moderatorEdit from the contributor's draftData"` keeps checking that `moderatorTarget` is dropped; also keep `moderatorEdit` in its input and expect it dropped (`withoutModeratorKeys` keeps both keys, see Step 4), so this test needs no change unless it references `location_request`.
- `target-labels.test.ts`: delete any case whose `submissionType` is `"location_request"`.

Add to `moderation-api.test.ts`, inside the `describe` that covers `setTarget` (reuse that block's existing helpers for building a moderator request and a `new_library` submission; copy the shape of the nearest place-target test):

```ts
it("refuses a name or type on the target route", async () => {
  // Build the request exactly as the neighbouring "sets the target" test does,
  // with body { name: "Wessex", typeLabel: "Region" } on a new_library submission.
  // Expect status 400 and an error message containing "Unknown place: name".
})
```

Write the body using the same fixtures as the neighbouring test; the assertion is `expect(ctx.status).toBe(400)` and `expect(JSON.stringify(ctx.body)).toContain("Unknown place: name")`.

- [ ] **Step 2: Run the moderation tests and see the new one fail**

Run: `cd apps/strapi && npx vitest run tests/content-moderation/moderation-api.test.ts`
Expected: FAIL on "refuses a name or type on the target route" (today `name` is accepted for location requests and rejected with a different message for other types).

- [ ] **Step 3: Schema, params, policy**

- `server/content-types/submission/schema.json`: remove `"location_request"` from the `submissionType` enum (and the comma before it).
- `server/utils/params.ts`: delete everything from `/** What a Location Request asks for: a missing Region or Area. */` through the end of `locationEditOf` (the `LOCATION_REQUEST_KINDS`, `LocationRequestKind`, `LOCATION_*` constants, `LOCATION_REQUEST_KEYS`, `LocationRequestFields`, `isLocationRequestKind`, the `trimmed` helper if nothing else uses it, `locationNameProblem`, `locationTypeLabelProblem`, `validateLocationRequestFields`, `LocationEdit`, `locationEditOf`). Before deleting `trimmed` and `isHttpLink`, `grep -n "trimmed(\|isHttpLink(" server/utils/params.ts`: keep any that other code in the file still calls.
- `server/services/submission-policy.ts`: delete `validateLocationRequestFields` from the `../utils/params` import, delete `checkLocationRequest` (its doc comment too), delete the `if (submissionType === "location_request") { … }` block in `check()`, and change that method's `fields` doc comment to `/** The submission's \`fields\`; required for a \`role_application\`. \*/`. Then `grep -n "COUNTRY\|REGION" server/services/submission-policy.ts`: delete the `COUNTRY`/`REGION` constants if nothing else uses them.

- [ ] **Step 4: `submission.ts`**

1. In the `../utils/params` import, remove `isLocationRequestKind`, `type LocationEdit` and `locationEditOf`.
2. Change the `HIERARCHY_KEYS` doc comment to `/** The places a \`new_library\` is filed under. \*/`.
3. Replace `TARGETABLE_TYPES` with:

```ts
/** Submission types a Moderator may set the hierarchy of before approval. */
export const TARGETABLE_TYPES: ReadonlySet<string> = new Set(["new_library"])
```

4. In the `MODERATOR_KEYS` doc comment, replace "so a submitter can't file their own library or rename their own Location Request on approval." with "so a submitter can't file their own library on approval." Keep `MODERATOR_KEYS` as `["moderatorTarget", "moderatorEdit"]`: old drafts may still carry `moderatorEdit`, and it must never reach approval.
5. Delete `newLibraryHierarchy` (with its doc comment), `LOCATION_UIDS`, `uniquePlaceSlug`, `applyLocationRequest`, `WAITING_LIBRARIES_MAX` and `linkWaitingLibraries` (each with its doc comment). Keep `librarySlug` and `uniqueLibrarySlug`.
6. At the call site `const place = await newLibraryHierarchy(strapi, submission)` (~line 1174), write `const place = libraryHierarchy(submission)`.
7. In `create()`, delete `const requestedKind = fields.fields?.kind` and the spread commented `// A location request targets the kind of place it asks for.`
8. Delete the whole `// ── location_request approval ──` block in `updateStatus`.
9. Replace `setModeratorTarget` with:

```ts
  /**
   * Sets (or, with no places, clears) the hierarchy a `new_library` is filed
   * under on approval, as `draftData.moderatorTarget`. Only while the
   * submission is in review. The stored payloadHash is re-pinned in the same
   * compare-and-set: the Moderator's change is part of what is reviewed,
   * never tampering. The caller checks the Moderator's scope and that each
   * id names a record.
   */
  async setModeratorTarget(
    documentId: string,
    target: ModeratorTarget
  ): Promise<
    | {
        error: "not_found" | "wrong_type" | "not_open" | "conflict" | "tampered"
      }
    | {
        data: {
          documentId: string
          moderatorTarget: ModeratorTarget | null
        }
      }
  > {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!submission || submission.status === "draft")
      return { error: "not_found" }
    if (!TARGETABLE_TYPES.has(submission.submissionType))
      return { error: "wrong_type" }
    if (submission.status !== "pending" && submission.status !== "needs_info")
      return { error: "not_open" }
    // Never re-pin a hash the stored content no longer matches: that would
    // launder a tampered payload into a reviewable one.
    if (
      submission.payloadHash &&
      submission.payloadHash !== payloadHash(submission)
    )
      return { error: "tampered" }

    const { moderatorTarget: _previous, ...rest } = asObject(
      submission.draftData
    )
    const draftData: Record<string, unknown> = { ...rest }
    const clean: ModeratorTarget = {}
    for (const k of HIERARCHY_KEYS)
      if (isDocumentId(target[k])) clean[k] = target[k]
    const hasTarget = Object.keys(clean).length > 0
    if (hasTarget) draftData.moderatorTarget = clean
    const next = { ...submission, draftData }

    const { count } = await strapi.db
      .query("plugin::content-moderation.submission")
      .updateMany({
        where: {
          documentId,
          status: submission.status,
          ...(submission.payloadHash
            ? { payloadHash: submission.payloadHash }
            : {}),
        },
        data: {
          draftData,
          // Re-pinned: draftData is hashed, and the Moderator's own change
          // must not make the approval read as `tampered`.
          ...(submission.payloadHash ? { payloadHash: payloadHash(next) } : {}),
        },
      })
    if (count !== 1) return { error: "conflict" }

    return {
      data: { documentId, moderatorTarget: hasTarget ? clean : null },
    }
  },
```

Keep the existing `strapi.db.query(...).updateMany` compare-and-set exactly as it was (it is the established CAS pattern in this file). If the original method had more lines after `if (count !== 1) return { error: "conflict" }` than the `return { data: … }`, keep them minus any `moderatorEdit`.

- [ ] **Step 5: Controller, notifications, labels**

- `server/controllers/moderation.ts`: remove `type LocationEdit`, `locationNameProblem` and `locationTypeLabelProblem` from the `../utils/params` import. Replace the body of `setTarget` from `const target: ModeratorTarget = {}` down to the `submissions().setModeratorTarget(` call with:

```ts
const target: ModeratorTarget = {}
for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
  if (!(HIERARCHY_KEYS as readonly string[]).includes(k))
    return fail(ctx, 400, `Unknown place: ${k}`)
  if (v === null || v === undefined || v === "") continue
  if (!isDocumentId(v)) return fail(ctx, 400, `Invalid ${k} id`)
  const key = k as keyof ModeratorTarget
  const found = await strapi
    .documents(HIERARCHY_UIDS[key])
    .findOne({ documentId: v, fields: ["documentId"] as any })
  if (!found) return fail(ctx, 400, `No ${k} with that id`)
  target[key] = v
}

// `{}` clears the place.
const result = await submissions().setModeratorTarget(s.documentId, target)
```

and change the `wrong_type` message to `"Only new libraries take a location."`. Update the route comment above `setTarget` to:

```ts
// PUT /moderation/submissions/:documentId/target
//   { continent?, country?, region?, area? }
// Places set (or, all empty, clear) the hierarchy a new library is filed under.
```

- `server/services/notifications.ts`: `const ALERT_TYPES = new Set(["role_application"])`.
- `server/utils/email-templates.ts`: delete `location_request: "location request",`.
- `server/utils/target-labels.ts`: delete the `case "location_request":` line (keep `case "role_application":` falling through to `return summaryOf(row)`).
- `server/utils/submission-summary.ts` and `admin/src/components/submissionMeta.ts`: delete the `case "location_request": { … }` block; in `admin/src/components/submissionMeta.ts` also delete `location_request: "Location request",` and `location_request: { bg: "success100", text: "success600" },`.

- [ ] **Step 6: Verify nothing is left**

Run: `grep -rn "location_request\|LocationRequest\|locationRequest\|LocationEdit\|locationEditOf\|moderatorEdit" apps/strapi/src --include=*.ts --include=*.tsx --include=*.json | grep -v /dist/`
Expected: only the `MODERATOR_KEYS` line in `submission.ts` (`"moderatorEdit"`) and the drafts test.

- [ ] **Step 7: Tests, typecheck, plugin build**

Run: `cd apps/strapi && npx vitest run tests/content-moderation && cd ../.. && pnpm --filter @repo/strapi typecheck && pnpm --filter @repo/strapi build:plugins`
Expected: all PASS (including "refuses a name or type on the target route"), typecheck clean, plugin builds.

---

### Task 3: UI and Index editor without Location Requests

Runs only after the location-lookup plan (`docs/superpowers/plans/2026-10-04-location-lookup.md`) is fully committed: it edits files that plan created (`location.hierarchy.ts`, `useLocationFill.ts`, `StepLocation.tsx`).

**Files** (all under `apps/ui/src/` unless noted; `W` = `app/[locale]/contribute/index/_components`):

- Delete: `W/LocationRequestForm.tsx`, `W/__tests__/LocationRequestForm.test.ts`, `components/moderation/LocationRequestPanel.tsx`
- Modify: `W/LocationHierarchySelector.tsx`, `W/IndexRecordWizard.tsx`, `W/wizard.types.ts`, `W/location.hierarchy.ts`, `W/__tests__/location.hierarchy.test.ts`, and `W/useLocationFill.ts` / `W/StepLocation.tsx` if Step 1's grep finds proposal fields there
- Modify: `components/moderation/{index.ts, NewLibraryPanel.tsx, submissionMeta.ts}`, `app/[locale]/contribute/moderation/[documentId]/page.tsx`, `app/api/moderation/submissions/[documentId]/target/route.ts`, `components/contributions/contributions.ts`, `lib/role-application.ts`
- Delete: `qa/tests/playwright/e2e/access/location-request.spec.ts`
- Modify: `qa/tests/playwright/e2e/access/role-matrix.spec.ts`, `qa/tests/playwright/helpers/access-fixtures.ts`, `qa/tests/playwright/helpers/strapi-access-writer.cjs` (and whatever calls `removeE2eAreas`)

**Interfaces:**

- Consumes: Tasks 1–2.
- Produces: `FormData` without `proposedRegionName`, `proposedAreaName`, `locationRequestDocumentId`. `HierarchyFill = Pick<FormData, "continentDocumentId" | "countryDocumentId" | "regionDocumentId" | "areaDocumentId" | "country">`. `LocationHierarchySelector({ f, setFormData })` renders four selects and nothing else. `NewLibraryPanel` props: `{ documentId, status, fields, draftData }`.

- [ ] **Step 1: Find every use**

```bash
grep -rnE "location_request|LocationRequest|locationRequest|proposedRegionName|proposedAreaName|pendingLocationRequest" apps/ui/src qa/tests/playwright/e2e qa/tests/playwright/helpers
```

Keep the list; Step 7 must end with this grep printing nothing. (`FindLibraryFirst.tsx`'s own "Not listed?" link, for adding a library that isn't in the index, is unrelated and stays.)

- [ ] **Step 2: Change the hierarchy test first**

In `W/__tests__/location.hierarchy.test.ts`, delete any test about a requested region or area (a form with `proposedRegionName` / `proposedAreaName`) and remove those keys from fixtures. Add:

```ts
it("returns only the hierarchy and the country name", async () => {
  // Reuse this file's existing fetch mock and an address that resolves.
  const fill = await resolveHierarchy(form(), address())
  expect(Object.keys(fill ?? {}).sort()).toEqual([
    "areaDocumentId",
    "continentDocumentId",
    "country",
    "countryDocumentId",
    "regionDocumentId",
  ])
})
```

Use the file's own helpers for `form()`, `address()` and the fetch mock (names may differ; match them).

Run: `cd apps/ui && npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/location.hierarchy.test.ts"`
Expected: FAIL: a moved country still returns `proposedRegionName`, `proposedAreaName` and `locationRequestDocumentId`.

- [ ] **Step 3: Index editor**

- `W/location.hierarchy.ts`: `HierarchyFill` becomes `Pick<FormData, "continentDocumentId" | "countryDocumentId" | "regionDocumentId" | "areaDocumentId" | "country">`. In the `moved` branch drop the three proposal keys. Delete the `requested` constant and use `if (!fill.regionDocumentId)` and `if (fill.regionDocumentId && !fill.areaDocumentId)`. Doc comment: "a different country replaces the selection, as choosing it in the selects would. Region and area are matched by name, only while empty."
- `W/wizard.types.ts`: delete the three fields from `FormData` and from the initial value.
- `W/IndexRecordWizard.tsx`: delete the `LocationRequestsContext` import, the `{/* "Not listed?" … */}` comment, and the `<LocationRequestsContext.Provider value={!improve}>` wrapper (keep its children; remove the matching closing tag).
- `W/LocationHierarchySelector.tsx`: delete the `LocationRequestForm` import, `LocationRequestsContext`, `withoutProposal`, `LINK_BUTTON`, `Proposal`, `requestsOn`, the `asking` state and every `setAsking(null)`, both "Not listed?" buttons, both `<Proposal …>` blocks and the trailing `<LocationRequestForm …>` block. In the four `onChange` handlers spread `...prev` where they spread `withoutProposal(prev)`; the area handler becomes `setFormData((prev) => ({ ...prev, areaDocumentId: v }))`. Drop imports left unused (`Icon`, `createContext`, `useContext`).
- If Step 1 listed `W/useLocationFill.ts` or `W/StepLocation.tsx`, remove the proposal keys there the same way (they only pass `HierarchyFill` through).
- `rm "apps/ui/src/app/[locale]/contribute/index/_components/LocationRequestForm.tsx" "apps/ui/src/app/[locale]/contribute/index/_components/__tests__/LocationRequestForm.test.ts"`

Run the hierarchy test again. Expected: PASS.

- [ ] **Step 4: Moderation UI**

- `rm apps/ui/src/components/moderation/LocationRequestPanel.tsx`; in `components/moderation/index.ts` delete its export line.
- `components/moderation/NewLibraryPanel.tsx`: delete `PROPOSAL_KEYS`, `RequestedPlace`, the `pendingLocationRequest` prop (destructuring, type and the warning `<p>`), `<RequestedPlace … />`, and `listed`; render `<FieldsList fields={fields ?? {}} />`. Doc comment: "A proposed new library: its fields, and where in the atlas it will be filed. While the submission is open the Moderator can change that place (Strapi's `target` route); publishing on approval needs a continent, country and region." Drop helpers and imports left unused.
- `components/moderation/submissionMeta.ts`: delete `pendingLocationRequest` (and its comment) from the detail type, and the `location_request` entries in the label and tint maps.
- Review page `app/[locale]/contribute/moderation/[documentId]/page.tsx`: drop `LocationRequestPanel` from the import; delete `locationParents`, and `country`/`region` from `PanelContext`; in `createdRecord` delete the `location_request` branch and the `kind === "area"` / region labels (only "library" remains); delete the `location_request` entries in `PANELS` and `PANEL_TITLES`; drop `pendingLocationRequest={…}` from `NewLibraryPanel`; replace the `Promise.all([…locationParents…, createdRecord(d)])` with `const created = await createdRecord(d)` and build `panelContext` from `localeNames` only; the "Approval created …" line becomes `Approval created a new library record.` Drop helpers left unused (`asRecord`, `idOf`, `PlaceKind` values).
- `app/api/moderation/submissions/[documentId]/target/route.ts`: `bodyKeys: ["continent", "country", "region", "area"]`; its header comment drops the `{ name?, typeLabel? }` line.
- `components/contributions/contributions.ts`: delete the `location_request` entry. `lib/role-application.ts`: delete `case "location_request": return "Added a place"`.

- [ ] **Step 5: Playwright**

- `rm qa/tests/playwright/e2e/access/location-request.spec.ts`
- `role-matrix.spec.ts`: delete `"submit.locationRequest",` from `ALL_SIGNED_IN`.
- Delete `E2E_AREA_PREFIX` (and its comment) from `helpers/access-fixtures.ts`, `removeE2eAreas` from `helpers/strapi-access-writer.cjs`, and every call to it (`grep -rn "removeE2eAreas\|E2E_AREA_PREFIX" qa/tests/playwright`). Then check the local database for leftovers with the MCP (`list_area` with `filters: { name: { $startsWith: "Access E2E area " } }`) and delete any it lists (`delete_area`).

- [ ] **Step 6: Local data**

Delete any local `location_request` Submissions once. The Submission type is hidden from the MCP, so use psql with the credentials in `apps/strapi/.env`:

```bash
PW=$(grep ^DATABASE_PASSWORD= apps/strapi/.env | cut -d= -f2-)
PGPASSWORD="$PW" psql -h 0.0.0.0 -p 5433 -U admin -d librariesglobal -c "select document_id, status from cm_submissions where submission_type = 'location_request';"
```

(Find the real table name with `\dt *submission*` if `cm_submissions` is wrong.) Show the owner the rows, and delete them (and their review events) only after they agree; do not touch any other row.

- [ ] **Step 7: Verify**

Re-run Step 1's grep. Expected: nothing (old dated specs and plans under `docs/` are history and stay).

Run: `pnpm --filter @repo/ui test && pnpm --filter @repo/ui typecheck`
Expected: PASS, clean.

---

### Task 4: Strapi without map-pins and `boundaryUrl`

**Files:**

- Delete: `apps/strapi/src/api/area/routes/area-custom.ts`
- Modify: `apps/strapi/src/api/{area,region,country,continent,library}/controllers/*.ts` (delete `mapPins`)
- Modify: `apps/strapi/src/api/library/routes/library-map.ts`, `region/routes/region-detail.ts`, `country/routes/country-detail.ts`, `continent/routes/continent-detail.ts`
- Modify: `apps/strapi/src/api/{continent,country,region,area}/content-types/*/schema.json` (drop `boundaryUrl`)
- Modify: `apps/strapi/src/utils/populate-shapes.ts` (four `"boundaryUrl",` lines)
- Move: `apps/ui/public/boundaries/seed-data.json` → `apps/strapi/scripts/ingests/gazetteer/data/seed-data.json` (without `boundaryUrl`)
- Modify: `apps/strapi/scripts/{world-countries.ts, populate-world-countries.ts, strapi-client.ts}`, `apps/strapi/tests/world-countries.test.ts`, `apps/strapi/tests/library-controller.test.ts`
- Delete: `apps/strapi/scripts/populate-eu-boundaries.ts`

**Interfaces:**

- Produces: `SeedCountry` without `boundaryUrl`; `SEED_PATH` in `populate-world-countries.ts` is `path.resolve(__dirname, "ingests/gazetteer/data/seed-data.json")`. Task 5 deletes `apps/ui/public/boundaries/` after this move.

- [ ] **Step 1: Update the tests first**

- `apps/strapi/tests/library-controller.test.ts`: delete the `describe("library.mapPins (E2)", …)` block.
- `apps/strapi/tests/world-countries.test.ts`: delete `boundaryUrl: "/boundaries/continents/europe.geojson",` from the fixture, and in any test that reads the seed from disk change the path to `../scripts/ingests/gazetteer/data/seed-data.json`. Add:

```ts
it("reads the seed from the gazetteer data folder, with no boundary URLs", () => {
  const file = path.resolve(
    __dirname,
    "../scripts/ingests/gazetteer/data/seed-data.json"
  )
  const raw = fs.readFileSync(file, "utf8")
  expect(raw).not.toContain("boundaryUrl")
  const rows = countriesFromSeed(JSON.parse(raw) as Record<string, unknown>)
  expect(rows.length).toBeGreaterThan(200)
})
```

(`fs`, `path` and `countriesFromSeed` are already imported in that file; add any that are missing.)

- [ ] **Step 2: Run and see it fail**

Run: `cd apps/strapi && npx vitest run tests/world-countries.test.ts`
Expected: FAIL: the new seed file doesn't exist yet.

- [ ] **Step 3: Move the seed without boundary URLs**

```bash
mkdir -p apps/strapi/scripts/ingests/gazetteer/data
node -e '
const fs=require("fs");
const src="apps/ui/public/boundaries/seed-data.json";
const out="apps/strapi/scripts/ingests/gazetteer/data/seed-data.json";
const strip=(v)=>Array.isArray(v)?v.map(strip):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).filter(([k])=>k!=="boundaryUrl").map(([k,x])=>[k,strip(x)])):v;
fs.writeFileSync(out, JSON.stringify(strip(JSON.parse(fs.readFileSync(src,"utf8"))), null, 0)+"\n");
'
grep -c boundaryUrl apps/strapi/scripts/ingests/gazetteer/data/seed-data.json || true
```

Expected: `0`. Do not delete the old file here (Task 5 removes the folder).

- [ ] **Step 4: Scripts**

- `scripts/world-countries.ts`: delete `boundaryUrl: string` from `SeedCountry`; change the header comment's path to `scripts/ingests/gazetteer/data/seed-data.json`.
- `scripts/populate-world-countries.ts`: `const SEED_PATH = path.resolve(__dirname, "ingests/gazetteer/data/seed-data.json")`; delete `boundaryUrl?: string | null` from `StrapiCountry`, the `if (isEmpty(row.boundaryUrl)) data.boundaryUrl = seed.boundaryUrl` line, `boundaryUrl: seed.boundaryUrl,` in `createFor`, and `` `boundaryUrl`, `` from the header comment. Change the header's "Reads apps/ui/public/boundaries/seed-data.json" to "Reads scripts/ingests/gazetteer/data/seed-data.json" and the reindex line to `pnpm --filter @repo/strapi seed:meilisearch`.
- `scripts/strapi-client.ts` (has other uncommitted edits; touch only these): delete `boundaryUrl?: string` from `RegionCreateData`, and change `data: Partial<CountryCreateData> & { boundaryUrl?: string }` to `data: Partial<CountryCreateData>`.
- `rm apps/strapi/scripts/populate-eu-boundaries.ts`

- [ ] **Step 5: Routes and controllers**

- `rm apps/strapi/src/api/area/routes/area-custom.ts`
- `library/routes/library-map.ts`: delete the `/libraries/map-pins` route object, keeping `/libraries/atlas`.
- `region/routes/region-detail.ts`, `country/routes/country-detail.ts`, `continent/routes/continent-detail.ts`: delete the `/…/map-pins` route object.
- Controllers: delete the `mapPins` action and its `// ── /…/map-pins ──` comment block in `area.ts`, `region.ts`, `country.ts`, `continent.ts`; in `library.ts` delete `mapPins`, `MAP_PINS_LIMIT` (and its comment) and `MAP_PIN_PARAMS`. Keep `stringQuery` (other actions use it). After each file, run its linter: any import left unused (`MAP_CONFIG_POPULATE`, `readLocale`, …) is removed only if nothing else in the file uses it.

- [ ] **Step 6: Schemas and shapes**

- Remove the `"boundaryUrl": { … }` attribute from `continent`, `country`, `region` and `area` `schema.json`.
- `src/utils/populate-shapes.ts`: delete the four `"boundaryUrl",` entries (in `CONTINENT_FIELDS`, `COUNTRY_FIELDS`, `REGION_FIELDS`, `AREA_FIELDS`).
- Regenerate types: `cd apps/strapi && pnpm strapi ts:generate-types`.

- [ ] **Step 7: Verify**

Run: `grep -rn "boundaryUrl\|map-pins\|mapPins" apps/strapi/src apps/strapi/scripts apps/strapi/tests apps/strapi/config --include=*.ts --include=*.json | grep -v /dist/ | grep -v generated`
Expected: nothing.

Run: `cd apps/strapi && npx vitest run && cd ../.. && pnpm --filter @repo/strapi typecheck`
Expected: PASS, clean.

---

### Task 5: UI without the boundary drill-down

**Files:**

- Delete: `apps/ui/src/components/map/InteractiveMap.tsx`, `apps/ui/src/components/map/LibraryPinPanel.tsx`, `apps/ui/src/components/map/map.types.ts`
- Modify: `apps/ui/src/components/map/map.helpers.ts` (keep `BASEMAP_ATTRIBUTION`, `parseBounds`)
- Modify: `apps/ui/src/components/area/AreaDetailPage.tsx`
- Modify: `apps/ui/src/lib/strapi-api/request-auth.ts`, `apps/ui/src/lib/strapi-api/__tests__/request-auth.test.ts`, `apps/ui/src/lib/strapi-api/cache-tags.ts`
- Delete: `apps/ui/public/boundaries/` (whole folder), `apps/ui/scripts/download-boundaries.mjs`
- Test: `apps/ui/src/components/area/__tests__/area-map.test.ts` (new)

**Interfaces:**

- Consumes: Task 4 moved `seed-data.json` out of `public/boundaries/`.
- Produces: `areaHeroMap(area: PopulatedAreaData, basePath: string): { pins: HeroMapLibraryPin[]; bounds: { ne?: string | null; sw?: string | null }; hasMap: boolean }` exported from `apps/ui/src/components/area/area-map.ts`.

- [ ] **Step 1: Look at what the Area page passes today**

Run: `sed -n 120,260p apps/ui/src/components/area/AreaDetailPage.tsx` and `sed -n 1,80p apps/ui/src/components/location/LocationHeroMap.tsx`. Note the props `LocationHeroMap` takes (`label`, `caption`, `pins`, `bounds`) and `HeroMapLibraryPin` (`id`, `name`, `href`, `lat`, `lng`, `libraryType`). The Area detail endpoint returns `libraries` with `name`, `slug`, `libraryType`, … but **no `location`** (see `apps/strapi/src/api/area/controllers/area.ts` `detail`, `fields: ["name","slug","summary","libraryType","operationalStatus","city"]`).

- [ ] **Step 2: Return library coordinates from the Area detail**

In `apps/strapi/src/api/area/controllers/area.ts` `detail`, add `"location"` to the libraries `fields` array (`documentId` always comes back). In `apps/ui/src/lib/strapi-api/content/server.ts`, add to `PopulatedAreaData.libraries` items: `documentId: string` and `location?: { lat?: number | string | null; lng?: number | string | null } | null`.

- [ ] **Step 3: Write the failing test**

Create `apps/ui/src/components/area/__tests__/area-map.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { PopulatedAreaData } from "@/lib/strapi-api/content/server"

import { areaHeroMap } from "../area-map"

const area = (over: Partial<PopulatedAreaData> = {}): PopulatedAreaData => ({
  id: 1,
  documentId: "a1",
  name: "Camden",
  slug: "camden",
  ...over,
})

describe("areaHeroMap", () => {
  it("pins libraries that have coordinates", () => {
    const map = areaHeroMap(
      area({
        libraries: [
          {
            documentId: "l1",
            name: "Swiss Cottage Library",
            slug: "swiss-cottage-library",
            libraryType: "Public",
            location: { lat: 51.5432, lng: "-0.1749" },
          },
          { documentId: "l2", name: "No pin", slug: "no-pin", location: null },
        ],
      }),
      "/europe/england/greater-london"
    )
    expect(map.pins).toEqual([
      {
        id: "l1",
        name: "Swiss Cottage Library",
        href: "/europe/england/greater-london/swiss-cottage-library",
        lat: 51.5432,
        lng: -0.1749,
        libraryType: "Public",
      },
    ])
    expect(map.hasMap).toBe(true)
  })

  it("shows the map from bounds alone, and hides it with neither", () => {
    expect(
      areaHeroMap(
        area({
          mapConfig: { boundingBoxNE: "51.6,-0.1", boundingBoxSW: "51.5,-0.2" },
        }),
        "/x"
      ).hasMap
    ).toBe(true)
    expect(areaHeroMap(area(), "/x").hasMap).toBe(false)
  })
})
```

Run: `cd apps/ui && npx vitest run src/components/area/__tests__/area-map.test.ts`
Expected: FAIL: cannot find `../area-map`.

- [ ] **Step 4: Implement `area-map.ts`**

First move the Region page's coordinate parser: cut `const toCoord = (value: unknown): number | null => { … }` from `apps/ui/src/components/region/RegionDetailPage.tsx` (~line 77) into `components/location/location-page.helpers.ts` as `export const toCoord = …` (same body), and import it in `RegionDetailPage.tsx`.

Then create `apps/ui/src/components/area/area-map.ts`. Library links on an Area page go under the Area's Region; `AreaDetailPage` already builds that prefix as `regionHref` (`/${continentSlug}/${countrySlug}/${regionSlug}`), so it is passed in.

```ts
import type { HeroMapLibraryPin } from "@/components/location/LocationHeroMap"
import { toCoord } from "@/components/location/location-page.helpers"
import type { PopulatedAreaData } from "@/lib/strapi-api/content/server"

/** The hero map for an Area page: its libraries' pins and its bounds. */
export function areaHeroMap(area: PopulatedAreaData, basePath: string) {
  const pins: HeroMapLibraryPin[] = (area.libraries ?? []).flatMap((l) => {
    const lat = toCoord(l.location?.lat)
    const lng = toCoord(l.location?.lng)

    return lat !== null && lng !== null
      ? [
          {
            id: l.documentId,
            name: l.name,
            href: `${basePath}/${l.slug}`,
            lat,
            lng,
            libraryType: l.libraryType,
          },
        ]
      : []
  })
  const bounds = {
    ne: area.mapConfig?.boundingBoxNE,
    sw: area.mapConfig?.boundingBoxSW,
  }

  return {
    pins,
    bounds,
    hasMap: pins.length > 0 || Boolean(bounds.ne && bounds.sw),
  }
}
```

`HeroMapLibraryPin` is `{ id: string; name: string; href: string | null; lat: number; lng: number; libraryType?: string | null }`.

Run the test again. Expected: PASS.

- [ ] **Step 5: Swap the map on the Area page**

In `AreaDetailPage.tsx`: remove `import { InteractiveMap } from "@/components/map/InteractiveMap"`; import `LocationHeroMap` from `@/components/location/LocationHeroMap` and `areaHeroMap` from `./area-map`. After the existing `const regionHref = …` line, compute `const map = areaHeroMap(area, regionHref)`. Replace the `<InteractiveMap … />` element with the same pattern the Region page uses:

```tsx
{
  map.hasMap ? (
    <LocationHeroMap
      label={`Map of libraries documented in ${name}`}
      caption={
        map.pins.length > 0
          ? `${countNoun(map.pins.length, "Library", "Libraries")} documented in ${name}`
          : `No libraries documented in ${name} yet.`
      }
      pins={map.pins}
      bounds={map.bounds}
    />
  ) : null
}
```

Put it where the `InteractiveMap` was (keep the surrounding layout element). If the Area page uses `LocationHero` with an `aside` prop like the Region page, pass it as `aside` instead and delete the old map section. `countNoun` comes from `@/components/location/location-page.helpers`.

- [ ] **Step 6: Delete the drill-down and trim helpers**

```bash
rm apps/ui/src/components/map/InteractiveMap.tsx apps/ui/src/components/map/LibraryPinPanel.tsx apps/ui/src/components/map/map.types.ts
rm -r apps/ui/public/boundaries
rm apps/ui/scripts/download-boundaries.mjs
```

Rewrite `apps/ui/src/components/map/map.helpers.ts` to only:

```ts
// ── Basemap ───────────────────────────────────────────────────────────────────

/**
 * Credit for the CARTO Voyager basemap. Its style JSON carries no attribution,
 * and both OpenStreetMap (ODbL) and CARTO's terms require one on the map.
 */
export const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'

// ── Bounding box parser ───────────────────────────────────────────────────────

export function parseBounds(
  ne: string | null | undefined,
  sw: string | null | undefined
) {
  if (!ne || !sw) return null
  const neParts = ne.split(",").map(Number)
  const swParts = sw.split(",").map(Number)
  const neLat = neParts[0]
  const neLng = neParts[1]
  const swLat = swParts[0]
  const swLng = swParts[1]
  if (
    neLat === undefined ||
    neLng === undefined ||
    swLat === undefined ||
    swLng === undefined ||
    Number.isNaN(neLat) ||
    Number.isNaN(neLng) ||
    Number.isNaN(swLat) ||
    Number.isNaN(swLng)
  ) {
    return null
  }

  return { neLat, neLng, swLat, swLng } as const
}
```

- `lib/strapi-api/request-auth.ts`: delete the comment `// Custom map-pins endpoints (centroid / boundary URL only)` and the five `"api/…/map-pins",` lines. In the `isStrapiEndpointAllowed` doc comment change the example `api/libraries/map-pins` to `api/libraries/atlas`.
- `lib/strapi-api/__tests__/request-auth.test.ts`: change `"api/libraries/map-pins"` to `"api/libraries/atlas"`.
- `lib/strapi-api/cache-tags.ts`: delete `"map-pins",` from `ACTION_SEGMENTS`.

- [ ] **Step 7: Verify**

Run: `grep -rn "InteractiveMap\|LibraryPinPanel\|map.types\|fetchMapPins\|map-pins\|boundaryUrl\|/boundaries/" apps/ui/src apps/ui/scripts | grep -v node_modules`
Expected: nothing.

Run: `pnpm --filter @repo/ui test && pnpm --filter @repo/ui typecheck`
Expected: PASS, clean.

---

### Task 6: Place Label fields in Strapi and the library index

**Files:**

- Modify: `apps/strapi/src/api/country/content-types/country/schema.json`
- Modify: `apps/strapi/src/utils/populate-shapes.ts` (`COUNTRY_FIELDS`, `REGION_SHAPES.detail` country, `AREA_SHAPES` if it populates country)
- Modify: `apps/strapi/src/api/region/controllers/region.ts` (`basePopulate.country.fields`), `apps/strapi/src/api/area/controllers/area.ts` (`detail` → `region.country.fields`)
- Modify: `apps/strapi/config/plugins.ts` (library index), `apps/strapi/tests/meilisearch-config.test.ts`
- Test: `apps/strapi/tests/populate-shapes-schema.test.ts` (existing; must keep passing)

**Interfaces:**

- Produces (REST and Document Service): Country has `areaTypeLabel` and `areasSectionLabel` (localised strings). Region detail's `country` carries `regionTypeLabel`, `regionsSectionLabel`, `areaTypeLabel`, `areasSectionLabel`. Area detail's `region.country` carries the same four. Library index documents carry `country_region_label` and `country_regions_label` (strings or null).

- [ ] **Step 1: Failing Meilisearch config test**

In `apps/strapi/tests/meilisearch-config.test.ts`, find the test that calls the library `transformEntry` with a populated `country` and add, in a new `it`:

```ts
it("carries the country's Region labels into library documents", () => {
  const doc = libraryTransform({
    entry: {
      name: "Bern Public Library",
      country: {
        iso2: "CH",
        slug: "switzerland",
        name: "Switzerland",
        regionTypeLabel: "Canton",
        regionsSectionLabel: "Cantons",
      },
    },
  })
  expect(doc.country_region_label).toBe("Canton")
  expect(doc.country_regions_label).toBe("Cantons")
})
```

Use whatever helper the file already uses to reach the library index's `transformEntry` (named `libraryTransform` above; rename to match). Also assert the library index `entriesQuery.populate.country.fields` contains `"regionTypeLabel"` and `"regionsSectionLabel"`, and that `displayedAttributes` contains both new keys, in the same style as the file's existing assertions.

Run: `cd apps/strapi && npx vitest run tests/meilisearch-config.test.ts`
Expected: FAIL on the new test.

- [ ] **Step 2: Schema**

In `country/schema.json`, after `regionsSectionLabel` add:

```json
    "areaTypeLabel": {
      "type": "string",
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      }
    },
    "areasSectionLabel": {
      "type": "string",
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      }
    }
```

Add `"description"` to all four label attributes only if Strapi v5 accepts it on attributes in this repo (check another schema for an attribute-level `"description"`; if none exists, skip descriptions and instead add one line to the Country type's `"info.description"`: `"Place labels (regionTypeLabel, regionsSectionLabel, areaTypeLabel, areasSectionLabel) are UI labels only and never change the hierarchy."`).

- [ ] **Step 3: Shapes and detail populates**

- `populate-shapes.ts`: add `"regionsSectionLabel", "areaTypeLabel", "areasSectionLabel"` to `COUNTRY_FIELDS` after `"regionTypeLabel"` (and remove `"regionsSectionLabel"` from the country `detail.fields` list, where it would now repeat). In `REGION_SHAPES.detail.populate.country.fields` use `["name", "slug", "capitalCity", "regionTypeLabel", "regionsSectionLabel", "areaTypeLabel", "areasSectionLabel"]`.
- `region.ts` `detail`: `basePopulate.country.fields` gets the same seven fields.
- `area.ts` `detail`: `region.populate.country.fields` becomes `["name", "slug", "regionTypeLabel", "regionsSectionLabel", "areaTypeLabel", "areasSectionLabel"]`.

- [ ] **Step 4: Library index**

In `config/plugins.ts`, library index:

- `entriesQuery.populate.country.fields`: `["iso2", "slug", "name", "regionTypeLabel", "regionsSectionLabel"]`;
- in `transformEntry`, after `country_code: …`, add:

```ts
              // What the country calls its Regions, for Find libraries' filter.
              country_region_label: str(country?.regionTypeLabel),
              country_regions_label: str(country?.regionsSectionLabel),
```

where `str` is a local `(v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)`; reuse an existing helper in the file if one does the same;

- add `"country_region_label"` and `"country_regions_label"` to `LIBRARY_DISPLAYED` after `"country_code"`.

- [ ] **Step 5: Types, tests, typecheck**

Run: `cd apps/strapi && pnpm strapi ts:generate-types && npx vitest run tests/meilisearch-config.test.ts tests/populate-shapes-schema.test.ts tests/location-controllers.test.ts && cd ../.. && pnpm --filter @repo/strapi typecheck`
Expected: PASS, clean.

---

### Task 7: `placeLabels()` and the location pages

**Files:**

- Modify: `apps/ui/src/components/location/location-page.helpers.ts`
- Modify: `apps/ui/src/components/location/__tests__/location-page.helpers.test.ts`
- Modify: `apps/ui/src/components/country/CountryDetailPage.tsx`, `apps/ui/src/components/region/RegionDetailPage.tsx`, `apps/ui/src/components/area/AreaDetailPage.tsx`
- Modify: `apps/ui/src/app/[locale]/[continent]/[country]/page.tsx`, `apps/ui/src/app/[locale]/[continent]/[country]/[region]/page.tsx`
- Modify: `apps/ui/src/lib/strapi-api/content/server.ts` (country types in `PopulatedRegionData`, `PopulatedAreaData`)

**Interfaces:**

- Consumes: Task 6 (the four fields reach the pages).
- Produces, in `location-page.helpers.ts`:

```ts
export type ChildLabels = {
  /** Title-case singular, e.g. "County": select labels and hero badges. */
  name: string
  /** Section title, e.g. "Counties". */
  plural: string
  /** Mid-sentence singular, e.g. "county". */
  singular: string
}
export type PlaceLabelFields = {
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}
export function placeLabels(country: PlaceLabelFields | null | undefined): {
  region: ChildLabels
  area: ChildLabels
}
```

`regionLabels` is removed; Tasks 8 and 9 use `placeLabels`.

- [ ] **Step 1: Replace the `regionLabels` test with `placeLabels` tests**

In `location-page.helpers.test.ts`, change the import `regionLabels` to `placeLabels` and replace the test `"derives what a country calls its regions"` with:

```ts
it("derives what a country calls its Regions and Areas", () => {
  expect(
    placeLabels({ regionTypeLabel: "Canton", areaTypeLabel: "District" })
  ).toEqual({
    region: { name: "Canton", plural: "Cantons", singular: "canton" },
    area: { name: "District", plural: "Districts", singular: "district" },
  })
  expect(
    placeLabels({
      regionsSectionLabel: "Council areas",
      regionTypeLabel: "Authority",
    }).region
  ).toEqual({
    name: "Council area",
    plural: "Council areas",
    singular: "council area",
  })
  expect(
    placeLabels({ areasSectionLabel: "Local government areas" }).area
  ).toEqual({
    name: "Local government area",
    plural: "Local government areas",
    singular: "local government area",
  })
})

it("falls back to Region and Area", () => {
  const fallback = {
    region: { name: "Region", plural: "Regions", singular: "region" },
    area: { name: "Area", plural: "Areas", singular: "area" },
  }
  expect(placeLabels({})).toEqual(fallback)
  expect(placeLabels(null)).toEqual(fallback)
  expect(
    placeLabels({
      regionTypeLabel: "County / Unitary Authority / London Borough",
    }).region
  ).toEqual(fallback.region)
})
```

Run: `cd apps/ui && npx vitest run src/components/location/__tests__/location-page.helpers.test.ts`
Expected: FAIL: `placeLabels` is not exported.

- [ ] **Step 2: Implement**

In `location-page.helpers.ts`, replace the `ChildLabels` type and `regionLabels` function with:

```ts
export type ChildLabels = {
  /** Title-case singular, e.g. "County": select labels and hero badges. */
  name: string
  /** Section title, e.g. "Counties". */
  plural: string
  /** Mid-sentence singular, e.g. "county". */
  singular: string
}

/** The Place Labels on a Country (UI only; they never change the hierarchy). */
export type PlaceLabelFields = {
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}

/**
 * One level's words: the plural label wins, then the singular (pluralised);
 * a mixed singular ("County / Unitary Authority") or nothing falls back.
 */
function levelLabels(
  type: string | null | undefined,
  section: string | null | undefined,
  fallback: "Region" | "Area"
): ChildLabels {
  const plural = section?.trim()
  if (plural) {
    const name = singularizeLabel(plural)

    return { name, plural, singular: lowerFirst(name) }
  }
  const name = type?.trim()
  if (name && !name.includes("/")) {
    return { name, plural: pluralizeLabel(name), singular: lowerFirst(name) }
  }

  return {
    name: fallback,
    plural: `${fallback}s`,
    singular: fallback.toLowerCase(),
  }
}

/** What a country calls its Regions and its Areas. */
export function placeLabels(country: PlaceLabelFields | null | undefined): {
  region: ChildLabels
  area: ChildLabels
} {
  return {
    region: levelLabels(
      country?.regionTypeLabel,
      country?.regionsSectionLabel,
      "Region"
    ),
    area: levelLabels(
      country?.areaTypeLabel,
      country?.areasSectionLabel,
      "Area"
    ),
  }
}
```

Run the test. Expected: PASS.

- [ ] **Step 3: Types**

In `server.ts`: `PopulatedRegionData.country` gains `regionsSectionLabel?: string | null; areaTypeLabel?: string | null; areasSectionLabel?: string | null`. `PopulatedAreaData.region.country` gains `regionsSectionLabel`, `areaTypeLabel`, `areasSectionLabel` (same types). `PopulatedCountryData` picks the new fields up from `Data.ContentType<"api::country.country">` after Task 6's type regeneration.

- [ ] **Step 4: Pages**

- `CountryDetailPage.tsx`: `import { …, placeLabels } from …` instead of `regionLabels`; `const labels = placeLabels(country).region`. Every later use of `labels.plural` / `labels.singular` stays.
- `RegionDetailPage.tsx`: `const labels = placeLabels(region.country).region` (replacing the `regionLabels({ regionTypeLabel: … })` call); the hero becomes `typeLabel={region.typeLabel ?? labels.name}`.
- `AreaDetailPage.tsx`: `const labels = placeLabels(area.region?.country)`; hero `typeLabel={area.typeLabel ?? labels.area.name}`.
- `[country]/page.tsx` metadata: `childLabel: data.regions?.length ? placeLabels(data).region.singular : null`.
- `[region]/page.tsx` metadata: `childLabel: data.areas?.length ? placeLabels(data.country).area.singular : null`.

Import `placeLabels` from `@/components/location/location-page.helpers` in each file; remove now-unused imports.

- [ ] **Step 5: Verify**

Run: `grep -rn "regionLabels" apps/ui/src` → nothing. Then `pnpm --filter @repo/ui test && pnpm --filter @repo/ui typecheck` → PASS, clean.

---

### Task 8: Find libraries names the Region select in the country's words

**Files:**

- Modify: `apps/ui/src/lib/find-search.ts` (`FindPlaceRef`, `placeRef`, `placeChain`)
- Modify: `apps/ui/src/components/index-page/FindFilterSidebar.tsx` (`PLACE_SELECTS`, `PlaceSelects`); this file has another session's uncommitted edits: change only these
- Create: `apps/ui/src/components/index-page/place-select-labels.ts`
- Test: `apps/ui/src/components/index-page/__tests__/find-place-labels.test.ts` (new), `apps/ui/src/lib/__tests__/find-search*.test.ts` (existing, if they cover `placeChain`)

**Interfaces:**

- Consumes: Task 6 (`country_region_label`, `country_regions_label` in library documents) and Task 7 (`placeLabels`).
- Produces: `FindPlaceRef` gains optional `regionTypeLabel?: string | null` and `regionsSectionLabel?: string | null` (set on `location.country` only). `placeSelectLabels(location?: FindLocation): { level: PlaceLevel; label: string; all: string }[]` exported from the new `components/index-page/place-select-labels.ts` (its own module: `location-page.helpers.ts` already imports `find-helpers.ts`, so putting it there would make an import cycle).

- [ ] **Step 1: Failing test for the select labels**

Create `apps/ui/src/components/index-page/__tests__/find-place-labels.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { placeSelectLabels } from "../place-select-labels"

const empty = { continents: [], countries: [], regions: [] }

describe("placeSelectLabels", () => {
  it("names the Region select as the chosen country does", () => {
    const [, , region] = placeSelectLabels({
      ...empty,
      country: {
        slug: "switzerland",
        name: "Switzerland",
        regionTypeLabel: "Canton",
        regionsSectionLabel: "Cantons",
      },
    })
    expect(region).toEqual({
      level: "region",
      label: "Canton",
      all: "All cantons",
    })
  })

  it("says Region with no country or no label", () => {
    expect(placeSelectLabels()[2]).toEqual({
      level: "region",
      label: "Region",
      all: "All regions",
    })
    expect(
      placeSelectLabels({ ...empty, country: { slug: "x", name: "X" } })[2]
    ).toEqual({ level: "region", label: "Region", all: "All regions" })
  })

  it("keeps continent and country", () => {
    const [continent, country] = placeSelectLabels()
    expect(continent).toEqual({
      level: "continent",
      label: "Continent",
      all: "All continents",
    })
    expect(country).toEqual({
      level: "country",
      label: "Country",
      all: "All countries",
    })
  })
})
```

Run: `cd apps/ui && npx vitest run src/components/index-page/__tests__/find-place-labels.test.ts`
Expected: FAIL: `placeSelectLabels` is not exported.

- [ ] **Step 2: Implement**

Create `components/index-page/place-select-labels.ts`:

```ts
import {
  lowerFirst,
  placeLabels,
} from "@/components/location/location-page.helpers"
import type { FindLocation } from "@/lib/find-search"

import type { PlaceLevel } from "./find-helpers"

/** The Location selects' labels; the Region one in the chosen country's words. */
export function placeSelectLabels(
  location?: FindLocation
): { level: PlaceLevel; label: string; all: string }[] {
  const region = placeLabels(location?.country).region

  return [
    { level: "continent", label: "Continent", all: "All continents" },
    { level: "country", label: "Country", all: "All countries" },
    {
      level: "region",
      label: region.name,
      all: `All ${lowerFirst(region.plural)}`,
    },
  ]
}
```

`placeLabels` reads `regionTypeLabel`/`regionsSectionLabel`, which `FindPlaceRef` now carries (Step 3). Check `lowerFirst("Cantons")` gives `"cantons"` (it does for single-capital words).

In `FindFilterSidebar.tsx`: delete `PLACE_SELECTS`; in `PlaceSelects`, `const selects = placeSelectLabels(location)` and map over `selects` where it mapped `PLACE_SELECTS` (including the `selects[i - 1]?.level` parent lookup).

- [ ] **Step 3: Read the labels off the search**

In `find-search.ts`:

- `FindPlaceRef`: add `regionTypeLabel?: string | null` and `regionsSectionLabel?: string | null` with the comment `/** The country's Region labels (country level only). */`.
- `placeChain`'s `attributesToRetrieve`: append `"country_region_label", "country_regions_label"` when `levels` includes `"country"`.
- In `placeChain`'s `.then`, after building `chain`, add:

```ts
const hit = res.hits?.[0] as Record<string, unknown> | undefined
if (chain.country && hit) {
  const label = hit.country_region_label
  const section = hit.country_regions_label
  chain.country = {
    ...chain.country,
    ...(typeof label === "string" ? { regionTypeLabel: label } : {}),
    ...(typeof section === "string" ? { regionsSectionLabel: section } : {}),
  }
}
```

- [ ] **Step 4: Verify**

Run: `cd apps/ui && npx vitest run src/components/index-page src/lib && cd ../.. && pnpm --filter @repo/ui typecheck`
Expected: PASS, clean. Labels appear only after the Meilisearch reseed in Task 13.

---

### Task 9: Place picker labels and the relations route

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/index/_components/LocationHierarchySelector.tsx`
- Modify: `apps/ui/src/app/api/relations/[type]/route.ts`, `apps/ui/src/app/api/relations/[type]/__tests__/route.test.ts`
- Test: `apps/ui/src/app/[locale]/contribute/index/_components/__tests__/LocationHierarchySelector.test.ts` (new)

**Interfaces:**

- Consumes: Task 3 (selector without proposals), Task 6 (`/api/relations/countries` rows carry the four label fields: the Strapi list shape returns `COUNTRY_FIELDS` whatever the route asks for), Task 7 (`placeLabels`).
- Produces: the Region and Area `<label>`s read the selected country's singular labels.

- [ ] **Step 1: Failing selector test**

Create `__tests__/LocationHierarchySelector.test.ts` (copy the header of `LocationLookup.test.ts`: `// @vitest-environment happy-dom`, `Object.assign(globalThis, { React })`, the `@iconify/react` mock):

```ts
// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))

import { LocationHierarchySelector } from "../LocationHierarchySelector"
import { INITIAL_FORM_DATA } from "../wizard.types"

const LISTS: Record<string, unknown[]> = {
  continents: [{ documentId: "eu", name: "Europe" }],
  countries: [
    {
      documentId: "ch",
      name: "Switzerland",
      regionTypeLabel: "Canton",
      areaTypeLabel: "District",
    },
    { documentId: "xx", name: "Nowhere" },
  ],
  regions: [],
  areas: [],
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const type = /\/api\/relations\/([a-z]+)/.exec(url)?.[1] ?? ""

      return new Response(JSON.stringify({ data: LISTS[type] ?? [] }))
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderWith = (countryDocumentId: string) =>
  render(
    createElement(LocationHierarchySelector, {
      f: { ...INITIAL_FORM_DATA, continentDocumentId: "eu", countryDocumentId },
      setFormData: () => {},
    })
  )

describe("LocationHierarchySelector", () => {
  it("names the Region and Area selects as the country does", async () => {
    renderWith("ch")
    await waitFor(() => expect(screen.getByLabelText("Canton")).toBeTruthy())
    expect(screen.getByLabelText(/District/)).toBeTruthy()
  })

  it("says Region and Area for a country without labels", async () => {
    renderWith("xx")
    await waitFor(() => expect(screen.getByLabelText("Region")).toBeTruthy())
    expect(screen.getByLabelText(/^Area/)).toBeTruthy()
  })

  it("offers no Location Request", async () => {
    renderWith("ch")
    await waitFor(() => expect(screen.getByLabelText("Canton")).toBeTruthy())
    expect(screen.queryByText("Not listed?")).toBeNull()
  })
})
```

Use the wizard's real initial-value export name (`grep -n "export const" "apps/ui/src/app/[locale]/contribute/index/_components/wizard.types.ts"`); `INITIAL_FORM_DATA` above is a stand-in for it.

Run: `cd apps/ui && npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/LocationHierarchySelector.test.ts"`
Expected: FAIL: the label still reads "Region".

- [ ] **Step 2: Labels in the selector**

In `LocationHierarchySelector.tsx`:

```ts
import { placeLabels } from "@/components/location/location-page.helpers"

type RelationOption = { documentId: string; name: string }
type CountryOption = RelationOption & {
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}
```

`const [countries, setCountries] = useState<CountryOption[]>([])`, then before the `return`:

```ts
// What the chosen country calls its Regions and Areas (UI only).
const labels = placeLabels(
  countries.find((c) => c.documentId === f.countryDocumentId)
)
```

The Region `<label htmlFor="hier-region">` text becomes `{labels.region.name}` and the Area one `{labels.area.name}{" "}` followed by the existing "(optional)" span.

Run the test. Expected: PASS.

- [ ] **Step 3: Relations route cap**

In `route.test.ts`, add a test in the file's style that `GET /api/relations/areas?regionDocumentId=r1` calls Strapi with `pagination[limit]=1000`, and `countries` still with `300`. Run it (FAIL), then in `route.ts`:

```ts
// The largest real parents hold about 850 places (Minas Gerais, Brazil).
const limit = type === "countries" ? 300 : 1000
```

and change the comment above `revalidate` to `// Regions and areas change when the world place import runs, so they refresh within a minute; the other lists change rarely.` Run again: PASS.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @repo/ui test && pnpm --filter @repo/ui typecheck`
Expected: PASS, clean.

---

### Task 10: Gazetteer core (pure modules)

**Files:**

- Create: `apps/strapi/scripts/ingests/gazetteer/types.ts`, `match.ts`, `slugs.ts`, `plan.ts`, `geonames.ts`, `curated.ts`, `country-profiles.ts` (types and `resolveProfile` only; Task 11 fills `PROFILES`)
- Test: `apps/strapi/tests/ingests/gazetteer-core.test.ts`

**Interfaces:**

- Produces (exact names; Tasks 11–12 use them):
  - `types.ts`: `SourcePlace`, `ExistingPlace`
  - `match.ts`: `normaliseName(name: string, extra?: readonly string[]): string`, `findMatch(source: SourcePlace, existing: readonly ExistingPlace[], opts?: { typeWords?: readonly string[]; aliases?: Record<string, string> }): ExistingPlace | null`
  - `slugs.ts`: `SlugRequest`, `planSlugs(requests: readonly SlugRequest[], taken: ReadonlySet<string>): Map<string, string>`
  - `plan.ts`: `ChildAction`, `ChildPlan`, `planChildren(input): ChildPlan`
  - `geonames.ts`: `GeonamesDivision`, `parseAdminCodes(text, level)`, `parseCountryDump(text)`, `tidyName(name, words)`, `geonamesPlaces(profile, data)`, `loadAdminCodes(cacheDir)`, `loadCountryDump(country, cacheDir)`, `GEONAMES_ATTRIBUTION`
  - `curated.ts`: `CuratedList`, `curatedPlaces(list)`
  - `country-profiles.ts`: `ProfileLabels`, `CountryProfile`, `ResolvedProfile`, `PROFILES`, `resolveProfile(key, profiles?)`, `labelWords(profile)`

- [ ] **Step 1: Write the failing tests**

Create `apps/strapi/tests/ingests/gazetteer-core.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  resolveProfile,
  type CountryProfile,
} from "../../scripts/ingests/gazetteer/country-profiles"
import { curatedPlaces } from "../../scripts/ingests/gazetteer/curated"
import {
  geonamesPlaces,
  parseAdminCodes,
  parseCountryDump,
  tidyName,
} from "../../scripts/ingests/gazetteer/geonames"
import { findMatch, normaliseName } from "../../scripts/ingests/gazetteer/match"
import { planChildren } from "../../scripts/ingests/gazetteer/plan"
import { planSlugs } from "../../scripts/ingests/gazetteer/slugs"
import type {
  ExistingPlace,
  SourcePlace,
} from "../../scripts/ingests/gazetteer/types"

const src = (name: string, over: Partial<SourcePlace> = {}): SourcePlace => ({
  sourceId: `geonames:${name}`,
  name,
  altNames: [],
  key: name,
  ...over,
})
const ex = (
  name: string,
  over: Partial<ExistingPlace> = {}
): ExistingPlace => ({
  documentId: `doc-${name}`,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  ...over,
})

describe("normaliseName", () => {
  it("ignores case, accents, punctuation and type words", () => {
    expect(normaliseName("Zürich")).toBe("zurich")
    expect(normaliseName("Canton of Zürich")).toBe("zurich")
    expect(normaliseName("County Durham")).toBe("durham")
    expect(normaliseName("Windsor And Maidenhead")).toBe(
      normaliseName("Windsor and Maidenhead")
    )
    expect(normaliseName("Bath & North East Somerset")).toBe(
      "bath and north east somerset"
    )
  })

  it("drops the country's own label words too, but never to nothing", () => {
    expect(normaliseName("Landkreis Rosenheim", ["Landkreis"])).toBe(
      "rosenheim"
    )
    expect(normaliseName("Region")).toBe("region")
    expect(normaliseName("Москва")).toBe("")
  })
})

describe("findMatch", () => {
  it("matches by geonamesId first, then by name or alternate name", () => {
    const zh = ex("Zurich", { geonamesId: "2657895" })
    expect(
      findMatch(src("Kanton Zürich", { geonamesId: "2657895" }), [zh])
    ).toBe(zh)
    expect(
      findMatch(src("Geneva", { altNames: ["Genève"] }), [ex("Genève")])?.name
    ).toBe("Genève")
  })

  it("matches by GSS code", () => {
    const camden = ex("London Borough of Camden", { gssCode: "E09000007" })
    expect(findMatch(src("Camden", { gssCode: "E09000007" }), [camden])).toBe(
      camden
    )
  })

  it("won't take a place already tied to another GeoNames id, or an ambiguous name", () => {
    expect(
      findMatch(src("Limburg", { geonamesId: "1" }), [
        ex("Limburg", { geonamesId: "2" }),
      ])
    ).toBeNull()
    expect(
      findMatch(src("Springfield"), [
        ex("Springfield", { documentId: "a" }),
        ex("Springfield", { documentId: "b" }),
      ])
    ).toBeNull()
  })

  it("follows an alias from an existing name to the source's spelling", () => {
    const bcp = ex("Bournemouth and Christchurch and Poole")
    expect(
      findMatch(src("Bournemouth, Christchurch and Poole"), [bcp], {
        aliases: {
          "Bournemouth and Christchurch and Poole":
            "Bournemouth, Christchurch and Poole",
        },
      })
    ).toBe(bcp)
  })
})

describe("planChildren", () => {
  it("creates everything for a parent with no places", () => {
    const plan = planChildren({
      sources: [src("Bern"), src("Vaud")],
      existing: [],
      fill: false,
    })
    expect(plan.actions.map((a) => a.kind)).toEqual(["create", "create"])
  })

  it("adds nothing where places exist, unless the profile fills", () => {
    const existing = [ex("Bern")]
    const strict = planChildren({
      sources: [src("Bern", { geonamesId: "9" }), src("Vaud")],
      existing,
      fill: false,
    })
    expect(strict.actions).toEqual([
      {
        kind: "match",
        source: src("Bern", { geonamesId: "9" }),
        existing: existing[0],
        fill: { geonamesId: "9" },
      },
      { kind: "not-added", source: src("Vaud"), reason: "parent-has-places" },
    ])
    const filled = planChildren({
      sources: [src("Vaud")],
      existing,
      fill: true,
    })
    expect(filled.actions[0]?.kind).toBe("create")
    expect(filled.unmatchedExisting).toEqual(existing)
  })

  it("never ties two sources to one existing place", () => {
    const plan = planChildren({
      sources: [src("Kent"), src("Kent", { sourceId: "geonames:dup" })],
      existing: [ex("Kent")],
      fill: true,
    })
    expect(plan.actions.map((a) => a.kind)).toEqual(["match", "create"])
  })

  it("skips an Area named like a different Region", () => {
    const plan = planChildren({
      sources: [src("Thurrock"), src("Basildon")],
      existing: [],
      fill: true,
      blocked: new Set(["thurrock"]),
    })
    expect(plan.actions).toEqual([
      {
        kind: "not-added",
        source: src("Thurrock"),
        reason: "name-is-a-region",
      },
      { kind: "create", source: src("Basildon") },
    ])
  })
})

describe("planSlugs", () => {
  it("keeps a free slug, and suffixes every new place that shares one", () => {
    const slugs = planSlugs(
      [
        { id: "nl", name: "Limburg", suffix: "nl", tieBreak: "1" },
        { id: "be", name: "Limburg", suffix: "be", tieBreak: "2" },
        { id: "zh", name: "Zürich", suffix: "ch", tieBreak: "3" },
      ],
      new Set()
    )
    expect(Object.fromEntries(slugs)).toEqual({
      nl: "limburg-nl",
      be: "limburg-be",
      zh: "zurich",
    })
  })

  it("suffixes a new place whose slug is already taken, and breaks remaining ties", () => {
    const slugs = planSlugs(
      [
        { id: "a", name: "Central", suffix: "gh", tieBreak: "11" },
        { id: "b", name: "Central", suffix: "gh", tieBreak: "12" },
        { id: "c", name: "Kent", suffix: "gb-eng", tieBreak: "13" },
      ],
      new Set(["kent"])
    )
    expect(Object.fromEntries(slugs)).toEqual({
      a: "central-gh-11",
      b: "central-gh-12",
      c: "kent-gb-eng",
    })
  })

  it("always suffixes US-style requests", () => {
    const slugs = planSlugs(
      [
        {
          id: "x",
          name: "Tompkins County",
          suffix: "NY",
          alwaysSuffix: true,
          tieBreak: "1",
        },
      ],
      new Set()
    )
    expect(slugs.get("x")).toBe("tompkins-county-ny")
  })
})

describe("GeoNames parsing", () => {
  it("reads admin1 and admin2 code files", () => {
    expect(
      parseAdminCodes("CH.ZH\tZurich\tZurich\t2657895\nbad line\n", 1)
    ).toEqual([
      {
        geonameId: "2657895",
        level: 1,
        country: "CH",
        admin1: "ZH",
        admin2: "",
        name: "Zurich",
        asciiName: "Zurich",
        altNames: [],
      },
    ])
    expect(
      parseAdminCodes(
        "US.NY.097\tSchuyler County\tSchuyler County\t5137920\n",
        2
      )[0]
    ).toMatchObject({ level: 2, country: "US", admin1: "NY", admin2: "097" })
  })

  it("keeps only ADM1–ADM3 rows from a country dump", () => {
    const row = (code: string, name: string) =>
      [
        "123",
        name,
        name,
        "Alt A,Alt B",
        "48.1",
        "11.5",
        "A",
        code,
        "DE",
        "",
        "02",
        "091",
        "09187",
        "",
        "0",
        "",
        "500",
        "Europe/Berlin",
        "2024-01-01",
      ].join("\t")
    const rows = parseCountryDump(
      [
        row("ADM3", "Landkreis Rosenheim"),
        row("PPL", "Rosenheim"),
        row("ADM1H", "Old"),
      ].join("\n")
    )
    expect(rows).toEqual([
      {
        geonameId: "123",
        level: 3,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Landkreis Rosenheim",
        asciiName: "Landkreis Rosenheim",
        altNames: ["Alt A", "Alt B"],
      },
    ])
  })

  it("tidies type words off either end", () => {
    expect(tidyName("Landkreis Rosenheim", ["Landkreis "])).toBe("Rosenheim")
    expect(tidyName("Rhône Department", [" Department"])).toBe("Rhône")
    expect(tidyName("Landkreis ", ["Landkreis "])).toBe("Landkreis ")
  })

  it("turns a profile's levels into Regions and Areas", () => {
    const profile = resolveProfile("DE", [
      {
        key: "DE",
        areaLevel: 3,
        tidyNames: ["Landkreis ", "Kreisfreie Stadt "],
      },
    ])
    const admin1 = parseAdminCodes("DE.02\tBavaria\tBavaria\t2951839\n", 1)
    const dump = [
      {
        geonameId: "1",
        level: 3 as const,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Landkreis Rosenheim",
        asciiName: "Landkreis Rosenheim",
        altNames: [],
      },
      {
        geonameId: "2",
        level: 3 as const,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Kreisfreie Stadt Rosenheim",
        asciiName: "Kreisfreie Stadt Rosenheim",
        altNames: [],
      },
      {
        geonameId: "3",
        level: 3 as const,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Landkreis Ebersberg",
        asciiName: "Landkreis Ebersberg",
        altNames: [],
      },
    ]
    const places = geonamesPlaces(profile, { admin1, admin2: [], dump })
    expect(places.regions).toEqual([
      {
        sourceId: "geonames:2951839",
        geonamesId: "2951839",
        name: "Bavaria",
        altNames: [],
        key: "02",
        admin1: "02",
      },
    ])
    // Both Rosenheims would tidy to "Rosenheim", so both keep their full names.
    expect(places.areas.map((a) => [a.name, a.parentKey])).toEqual([
      ["Landkreis Rosenheim", "02"],
      ["Kreisfreie Stadt Rosenheim", "02"],
      ["Ebersberg", "02"],
    ])
  })

  it("reads a UK nation's level-2 places", () => {
    const profile = resolveProfile("GB-SCT", [
      {
        key: "GB-SCT",
        geonames: { country: "GB", admin1: "SCT" },
        regionLevel: 2,
        areaLevel: null,
      },
    ])
    const admin2 = parseAdminCodes(
      "GB.SCT.T5\tGlasgow City\tGlasgow City\t3333231\nGB.WLS.Y1\tCardiff\tCardiff\t3333148\n",
      2
    )
    const places = geonamesPlaces(profile, { admin1: [], admin2 })
    expect(places.regions.map((r) => [r.name, r.key])).toEqual([
      ["Glasgow City", "SCT.T5"],
    ])
    expect(places.areas).toEqual([])
  })
})

describe("curated lists", () => {
  it("turns counties and districts into Regions and Areas", () => {
    const places = curatedPlaces({
      source: "ons-lad",
      attribution: "ONS",
      regions: [
        {
          key: "essex",
          name: "Essex",
          areas: [
            {
              gssCode: "E06000034",
              name: "Thurrock",
              typeLabel: "Unitary authority",
            },
          ],
        },
      ],
    })
    expect(places.regions).toEqual([
      { sourceId: "curated:essex", name: "Essex", altNames: [], key: "essex" },
    ])
    expect(places.areas).toEqual([
      {
        sourceId: "gss:E06000034",
        gssCode: "E06000034",
        name: "Thurrock",
        altNames: [],
        key: "E06000034",
        parentKey: "essex",
        typeLabel: "Unitary authority",
      },
    ])
  })
})

describe("resolveProfile", () => {
  const profiles: CountryProfile[] = [
    { key: "CH", labels: { region: "Canton", regions: "Cantons" } },
    { key: "GB-X", source: "curated" },
    { key: "GB-Y" },
    { key: "ZZ", regionLevel: 2, areaLevel: 2 },
  ]

  it("fills defaults", () => {
    expect(resolveProfile("FR", profiles)).toEqual({
      key: "FR",
      labels: null,
      regionLevel: 1,
      areaLevel: 2,
      geonames: { country: "FR" },
      fill: false,
      source: "geonames",
      curatedFile: null,
      tidyNames: [],
      areaSlugSuffix: "on-clash",
      aliases: {},
    })
    expect(resolveProfile("CH", profiles).labels?.region).toBe("Canton")
  })

  it("refuses profiles that can't work", () => {
    expect(() => resolveProfile("GB-X", profiles)).toThrow(/curatedFile/)
    expect(() => resolveProfile("GB-Y", profiles)).toThrow(/GeoNames country/)
    expect(() => resolveProfile("ZZ", profiles)).toThrow(
      /below the Region level/
    )
  })
})
```

Run: `cd apps/strapi && npx vitest run tests/ingests/gazetteer-core.test.ts`
Expected: FAIL: the modules don't exist.

- [ ] **Step 2: `types.ts`**

```ts
/** Shared types for the world place import. Pure: no I/O. */

/** A place read from a source file (GeoNames or a curated list). */
export interface SourcePlace {
  /** Unique within the run: "geonames:2657895", "gss:E06000034", "curated:essex". */
  sourceId: string
  geonamesId?: string
  gssCode?: string
  name: string
  /** Other spellings to match existing places on. */
  altNames: string[]
  /** What Areas use to find this place as their Region (a GeoNames admin1 code, or a curated key). */
  key: string
  /** Areas only: the `key` of their Region. */
  parentKey?: string
  /** A per-place type label (curated sources only). */
  typeLabel?: string
  /** GeoNames admin1 code of the place's Region (the US Area slug suffix). */
  admin1?: string
}

/** A Region or Area already in Strapi. */
export interface ExistingPlace {
  documentId: string
  name: string
  slug: string
  geonamesId?: string | null
  gssCode?: string | null
}
```

- [ ] **Step 3: `match.ts`**

```ts
import type { ExistingPlace, SourcePlace } from "./types"

/** Words that name a kind of place rather than the place. */
const TYPE_WORDS = new Set([
  "county",
  "region",
  "province",
  "canton",
  "district",
  "oblast",
  "voivodeship",
  "municipality",
  "department",
  "prefecture",
  "governorate",
  "parish",
  "state",
  "of",
  "the",
])

const words = (s: string) =>
  s
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * A name reduced for comparison: case, accents, punctuation and type words
 * ("County", "Canton of", plus `extra`, the country's own labels) ignored.
 * A name made only of type words keeps them. A name in a non-Latin script
 * normalises to "" and never matches.
 */
export function normaliseName(
  name: string,
  extra: readonly string[] = []
): string {
  const all = words(name)
  const drop = new Set([...TYPE_WORDS, ...extra.flatMap(words)])
  const kept = all.filter((w) => !drop.has(w))

  return (kept.length > 0 ? kept : all).join(" ")
}

/**
 * The existing place a source place is (spec §6.5): same `geonamesId`, same
 * GSS code, else exactly one existing place whose name (or alias) matches
 * the source's name or one of its alternate names. A place already tied to
 * a different GeoNames id is never matched by name.
 */
export function findMatch(
  source: SourcePlace,
  existing: readonly ExistingPlace[],
  opts: { typeWords?: readonly string[]; aliases?: Record<string, string> } = {}
): ExistingPlace | null {
  if (source.geonamesId) {
    const byId = existing.find((e) => e.geonamesId === source.geonamesId)
    if (byId) return byId
  }
  if (source.gssCode) {
    const byGss = existing.find((e) => e.gssCode === source.gssCode)
    if (byGss) return byGss
  }
  const norm = (n: string) => normaliseName(n, opts.typeWords)
  const keys = new Set(
    [source.name, ...source.altNames].map(norm).filter(Boolean)
  )
  const hits = existing.filter((e) => {
    if (e.geonamesId && source.geonamesId && e.geonamesId !== source.geonamesId)
      return false
    const alias = opts.aliases?.[e.name]
    const names = alias ? [e.name, alias] : [e.name]

    return names.some((n) => {
      const k = norm(n)

      return k !== "" && keys.has(k)
    })
  })

  return hits.length === 1 ? hits[0]! : null
}
```

- [ ] **Step 4: `slugs.ts`**

```ts
import { slugify } from "../_shared/text"

export interface SlugRequest {
  /** Unique within the run. */
  id: string
  name: string
  /** Added when the base slug is shared: the country code (Regions) or the Region's slug (Areas). */
  suffix: string
  /** Add the suffix even when nothing clashes (US Areas, as the IMLS ingest does). */
  alwaysSuffix?: boolean
  /** Added last when the suffixed slug still clashes (a GeoNames id or GSS code). */
  tieBreak: string
}

/**
 * Slugs for the places a run creates (spec §6.7). Region and Area pages are
 * found by slug alone, so a slug is unique across its type. A base slug that
 * two planned places share, or that is already taken, gets the suffix on
 * every planned place that has it; existing slugs never change. The result
 * doesn't depend on the order of `requests`.
 */
export function planSlugs(
  requests: readonly SlugRequest[],
  taken: ReadonlySet<string>
): Map<string, string> {
  const tally = (slugs: Iterable<string>) => {
    const n = new Map<string, number>()
    for (const s of slugs) n.set(s, (n.get(s) ?? 0) + 1)

    return n
  }
  const base = new Map(requests.map((r) => [r.id, slugify(r.name) || "place"]))
  const baseCount = tally(base.values())
  const first = new Map(
    requests.map((r) => {
      const b = base.get(r.id)!
      const shared = (baseCount.get(b) ?? 0) > 1 || taken.has(b)

      return [r.id, r.alwaysSuffix || shared ? `${b}-${slugify(r.suffix)}` : b]
    })
  )
  const firstCount = tally(first.values())

  return new Map(
    requests.map((r) => {
      const s = first.get(r.id)!
      const clash = (firstCount.get(s) ?? 0) > 1 || taken.has(s)

      return [r.id, clash ? `${s}-${slugify(r.tieBreak)}` : s]
    })
  )
}
```

- [ ] **Step 5: `plan.ts`**

```ts
import { findMatch, normaliseName } from "./match"
import type { ExistingPlace, SourcePlace } from "./types"

export type ChildAction =
  | {
      kind: "match"
      source: SourcePlace
      existing: ExistingPlace
      /** Ids to write onto the existing place, only where it has none. */
      fill: { geonamesId?: string; gssCode?: string }
    }
  | { kind: "create"; source: SourcePlace }
  | {
      kind: "not-added"
      source: SourcePlace
      reason: "parent-has-places" | "name-is-a-region"
    }

export interface ChildPlan {
  actions: ChildAction[]
  /** Existing places no source place matched (for the report). */
  unmatchedExisting: ExistingPlace[]
}

/**
 * What to do with one parent's source places: a Country's Regions or a
 * Region's Areas (spec §6.3). A parent with no places gets them all; one
 * with places only gets more when `fill` is set. `blocked` holds normalised
 * names that may not be created here (other Regions' names, for Areas).
 */
export function planChildren(input: {
  sources: readonly SourcePlace[]
  existing: readonly ExistingPlace[]
  fill: boolean
  typeWords?: readonly string[]
  aliases?: Record<string, string>
  blocked?: ReadonlySet<string>
}): ChildPlan {
  const used = new Set<string>()
  const actions: ChildAction[] = []
  const empty = input.existing.length === 0
  for (const source of input.sources) {
    const free = input.existing.filter((e) => !used.has(e.documentId))
    const match = findMatch(source, free, {
      typeWords: input.typeWords,
      aliases: input.aliases,
    })
    if (match) {
      used.add(match.documentId)
      const fill: { geonamesId?: string; gssCode?: string } = {}
      if (source.geonamesId && !match.geonamesId)
        fill.geonamesId = source.geonamesId
      if (source.gssCode && !match.gssCode) fill.gssCode = source.gssCode
      actions.push({ kind: "match", source, existing: match, fill })
      continue
    }
    if (input.blocked?.has(normaliseName(source.name, input.typeWords))) {
      actions.push({ kind: "not-added", source, reason: "name-is-a-region" })
      continue
    }
    actions.push(
      empty || input.fill
        ? { kind: "create", source }
        : { kind: "not-added", source, reason: "parent-has-places" }
    )
  }

  return {
    actions,
    unmatchedExisting: input.existing.filter((e) => !used.has(e.documentId)),
  }
}
```

The test expects `fill: { geonamesId: "9" }` for a match by name; `fill: {}` when nothing needs writing.

- [ ] **Step 6: `country-profiles.ts` (types, resolver, empty list)**

```ts
/**
 * One Country Profile per country (spec §6.4): what its Regions and Areas
 * are called (Place Labels, UI only) and how the world place import reads
 * its places. A country with no entry imports GeoNames level 1 as Regions
 * and level 2 as Areas, adds nothing where places already exist, and keeps
 * its labels.
 */

export interface ProfileLabels {
  region: string
  regions: string
  area?: string
  areas?: string
}

export interface CountryProfile {
  /** The Country's iso2 in Strapi: "CH", or "GB-ENG" for a UK nation. */
  key: string
  labels?: ProfileLabels
  /** GeoNames level of the Region. Default 1. */
  regionLevel?: 1 | 2
  /** GeoNames level of the Area; null means no Areas. Default 2. */
  areaLevel?: 2 | 3 | null
  /** Where in GeoNames. Default `{ country: key }`; UK nations name their admin1. */
  geonames?: { country: string; admin1?: string }
  /** Add missing places where some already exist. Default false. */
  fill?: boolean
  /** "curated" reads `data/<curatedFile>`. Default "geonames". */
  source?: "geonames" | "curated"
  curatedFile?: string
  /** Type words to drop from either end of a name, e.g. "Landkreis ". */
  tidyNames?: string[]
  /** "admin1": every Area slug ends in its Region's admin1 code (US, IMLS style). */
  areaSlugSuffix?: "on-clash" | "admin1"
  /** Existing place name → the source's spelling, where the matcher can't join them. */
  aliases?: Record<string, string>
}

export interface ResolvedProfile {
  key: string
  labels: ProfileLabels | null
  regionLevel: 1 | 2
  areaLevel: 2 | 3 | null
  geonames: { country: string; admin1?: string }
  fill: boolean
  source: "geonames" | "curated"
  curatedFile: string | null
  tidyNames: string[]
  areaSlugSuffix: "on-clash" | "admin1"
  aliases: Record<string, string>
}

export const PROFILES: CountryProfile[] = []

/** A key's profile with every default filled in; throws on one that can't work. */
export function resolveProfile(
  key: string,
  profiles: readonly CountryProfile[] = PROFILES
): ResolvedProfile {
  const p = profiles.find((x) => x.key === key)
  const regionLevel = p?.regionLevel ?? 1
  const areaLevel = p?.areaLevel === undefined ? 2 : p.areaLevel
  const source = p?.source ?? "geonames"
  if (areaLevel !== null && areaLevel <= regionLevel)
    throw new Error(
      `${key}: the Area level (${areaLevel}) must be below the Region level (${regionLevel})`
    )
  if (source === "curated" && !p?.curatedFile)
    throw new Error(`${key}: a curated profile needs a curatedFile`)
  if (source === "geonames" && !p?.geonames && !/^[A-Z]{2}$/.test(key))
    throw new Error(`${key}: name its GeoNames country`)

  return {
    key,
    labels: p?.labels ?? null,
    regionLevel,
    areaLevel,
    geonames: p?.geonames ?? { country: key },
    fill: p?.fill ?? false,
    source,
    curatedFile: p?.curatedFile ?? null,
    tidyNames: p?.tidyNames ?? [],
    areaSlugSuffix: p?.areaSlugSuffix ?? "on-clash",
    aliases: p?.aliases ?? {},
  }
}

/** The profile's own label words, ignored when matching names. */
export function labelWords(profile: ResolvedProfile): string[] {
  const l = profile.labels

  return l
    ? [l.region, l.regions, l.area, l.areas].filter((w): w is string => !!w)
    : []
}
```

- [ ] **Step 7: `geonames.ts`**

```ts
/**
 * GeoNames readers for the world place import (https://www.geonames.org,
 * CC BY 4.0). Parsing is pure; the loaders download once into `.cache/`.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { fetchSourceFile, type SourceFile, unzip } from "../_shared/source-file"

import type { ResolvedProfile } from "./country-profiles"
import type { SourcePlace } from "./types"

export const GEONAMES_DUMP = "https://download.geonames.org/export/dump"
export const GEONAMES_ATTRIBUTION = "GeoNames (geonames.org), CC BY 4.0"

/** One administrative division. */
export interface GeonamesDivision {
  geonameId: string
  level: 1 | 2 | 3
  /** ISO 3166-1 alpha-2, e.g. "CH". */
  country: string
  admin1: string
  /** "" for level 1. */
  admin2: string
  name: string
  asciiName: string
  altNames: string[]
}

/** `admin1CodesASCII.txt` or `admin2Codes.txt`: `CC.A1[.A2]\tname\tasciiname\tgeonameid`. */
export function parseAdminCodes(
  text: string,
  level: 1 | 2
): GeonamesDivision[] {
  const out: GeonamesDivision[] = []
  for (const line of text.split("\n")) {
    const [code, name, asciiName, geonameId] = line.split("\t")
    if (!code || !name || !geonameId) continue
    const parts = code.split(".")
    if (parts.length !== level + 1) continue
    out.push({
      geonameId: geonameId.trim(),
      level,
      country: parts[0]!,
      admin1: parts[1]!,
      admin2: level === 2 ? parts[2]! : "",
      name: name.trim(),
      asciiName: (asciiName ?? "").trim(),
      altNames: [],
    })
  }

  return out
}

const LEVELS: Record<string, 1 | 2 | 3> = { ADM1: 1, ADM2: 2, ADM3: 3 }

/** A country dump (`XX.txt`, 19 tab-separated columns): its ADM1–ADM3 rows. */
export function parseCountryDump(text: string): GeonamesDivision[] {
  const out: GeonamesDivision[] = []
  for (const line of text.split("\n")) {
    const c = line.split("\t")
    if (c.length < 19 || c[6] !== "A") continue
    const level = LEVELS[c[7]!]
    if (!level) continue
    out.push({
      geonameId: c[0]!,
      level,
      country: c[8]!,
      admin1: c[10]!,
      admin2: c[11]!,
      name: c[1]!,
      asciiName: c[2]!,
      altNames: c[3] ? c[3].split(",").filter(Boolean) : [],
    })
  }

  return out
}

/** Drops one of `words` from the start or end of `name`; never to nothing. */
export function tidyName(name: string, words: readonly string[]): string {
  let out = name
  for (const w of words) {
    if (out.startsWith(w)) out = out.slice(w.length)
    else if (out.endsWith(w)) out = out.slice(0, -w.length)
  }

  return out.trim() || name
}

/** Tidies names unless two places in one group would end up the same. */
function tidyAll(
  places: SourcePlace[],
  words: readonly string[],
  groupOf: (p: SourcePlace) => string
): SourcePlace[] {
  if (words.length === 0) return places
  const tidied = places.map((p) => tidyName(p.name, words))
  const seen = new Map<string, number>()
  places.forEach((p, i) => {
    const k = `${groupOf(p)}|${tidied[i]}`
    seen.set(k, (seen.get(k) ?? 0) + 1)
  })

  return places.map((p, i) => {
    const t = tidied[i]!
    if (t === p.name || (seen.get(`${groupOf(p)}|${t}`) ?? 0) > 1) return p

    return { ...p, name: t, altNames: [...p.altNames, p.name] }
  })
}

/** A profile's Regions and Areas as source places (spec §6.3). */
export function geonamesPlaces(
  profile: ResolvedProfile,
  data: {
    admin1: readonly GeonamesDivision[]
    admin2: readonly GeonamesDivision[]
    dump?: readonly GeonamesDivision[]
  }
): { regions: SourcePlace[]; areas: SourcePlace[] } {
  const { country, admin1 } = profile.geonames
  const alt = new Map((data.dump ?? []).map((d) => [d.geonameId, d.altNames]))
  const rowsAt = (level: 1 | 2 | 3) =>
    (level === 1
      ? data.admin1
      : level === 2
        ? data.admin2
        : (data.dump ?? []).filter((d) => d.level === 3)
    ).filter((d) => d.country === country && (!admin1 || d.admin1 === admin1))
  const keyAt = (d: GeonamesDivision, level: 1 | 2) =>
    level === 1 ? d.admin1 : `${d.admin1}.${d.admin2}`
  const toPlace = (
    d: GeonamesDivision,
    key: string,
    parentKey?: string
  ): SourcePlace => ({
    sourceId: `geonames:${d.geonameId}`,
    geonamesId: d.geonameId,
    name: d.name,
    altNames: [
      ...new Set([d.asciiName, ...d.altNames, ...(alt.get(d.geonameId) ?? [])]),
    ].filter((n) => n && n !== d.name),
    key,
    ...(parentKey === undefined ? {} : { parentKey }),
    admin1: d.admin1,
  })

  const regions = rowsAt(profile.regionLevel).map((d) =>
    toPlace(d, keyAt(d, profile.regionLevel))
  )
  const areas =
    profile.areaLevel === null
      ? []
      : rowsAt(profile.areaLevel).map((d) =>
          toPlace(d, `geonames:${d.geonameId}`, keyAt(d, profile.regionLevel))
        )

  return {
    regions: tidyAll(regions, profile.tidyNames, () => ""),
    areas: tidyAll(areas, profile.tidyNames, (p) => p.parentKey ?? ""),
  }
}

/** The world's level-1 and level-2 divisions (two small files). */
export async function loadAdminCodes(cacheDir: string): Promise<{
  admin1: GeonamesDivision[]
  admin2: GeonamesDivision[]
  files: SourceFile[]
}> {
  const a1 = await fetchSourceFile(
    `${GEONAMES_DUMP}/admin1CodesASCII.txt`,
    cacheDir
  )
  const a2 = await fetchSourceFile(`${GEONAMES_DUMP}/admin2Codes.txt`, cacheDir)

  return {
    admin1: parseAdminCodes(readFileSync(a1.file, "utf8"), 1),
    admin2: parseAdminCodes(readFileSync(a2.file, "utf8"), 2),
    files: [a1, a2],
  }
}

/** One country's ADM1–ADM3 rows, for a profile whose Area level is 3. */
export async function loadCountryDump(
  country: string,
  cacheDir: string
): Promise<{ rows: GeonamesDivision[]; file: SourceFile }> {
  const zip = await fetchSourceFile(`${GEONAMES_DUMP}/${country}.zip`, cacheDir)
  const dir = unzip(zip.file)

  return {
    rows: parseCountryDump(
      readFileSync(path.join(dir, `${country}.txt`), "utf8")
    ),
    file: zip,
  }
}
```

The test's ADM3 example expects `areas[i].parentKey === "02"` (the Land's admin1 code) and the region `key` `"02"`; the UK test expects region keys like `"SCT.T5"`. The area `key` is `geonames:<id>` (areas are never parents).

- [ ] **Step 8: `curated.ts`**

```ts
import type { SourcePlace } from "./types"

/** A curated place list (`data/<file>.json`): Regions with their Areas. */
export interface CuratedList {
  /** The dataset key in `src/seeds/datasets.ts`, e.g. "ons-lad". */
  source: string
  /** Stored as each place's `sourceAttribution`. */
  attribution: string
  regions: {
    key: string
    name: string
    typeLabel?: string
    areas: { gssCode: string; name: string; typeLabel: string }[]
  }[]
}

export function curatedPlaces(list: CuratedList): {
  regions: SourcePlace[]
  areas: SourcePlace[]
} {
  return {
    regions: list.regions.map((r) => ({
      sourceId: `curated:${r.key}`,
      name: r.name,
      altNames: [],
      key: r.key,
      ...(r.typeLabel ? { typeLabel: r.typeLabel } : {}),
    })),
    areas: list.regions.flatMap((r) =>
      r.areas.map((a) => ({
        sourceId: `gss:${a.gssCode}`,
        gssCode: a.gssCode,
        name: a.name,
        altNames: [],
        key: a.gssCode,
        parentKey: r.key,
        typeLabel: a.typeLabel,
      }))
    ),
  }
}
```

- [ ] **Step 9: Run the tests**

Run: `cd apps/strapi && npx vitest run tests/ingests/gazetteer-core.test.ts`
Expected: PASS. Fix the code, not the tests, unless a test contradicts the spec. Then lint the new folder: `cd apps/strapi && npx eslint -c ../../eslint.config.mjs scripts/ingests/gazetteer tests/ingests/gazetteer-core.test.ts`.

---

### Task 11: Gazetteer data, schema fields and credits

**Files:**

- Modify: `apps/strapi/scripts/ingests/gazetteer/country-profiles.ts` (`PROFILES`)
- Create: `apps/strapi/scripts/ingests/gazetteer/data/england.json`
- Modify: `apps/strapi/src/api/region/content-types/region/schema.json`, `apps/strapi/src/api/area/content-types/area/schema.json` (`geonamesId`)
- Modify: `apps/strapi/src/utils/populate-shapes.ts` (`REGION_FIELDS`, `AREA_FIELDS`)
- Modify: `apps/strapi/database/migrations/shared/hot-path-index-sql.js`
- Modify: `apps/strapi/src/seeds/datasets.ts`
- Test: `apps/strapi/tests/ingests/gazetteer-data.test.ts`

**Interfaces:**

- Consumes: Task 10 types.
- Produces: `PROFILES` entries (below); `data/england.json` as a `CuratedList`; REST list responses for Regions and Areas include `geonamesId`.

- [ ] **Step 1: Failing data tests**

Create `apps/strapi/tests/ingests/gazetteer-data.test.ts`:

```ts
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  PROFILES,
  resolveProfile,
} from "../../scripts/ingests/gazetteer/country-profiles"
import type { CuratedList } from "../../scripts/ingests/gazetteer/curated"

const england = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../../scripts/ingests/gazetteer/data/england.json"
    ),
    "utf8"
  )
) as CuratedList

const CEREMONIAL = [
  "Bedfordshire",
  "Berkshire",
  "Bristol",
  "Buckinghamshire",
  "Cambridgeshire",
  "Cheshire",
  "City of London",
  "Cornwall",
  "Cumbria",
  "Derbyshire",
  "Devon",
  "Dorset",
  "Durham",
  "East Riding of Yorkshire",
  "East Sussex",
  "Essex",
  "Gloucestershire",
  "Greater London",
  "Greater Manchester",
  "Hampshire",
  "Herefordshire",
  "Hertfordshire",
  "Isle of Wight",
  "Kent",
  "Lancashire",
  "Leicestershire",
  "Lincolnshire",
  "Merseyside",
  "Norfolk",
  "North Yorkshire",
  "Northamptonshire",
  "Northumberland",
  "Nottinghamshire",
  "Oxfordshire",
  "Rutland",
  "Shropshire",
  "Somerset",
  "South Yorkshire",
  "Staffordshire",
  "Suffolk",
  "Surrey",
  "Tyne and Wear",
  "Warwickshire",
  "West Midlands",
  "West Sussex",
  "West Yorkshire",
  "Wiltshire",
  "Worcestershire",
]

const TYPE_BY_PREFIX: Record<string, string> = {
  E06: "Unitary authority",
  E07: "District",
  E08: "Metropolitan borough",
  E09: "London borough",
}

describe("country profiles", () => {
  it("has one valid entry per key", () => {
    const keys = PROFILES.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of keys) expect(() => resolveProfile(k)).not.toThrow()
  })

  it("covers the 44 countries already in the atlas", () => {
    const existing = [
      "AD",
      "AL",
      "AT",
      "BA",
      "BE",
      "BG",
      "BY",
      "CH",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "EG",
      "ES",
      "FI",
      "FR",
      "GB-ENG",
      "GB-NIR",
      "GB-SCT",
      "GB-WLS",
      "GR",
      "HR",
      "HU",
      "IE",
      "IS",
      "IT",
      "LT",
      "LV",
      "MD",
      "ME",
      "MK",
      "NL",
      "NO",
      "PL",
      "PT",
      "RO",
      "RS",
      "SE",
      "SI",
      "SK",
      "UA",
      "US",
      "XK",
    ]
    const keys = new Set(PROFILES.map((p) => p.key))
    expect(existing.filter((k) => !keys.has(k))).toEqual([])
  })
})

describe("data/england.json", () => {
  it("lists the 48 ceremonial counties", () => {
    expect(england.source).toBe("ons-lad")
    expect(england.regions.map((r) => r.name).sort()).toEqual(
      [...CEREMONIAL].sort()
    )
  })

  it("files every English district once, typed by its GSS code", () => {
    const areas = england.regions.flatMap((r) => r.areas)
    const codes = areas.map((a) => a.gssCode)
    expect(new Set(codes).size).toBe(codes.length)
    expect(areas.length).toBeGreaterThanOrEqual(290)
    expect(areas.length).toBeLessThanOrEqual(300)
    for (const a of areas) {
      expect(a.gssCode).toMatch(/^E0[6-9]\d{6}$/)
      const expected =
        a.gssCode === "E09000001"
          ? "City corporation"
          : TYPE_BY_PREFIX[a.gssCode.slice(0, 3)]
      expect(a.typeLabel).toBe(expected)
    }
  })

  it("puts known districts in the right county", () => {
    const countyOf = (gss: string) =>
      england.regions.find((r) => r.areas.some((a) => a.gssCode === gss))?.name
    expect(countyOf("E09000001")).toBe("City of London")
    expect(countyOf("E09000007")).toBe("Greater London") // Camden
    expect(countyOf("E08000035")).toBe("West Yorkshire") // Leeds
    expect(countyOf("E06000034")).toBe("Essex") // Thurrock
    expect(countyOf("E07000110")).toBe("Kent") // Maidstone
    expect(countyOf("E06000058")).toBe("Dorset") // Bournemouth, Christchurch and Poole
    expect(countyOf("E06000047")).toBe("Durham") // County Durham
  })
})
```

Run: `cd apps/strapi && npx vitest run tests/ingests/gazetteer-data.test.ts`
Expected: FAIL: `england.json` is missing and `PROFILES` is empty.

- [ ] **Step 2: Build `data/england.json`**

Shape: a `CuratedList` with `"source": "ons-lad"`, `"attribution": "Contains public sector information licensed under the Open Government Licence v3.0 (Office for National Statistics)."`, and one entry per ceremonial county: `{ "key": "<slugified county name>", "name": "<county>", "areas": [{ "gssCode", "name", "typeLabel" }] }`. Sort counties by name and areas by name.

1. Get the current English local authority districts (codes starting `E06`, `E07`, `E08`, `E09`) with their official names from the ONS Open Geography Portal (`https://geoportal.statistics.gov.uk`, search "Local Authority Districts names and codes", take the latest April edition, CSV or the feature service's `f=json` query). Record the dataset title and URL at the top of `README.md` (Task 12).
2. Assign each district to its ceremonial county. Prefer an ONS lookup if one exists (search the portal for "ceremonial county" or "lieutenancy"). If none does, assign by hand from Schedule 1 of the Lieutenancies Act 1997 as amended (the counties are aggregates of whole districts, so each district has exactly one). Use the names in `CEREMONIAL` (test above): "Bristol" (not "City of Bristol"), "Durham" (not "County Durham").
3. `typeLabel` from the code prefix: `E06` Unitary authority, `E07` District, `E08` Metropolitan borough, `E09` London borough, except `E09000001` (City of London), which is `City corporation`.
4. Area `name`: the ONS district name as published (for example "Bournemouth, Christchurch and Poole", "County Durham", "Bristol, City of" becomes "Bristol": turn ONS's "X, City of" / "X, County of" into "X").

Write the file with a small throwaway script (in the scratchpad, not the repo) or by hand; the repo keeps only the JSON.

- [ ] **Step 3: Fill `PROFILES`**

Replace `export const PROFILES: CountryProfile[] = []` with:

```ts
export const PROFILES: CountryProfile[] = [
  // ── The UK's four nations ───────────────────────────────────────────────
  {
    key: "GB-ENG",
    labels: {
      region: "County",
      regions: "Counties",
      area: "District",
      areas: "Districts",
    },
    source: "curated",
    curatedFile: "england.json",
    fill: true,
  },
  {
    key: "GB-SCT",
    labels: { region: "Authority", regions: "Authorities" },
    geonames: { country: "GB", admin1: "SCT" },
    regionLevel: 2,
    areaLevel: null,
  },
  {
    key: "GB-WLS",
    labels: { region: "County", regions: "Counties" },
    geonames: { country: "GB", admin1: "WLS" },
    regionLevel: 2,
    areaLevel: null,
  },
  // Was "County"; its Regions are the eleven districts.
  {
    key: "GB-NIR",
    labels: { region: "District", regions: "Districts" },
    geonames: { country: "GB", admin1: "NIR" },
    regionLevel: 2,
    areaLevel: null,
  },

  // ── Countries already in the atlas (Region labels kept unless noted) ────
  {
    key: "AD",
    labels: { region: "Parish", regions: "Parishes" },
    areaLevel: null,
  },
  {
    key: "AL",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "AT",
    labels: {
      region: "State",
      regions: "States",
      area: "District",
      areas: "Districts",
    },
  },
  // Was "Canton"; its Regions are the two entities and Brčko.
  {
    key: "BA",
    labels: {
      region: "Entity",
      regions: "Entities",
      area: "Canton",
      areas: "Cantons",
    },
  },
  // Was "Province"; its Regions are Brussels, Flanders and Wallonia.
  {
    key: "BE",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Province",
      areas: "Provinces",
    },
  },
  {
    key: "BG",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "BY",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "CH",
    labels: {
      region: "Canton",
      regions: "Cantons",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "CY",
    labels: { region: "District", regions: "Districts" },
    areaLevel: null,
  },
  {
    key: "CZ",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  // GeoNames level 2 is Regierungsbezirke; Kreise are level 3.
  {
    key: "DE",
    labels: {
      region: "State",
      regions: "States",
      area: "District",
      areas: "Districts",
    },
    areaLevel: 3,
    tidyNames: ["Landkreis ", "Kreisfreie Stadt ", "Stadtkreis ", "Kreis "],
  },
  {
    key: "DK",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "EE",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "EG",
    labels: {
      region: "Governorate",
      regions: "Governorates",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "ES",
    labels: {
      region: "Community",
      regions: "Communities",
      area: "Province",
      areas: "Provinces",
    },
  },
  {
    key: "FI",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "FR",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Department",
      areas: "Departments",
    },
  },
  {
    key: "GR",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Regional unit",
      areas: "Regional units",
    },
  },
  {
    key: "HR",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "HU",
    labels: {
      region: "County",
      regions: "Counties",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "IE",
    labels: { region: "County", regions: "Counties" },
    regionLevel: 2,
    areaLevel: null,
  },
  {
    key: "IS",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "IT",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Province",
      areas: "Provinces",
    },
  },
  {
    key: "LT",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  // Was "Municipality"; its Regions are the five planning regions.
  {
    key: "LV",
    labels: { region: "Region", regions: "Regions" },
    areaLevel: null,
  },
  {
    key: "MD",
    labels: { region: "District", regions: "Districts" },
    areaLevel: null,
  },
  {
    key: "ME",
    labels: { region: "Municipality", regions: "Municipalities" },
    areaLevel: null,
  },
  {
    key: "MK",
    labels: { region: "Municipality", regions: "Municipalities" },
    areaLevel: null,
  },
  {
    key: "NL",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "NO",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "PL",
    labels: {
      region: "Voivodeship",
      regions: "Voivodeships",
      area: "County",
      areas: "Counties",
    },
  },
  {
    key: "PT",
    labels: {
      region: "District",
      regions: "Districts",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "RO",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "RS",
    labels: {
      region: "District",
      regions: "Districts",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "SE",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  // Was "Municipality"; its Regions are the twelve statistical regions.
  {
    key: "SI",
    labels: { region: "Region", regions: "Regions" },
    areaLevel: null,
  },
  {
    key: "SK",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "UA",
    labels: {
      region: "Oblast",
      regions: "Oblasts",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "US",
    labels: {
      region: "State",
      regions: "States",
      area: "County",
      areas: "Counties",
    },
    fill: true,
    areaSlugSuffix: "admin1",
  },
  // Was "Municipality"; its Regions are the seven districts.
  {
    key: "XK",
    labels: {
      region: "District",
      regions: "Districts",
      area: "Municipality",
      areas: "Municipalities",
    },
  },

  // ── Countries with no places yet ────────────────────────────────────────
  {
    key: "AR",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Department",
      areas: "Departments",
    },
  },
  {
    key: "AU",
    labels: {
      region: "State",
      regions: "States",
      area: "Local government area",
      areas: "Local government areas",
    },
  },
  {
    key: "BR",
    labels: {
      region: "State",
      regions: "States",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "CA",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Division",
      areas: "Divisions",
    },
  },
  {
    key: "CN",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Prefecture",
      areas: "Prefectures",
    },
  },
  {
    key: "IN",
    labels: {
      region: "State",
      regions: "States",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "JP",
    labels: {
      region: "Prefecture",
      regions: "Prefectures",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "MX",
    labels: {
      region: "State",
      regions: "States",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "NG",
    labels: {
      region: "State",
      regions: "States",
      area: "Local government area",
      areas: "Local government areas",
    },
  },
  {
    key: "NZ",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "RU",
    labels: {
      region: "Federal subject",
      regions: "Federal subjects",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "TR",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "ZA",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  // Too small for a second level.
  { key: "LI", areaLevel: null },
  { key: "MC", areaLevel: null },
  { key: "SG", areaLevel: null },
  { key: "SM", areaLevel: null },
  { key: "VA", areaLevel: null },
]
```

Levels and labels outside England, the US and Germany are first guesses; Task 13's dry runs check them.

- [ ] **Step 4: `geonamesId` on Regions and Areas**

In both `region/schema.json` and `area/schema.json`, after `entityRef`, add:

```json
    "geonamesId": {
      "type": "string",
      "unique": true,
      "pluginOptions": {
        "i18n": {
          "localized": false
        }
      }
    },
```

In `populate-shapes.ts` add `"geonamesId",` after `"entityRef",` in `REGION_FIELDS` and `AREA_FIELDS`. In `hot-path-index-sql.js` add, after the `SLUG_TABLES` line in `HOT_PATH_INDEXES`:

```js
  // World place import: matches Regions and Areas by GeoNames id.
  index("regions", ["geonames_id"]),
  index("areas", ["geonames_id"]),
```

Regenerate types: `cd apps/strapi && pnpm strapi ts:generate-types`.

- [ ] **Step 5: Credits**

Append to `DATASET_SEED` in `src/seeds/datasets.ts`:

```ts
  {
    key: "geonames",
    name: "GeoNames administrative divisions",
    publisher: "GeoNames",
    sourceUrl: "https://www.geonames.org",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution: "Contains place names from GeoNames (geonames.org), licensed under CC BY 4.0.",
    coverage: "First- and second-level administrative divisions of every country (third level for Germany)",
    importMechanism:
      "apps/strapi/scripts/ingests/gazetteer/import.ts, reading admin1CodesASCII.txt, admin2Codes.txt and, where a country's Areas are level 3, its country dump",
    notes:
      'Creates Regions and Areas only; libraries are not imported from GeoNames. Imported places carry a geonamesId and sourceAttribution "GeoNames (geonames.org), CC BY 4.0".',
  },
  {
    key: "ons-lad",
    name: "Local Authority Districts",
    publisher: "Office for National Statistics",
    sourceUrl: "https://geoportal.statistics.gov.uk",
    licence: "Open Government Licence v3.0",
    licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    licenceStatus: "stated_by_publisher",
    redistribution: "permitted_with_attribution",
    attribution:
      "Contains public sector information licensed under the Open Government Licence v3.0 (Office for National Statistics).",
    coverage: "England's local authority districts, filed under the 48 ceremonial counties",
    importMechanism:
      "apps/strapi/scripts/ingests/gazetteer/import.ts, reading the curated data/england.json",
    notes:
      "District names and GSS codes come from ONS; the district-to-county assignment follows the Lieutenancies Act 1997 as amended.",
  },
```

- [ ] **Step 6: Verify**

Run: `cd apps/strapi && npx vitest run tests/ingests tests/populate-shapes-schema.test.ts && cd ../.. && pnpm --filter @repo/strapi typecheck`
Expected: PASS, clean.

---

### Task 12: Gazetteer CLI and README

**Files:**

- Create: `apps/strapi/scripts/ingests/gazetteer/import.ts`, `apps/strapi/scripts/ingests/gazetteer/README.md`
- Modify: `.gitignore` (add `apps/strapi/scripts/ingests/**/.runs/`)

**Interfaces:**

- Consumes: everything from Tasks 10–11; `StrapiClient` (`scripts/strapi-client.ts`: `findAll`, `post`, `put`).
- Produces: `npx tsx scripts/ingests/gazetteer/import.ts [--dry-run] [--country=CH,GB-ENG] [--step=labels,regions,areas]` (run from `apps/strapi`), writing a JSON report to `scripts/ingests/gazetteer/.runs/<ISO time>.json`.

The CLI has no unit test of its own: its decisions live in the tested pure modules, and Task 13's dry runs exercise it end to end.

- [ ] **Step 1: Write `import.ts`**

```ts
/**
 * World place import (spec: docs/superpowers/specs/2026-10-04-place-labels-and-world-places-design.md §6).
 * Sets each profiled Country's Place Labels, then adds the Regions and Areas
 * GeoNames (or a curated list) has and the atlas lacks. It only ever adds:
 * nothing is renamed, moved or deleted.
 *
 * Run from apps/strapi, after scripts/populate-world-countries.ts:
 *   STRAPI_API_TOKEN=<ingest-* token> STRAPI_BRIDGE_SECRET=… \
 *     npx tsx scripts/ingests/gazetteer/import.ts --dry-run --country=CH,GB-ENG
 *
 *   --dry-run          plan and report, write nothing
 *   --country=A,B      only these Country keys (iso2, or GB-ENG style)
 *   --step=labels,regions,areas   default: all three
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { flag, listOf, parseArgs } from "../_shared/cli"
import { slugify } from "../_shared/text"
import { StrapiClient, type StrapiEntity } from "../../strapi-client"

import {
  labelWords,
  resolveProfile,
  type ResolvedProfile,
} from "./country-profiles"
import { curatedPlaces, type CuratedList } from "./curated"
import {
  GEONAMES_ATTRIBUTION,
  geonamesPlaces,
  loadAdminCodes,
  loadCountryDump,
} from "./geonames"
import { planChildren } from "./plan"
import { planSlugs, type SlugRequest } from "./slugs"
import type { ExistingPlace, SourcePlace } from "./types"

const args = parseArgs()
const DRY_RUN = flag(args, "dry-run")
const ONLY = listOf(args, "country")
const STEPS = new Set(
  (args.step && args.step !== "true"
    ? args.step
    : "labels,regions,areas"
  ).split(",")
)
const CACHE = path.join(__dirname, ".cache")
const RUNS = path.join(__dirname, ".runs")
const CONCURRENCY = 8
/** A parent with more children than this is flagged: the place picker lists 1,000. */
const PICKER_CAP = 1000

type Ref = { documentId: string } | null | undefined
type StrapiCountry = StrapiEntity & {
  name: string
  slug: string
  iso2?: string | null
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
  continent?: Ref
}
type StrapiPlace = StrapiEntity & {
  name: string
  slug: string
  geonamesId?: string | null
  gssCode?: string | null
  country?: Ref
  region?: Ref
}

interface CountryReport {
  key: string
  labels: Record<string, { from: string | null; to: string }>
  regions: {
    created: number
    matched: number
    filled: number
    notAdded: string[]
    ambiguous: string[]
    unmatchedExisting: string[]
  }
  areas: {
    created: number
    matched: number
    filled: number
    notAdded: string[]
    ambiguous: string[]
    unmatchedExisting: string[]
    noRegion: string[]
  }
  suffixedSlugs: string[]
  largeParents: string[]
  errors: string[]
}

/** A Region in the plan: one that exists, or one this run creates. */
type PlannedRegion = {
  name: string
  slug: string
  documentId?: string
  createId?: string
}

type RegionCreate = {
  createId: string
  country: StrapiCountry
  source: SourcePlace
  attribution: string
  report: CountryReport
}
type AreaCreate = {
  createId: string
  country: StrapiCountry
  region: PlannedRegion
  source: SourcePlace
  attribution: string
  report: CountryReport
  profile: ResolvedProfile
}
type Fill = {
  uid: "regions" | "areas"
  documentId: string
  data: Record<string, string>
}

const LABEL_FIELDS = [
  ["regionTypeLabel", "region"],
  ["regionsSectionLabel", "regions"],
  ["areaTypeLabel", "area"],
  ["areasSectionLabel", "areas"],
] as const

const toExisting = (p: StrapiPlace): ExistingPlace => ({
  documentId: p.documentId,
  name: p.name,
  slug: p.slug,
  geonamesId: p.geonamesId ?? null,
  gssCode: p.gssCode ?? null,
})

const emptyReport = (key: string): CountryReport => ({
  key,
  labels: {},
  regions: {
    created: 0,
    matched: 0,
    filled: 0,
    notAdded: [],
    ambiguous: [],
    unmatchedExisting: [],
  },
  areas: {
    created: 0,
    matched: 0,
    filled: 0,
    notAdded: [],
    ambiguous: [],
    unmatchedExisting: [],
    noRegion: [],
  },
  suffixedSlugs: [],
  largeParents: [],
  errors: [],
})

async function inPool<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await run(items[next++]!)
    })
  )
}

/** The label fields that differ from the profile's. */
function labelChanges(country: StrapiCountry, profile: ResolvedProfile) {
  const out: Record<string, { from: string | null; to: string }> = {}
  for (const [field, key] of LABEL_FIELDS) {
    const to = profile.labels?.[key]
    const from = country[field] ?? null
    if (to !== undefined && from !== to) out[field] = { from, to }
  }

  return out
}

function sourcesFor(
  profile: ResolvedProfile,
  geo: Awaited<ReturnType<typeof loadAdminCodes>>,
  dumps: Map<string, Awaited<ReturnType<typeof loadCountryDump>>>
) {
  if (profile.source === "curated") {
    const list = JSON.parse(
      readFileSync(path.join(__dirname, "data", profile.curatedFile!), "utf8")
    ) as CuratedList

    return { ...curatedPlaces(list), attribution: list.attribution }
  }

  return {
    ...geonamesPlaces(profile, {
      admin1: geo.admin1,
      admin2: geo.admin2,
      dump: dumps.get(profile.geonames.country)?.rows,
    }),
    attribution: GEONAMES_ATTRIBUTION,
  }
}

async function main() {
  if (DRY_RUN) console.log("DRY RUN: nothing will be written\n")
  const client = new StrapiClient()
  const [countries, regions, areas] = await Promise.all([
    client.findAll<StrapiCountry>("countries", { status: "published" }),
    client.findAll<StrapiPlace>("regions", { status: "draft" }),
    client.findAll<StrapiPlace>("areas", { status: "draft" }),
  ])
  const geo = await loadAdminCodes(CACHE)
  const dumps = new Map<string, Awaited<ReturnType<typeof loadCountryDump>>>()
  const reports: CountryReport[] = []
  const regionCreates: RegionCreate[] = []
  const areaCreates: AreaCreate[] = []
  const fills: Fill[] = []
  const labelWrites: {
    country: StrapiCountry
    data: Record<string, string>
  }[] = []

  const selected = countries
    .filter((c) => c.iso2 && (!ONLY || ONLY.includes(c.iso2.toUpperCase())))
    .sort((a, b) => a.iso2!.localeCompare(b.iso2!))

  // ── Plan Regions, country by country ──────────────────────────────────────
  const regionPlans = new Map<string, Map<string, PlannedRegion>>()
  for (const country of selected) {
    const key = country.iso2!.toUpperCase()
    const report = emptyReport(key)
    reports.push(report)
    try {
      const profile = resolveProfile(key)
      const labels = labelChanges(country, profile)
      report.labels = labels
      if (STEPS.has("labels") && Object.keys(labels).length > 0)
        labelWrites.push({
          country,
          data: Object.fromEntries(
            Object.entries(labels).map(([f, v]) => [f, v.to])
          ),
        })
      if (!STEPS.has("regions") && !STEPS.has("areas")) continue

      if (
        profile.source === "geonames" &&
        profile.areaLevel === 3 &&
        !dumps.has(profile.geonames.country)
      )
        dumps.set(
          profile.geonames.country,
          await loadCountryDump(profile.geonames.country, CACHE)
        )
      const places = sourcesFor(profile, geo, dumps)
      const own = regions.filter(
        (r) => r.country?.documentId === country.documentId
      )
      const plan = planChildren({
        sources: places.regions,
        existing: own.map(toExisting),
        fill: profile.fill,
        typeWords: labelWords(profile),
        aliases: profile.aliases,
      })
      report.regions.unmatchedExisting = plan.unmatchedExisting.map(
        (e) => e.name
      )
      report.regions.ambiguous = plan.ambiguous.map((s) => s.name)
      const byKey = new Map<string, PlannedRegion>()
      for (const a of plan.actions) {
        if (a.kind === "match") {
          report.regions.matched++
          byKey.set(a.source.key, {
            name: a.existing.name,
            slug: a.existing.slug,
            documentId: a.existing.documentId,
          })
          if (Object.keys(a.fill).length > 0) {
            report.regions.filled++
            fills.push({
              uid: "regions",
              documentId: a.existing.documentId,
              data: a.fill as Record<string, string>,
            })
          }
        } else if (a.kind === "create") {
          if (!STEPS.has("regions")) continue
          const createId = a.source.sourceId
          regionCreates.push({
            createId,
            country,
            source: a.source,
            attribution: places.attribution,
            report,
          })
          byKey.set(a.source.key, { name: a.source.name, slug: "", createId })
        } else report.regions.notAdded.push(`${a.source.name} (${a.reason})`)
      }
      regionPlans.set(key, byKey)
    } catch (err) {
      report.errors.push(String(err))
    }
  }

  // ── Region slugs, across the whole run ────────────────────────────────────
  const regionSlugs = planSlugs(
    regionCreates.map(
      (c): SlugRequest => ({
        id: c.createId,
        name: c.source.name,
        suffix: c.country.iso2!,
        tieBreak: c.source.geonamesId ?? c.source.key,
      })
    ),
    new Set(regions.map((r) => r.slug))
  )
  for (const c of regionCreates) {
    const slug = regionSlugs.get(c.createId)!
    if (slug !== slugify(c.source.name))
      c.report.suffixedSlugs.push(`${c.source.name} → ${slug}`)
    const planned = regionPlans
      .get(c.country.iso2!.toUpperCase())
      ?.get(c.source.key)
    if (planned) planned.slug = slug
  }

  // ── Plan Areas ─────────────────────────────────────────────────────────────
  if (STEPS.has("areas"))
    for (const country of selected) {
      const key = country.iso2!.toUpperCase()
      const report = reports.find((r) => r.key === key)!
      const byKey = regionPlans.get(key)
      if (!byKey) continue
      try {
        const profile = resolveProfile(key)
        if (profile.areaLevel === null && profile.source === "geonames")
          continue
        const places = sourcesFor(profile, geo, dumps)
        const typeWords = labelWords(profile)
        const byParent = new Map<string, SourcePlace[]>()
        for (const a of places.areas) {
          const list = byParent.get(a.parentKey ?? "") ?? []
          list.push(a)
          byParent.set(a.parentKey ?? "", list)
        }
        for (const [parentKey, sources] of byParent) {
          const region = byKey.get(parentKey)
          if (!region) {
            report.areas.noRegion.push(...sources.map((s) => s.name))
            continue
          }
          if (sources.length > PICKER_CAP)
            report.largeParents.push(`${region.name}: ${sources.length}`)
          const existing = region.documentId
            ? areas
                .filter((a) => a.region?.documentId === region.documentId)
                .map(toExisting)
            : []
          const plan = planChildren({
            sources,
            existing,
            fill: profile.fill,
            typeWords,
            aliases: profile.aliases,
          })
          report.areas.ambiguous.push(
            ...plan.ambiguous.map((s) => `${s.name} (${region.name})`)
          )
          report.areas.unmatchedExisting.push(
            ...plan.unmatchedExisting.map((e) => `${e.name} (${region.name})`)
          )
          for (const a of plan.actions) {
            if (a.kind === "match") {
              report.areas.matched++
              if (Object.keys(a.fill).length > 0) {
                report.areas.filled++
                fills.push({
                  uid: "areas",
                  documentId: a.existing.documentId,
                  data: a.fill as Record<string, string>,
                })
              }
            } else if (a.kind === "create")
              areaCreates.push({
                createId: a.source.sourceId,
                country,
                region,
                source: a.source,
                attribution: places.attribution,
                report,
                profile,
              })
            else
              report.areas.notAdded.push(
                `${a.source.name} in ${region.name} (${a.reason})`
              )
          }
        }
      } catch (err) {
        report.errors.push(String(err))
      }
    }

  const areaSlugs = planSlugs(
    areaCreates.map((c): SlugRequest => {
      const us = c.profile.areaSlugSuffix === "admin1" && !!c.source.admin1

      return {
        id: c.createId,
        name: c.source.name,
        suffix: us ? c.source.admin1! : c.region.slug,
        alwaysSuffix: us,
        tieBreak: c.source.geonamesId ?? c.source.gssCode ?? c.source.key,
      }
    }),
    new Set(areas.map((a) => a.slug))
  )
  for (const c of areaCreates) {
    const slug = areaSlugs.get(c.createId)!
    if (
      slug !== slugify(c.source.name) &&
      c.profile.areaSlugSuffix !== "admin1"
    )
      c.report.suffixedSlugs.push(`${c.source.name} → ${slug}`)
  }

  // ── Write ──────────────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    for (const w of labelWrites)
      await client.put(`/countries/${w.country.documentId}?status=published`, {
        data: w.data,
      })

    const createdRegion = new Map<string, string>()
    await inPool(regionCreates, async (c) => {
      try {
        const res = await client.post<{ data: StrapiEntity }>(
          "/regions?status=published",
          {
            data: {
              name: c.source.name,
              slug: regionSlugs.get(c.createId),
              ...(c.source.typeLabel ? { typeLabel: c.source.typeLabel } : {}),
              ...(c.source.geonamesId
                ? { geonamesId: c.source.geonamesId }
                : {}),
              sourceAttribution: c.attribution,
              country: { connect: [{ documentId: c.country.documentId }] },
              ...(c.country.continent?.documentId
                ? {
                    continent: {
                      connect: [{ documentId: c.country.continent.documentId }],
                    },
                  }
                : {}),
            },
          }
        )
        createdRegion.set(c.createId, res.data.documentId)
        c.report.regions.created++
      } catch (err) {
        c.report.errors.push(`Region ${c.source.name}: ${String(err)}`)
      }
    })

    // A fill writes the draft only (no ?status), so nothing else is published.
    await inPool(fills, async (f) => {
      try {
        await client.put(`/${f.uid}/${f.documentId}`, { data: f.data })
      } catch (err) {
        console.error(`Fill ${f.uid} ${f.documentId}: ${String(err)}`)
      }
    })

    await inPool(areaCreates, async (c) => {
      const regionId =
        c.region.documentId ??
        (c.region.createId ? createdRegion.get(c.region.createId) : undefined)
      if (!regionId) {
        c.report.errors.push(
          `Area ${c.source.name}: its Region ${c.region.name} wasn't created`
        )

        return
      }
      try {
        await client.post("/areas?status=published", {
          data: {
            name: c.source.name,
            slug: areaSlugs.get(c.createId),
            ...(c.source.typeLabel ? { typeLabel: c.source.typeLabel } : {}),
            ...(c.source.geonamesId ? { geonamesId: c.source.geonamesId } : {}),
            ...(c.source.gssCode ? { gssCode: c.source.gssCode } : {}),
            sourceAttribution: c.attribution,
            region: { connect: [{ documentId: regionId }] },
            country: { connect: [{ documentId: c.country.documentId }] },
          },
        })
        c.report.areas.created++
      } catch (err) {
        c.report.errors.push(`Area ${c.source.name}: ${String(err)}`)
      }
    })
  } else {
    for (const c of regionCreates) c.report.regions.created++
    for (const c of areaCreates) c.report.areas.created++
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  mkdirSync(RUNS, { recursive: true })
  const file = path.join(
    RUNS,
    `${new Date().toISOString().replaceAll(":", "-")}.json`
  )
  writeFileSync(
    file,
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        steps: [...STEPS],
        countries: ONLY,
        inputs: [...geo.files, ...[...dumps.values()].map((d) => d.file)],
        reports,
      },
      null,
      2
    )
  )
  for (const r of reports) {
    const line = [
      Object.keys(r.labels).length > 0
        ? `labels ${Object.keys(r.labels).length}`
        : "",
      `regions +${r.regions.created} =${r.regions.matched}${r.regions.notAdded.length > 0 ? ` (${r.regions.notAdded.length} not added)` : ""}`,
      `areas +${r.areas.created} =${r.areas.matched}${r.areas.notAdded.length > 0 ? ` (${r.areas.notAdded.length} not added)` : ""}`,
      r.errors.length > 0 ? `ERRORS ${r.errors.length}` : "",
    ].filter(Boolean)
    console.log(`${r.key.padEnd(7)} ${line.join("  ")}`)
  }
  console.log(`\n${DRY_RUN ? "Dry run" : "Run"} report: ${file}`)
  if (reports.some((r) => r.errors.length > 0)) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Notes for the implementer:

- `findAll` pages at 100 with `sort=id:asc`; Regions and Areas list responses are shaped server-side by `REGION_SHAPES.list` / `AREA_SHAPES.list` (Task 11 added `geonamesId`; both populate `country`, and Areas also `region`, with `documentId`). Check one page by hand before the first dry run: `curl -s -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "X-Service-Secret: $STRAPI_BRIDGE_SECRET" "http://127.0.0.1:1337/api/areas?pagination[pageSize]=1&status=draft" | head -c 600` must show `geonamesId`, `gssCode`, `region.documentId` and `country.documentId`. If a relation is missing, add it to that shape's `list.populate` in `populate-shapes.ts`.
- If `country.continent` is missing from the Countries list response, add `continent: continentRef` to `COUNTRY_SHAPES.list.populate` (it is there today).

- [ ] **Step 2: README**

Create `apps/strapi/scripts/ingests/gazetteer/README.md` covering: what it does (adds Regions and Areas, sets Place Labels, never renames, moves or deletes); sources and licences (GeoNames CC BY 4.0 with the three URLs; ONS OGL v3 with the dataset title and URL used for `england.json`); the profile file and what each field means (copy the spec §6.4 table); run order (1. `npx tsx scripts/populate-world-countries.ts`, 2. `import.ts --dry-run`, 3. review `.runs/*.json`, 4. `import.ts`, 5. `pnpm --filter @repo/strapi seed:meilisearch` so library documents carry the Region labels); tokens (`STRAPI_API_TOKEN` named `ingest-*` with access to countries, regions and areas; `STRAPI_BRIDGE_SECRET`); the report fields; and known gaps (non-Latin names never match by name; levels and labels outside the 44 existing countries plus the US are first guesses). Plain English, short sentences.

- [ ] **Step 3: Ignore run reports**

In `.gitignore`, under `# Downloaded dataset files (ingests fetch them on demand)`, add `apps/strapi/scripts/ingests/**/.runs/`.

- [ ] **Step 4: Verify**

Run: `cd apps/strapi && npx tsc --noEmit -p . && npx eslint -c ../../eslint.config.mjs scripts/ingests/gazetteer`
Expected: clean. (If `apps/strapi/tsconfig.json` excludes `scripts/`, run `npx tsc --noEmit --strict --esModuleInterop --skipLibCheck --module commonjs --target es2022 scripts/ingests/gazetteer/import.ts` instead.)

---

### Task 13: Dry runs, review, full local run

**Files:** none changed unless a dry run shows a profile or alias fix (then `country-profiles.ts` and its tests).

Needs Strapi running locally (`http://127.0.0.1:1337`) with Tasks 4, 6 and 11 deployed (restart `strapi develop` after the schema changes so the columns and indexes exist), an `ingest-*` API token, and `STRAPI_BRIDGE_SECRET` from `apps/strapi/.env`.

- [ ] **Step 1: Countries**

```bash
cd apps/strapi
export STRAPI_URL=http://127.0.0.1:1337 STRAPI_API_TOKEN=<ingest-* token> STRAPI_BRIDGE_SECRET=$(grep ^STRAPI_BRIDGE_SECRET= .env | cut -d= -f2-)
npx tsx scripts/populate-world-countries.ts --dry-run
npx tsx scripts/populate-world-countries.ts
```

Expected: about 200 countries created, none named "United Kingdom". Check with the MCP: `list_country` total ≈ 247.

- [ ] **Step 2: Dry runs for the four reference countries**

```bash
npx tsx scripts/ingests/gazetteer/import.ts --dry-run --country=CH,GB-ENG,US,DE
```

Read the report. Expected:

- **CH:** labels unchanged; 26 Regions matched (`filled` 26); about 140 District Areas created.
- **GB-ENG:** labels change to County/Counties/District/Districts; 12 Regions matched, 36 created; about 296 Areas created (including Thurrock, North Somerset, North Lincolnshire, Windsor and Maidenhead and Bournemouth, Christchurch and Poole, whose existing Regions of the same name stay); the five unitary Regions in `unmatchedExisting`.
- **US:** New York matched; 50 Regions created (49 states and DC); Areas `-xx` suffixed; IMLS counties matched (not created twice).
- **DE:** 16 States matched; about 400 Districts created; few `suffixedSlugs`.

Fix any profile, alias or matching problem the report shows, re-run the tests (`npx vitest run tests/ingests`), and dry-run again until the four look right. **Stop here and show the owner the four summaries** before writing anything.

- [ ] **Step 3: Whole-world dry run**

```bash
npx tsx scripts/ingests/gazetteer/import.ts --dry-run
```

Review `largeParents`, `errors`, and countries where `regions.notAdded` is large (their existing Regions use a different level). Adjust profiles where the fix is clear; leave the rest to the report.

- [ ] **Step 4: Write**

```bash
npx tsx scripts/ingests/gazetteer/import.ts --country=CH,GB-ENG,US,DE
npx tsx scripts/ingests/gazetteer/import.ts
pnpm seed:meilisearch
```

Spot-check with the MCP (`list_region` filtered by `entityRef` `$startsWith "europe:england:"` → 53; `list_area` total in the tens of thousands) and in the browser: `/europe/england/west-yorkshire` exists, its hero says "County"; the Index editor's Region select reads "County" after picking England (Task 9); Find libraries' third select reads "County" for England.

- [ ] **Step 5: Re-run to prove idempotence**

```bash
npx tsx scripts/ingests/gazetteer/import.ts --dry-run
```

Expected: every country `+0` Regions and `+0` Areas.

---

### Task 14: Docs and the whole-suite check

**Files:**

- Modify: `CLAUDE.md` (has other uncommitted edits: change only the lines below), `CONTEXT.md`
- Modify: `docs/superpowers/plans/2026-09-30-atlas-vector-tiles.md` (one line)

- [ ] **Step 1: CLAUDE.md**

- Pillar 6: drop "Region/Area requests" (and "role applications and Region/Area requests" becomes "role applications").
- Scale target, "Known places that don't meet this yet": drop ", and location-page maps stop at 500 pins (`/libraries/map-pins`)" so it reads only about the Atlas.
- Infrastructure: delete "GeoJSON boundary files served from `public/boundaries/`".
- Future Goals §3: in "Submission types and queues" drop `location_request` from the `index` list; delete the "Location Requests:" bullet; in "On approval" delete "and under the Region or Area of an approved Location Request it references" and the `location_request creates the Region or Area…` sentence and "Regions, Areas" from the `resultDocumentId` list; in Notifications change "a Role Application or Location Request reaching `pending`" to "a Role Application reaching `pending`"; in the points sentence change "except `role_application` and `location_request`" to "except `role_application`".
- Testing access: drop "and Location Request" from the access project description.
- Map helpers: replace the four bullets with "Basemap attribution and bounding boxes: `components/map/map.helpers.ts`. Location pages use `components/location/LocationHeroMap.tsx`."; delete the "Map panel pattern (LibraryPinPanel)" section.
- Data Model: after the hierarchy diagram add one line: "Each Country's Place Labels (`regionTypeLabel`, `regionsSectionLabel`, `areaTypeLabel`, `areasSectionLabel`) say what it calls its Regions and Areas (Canton, County, District). They are UI only; `placeLabels()` in `components/location/location-page.helpers.ts` reads them."
- Development Notes: add "World places: `apps/strapi/scripts/ingests/gazetteer/` (README) adds every country's Regions and Areas from GeoNames (England from a curated ONS list) and sets Place Labels; it only adds, never renames, moves or deletes."

- [ ] **Step 2: CONTEXT.md**

Delete the **Location Request** term; remove "and Location Requests" from **Submission** and "(library submissions and Location Requests)" → "(library submissions)" in **Moderation Queue**; remove "or a Location Request" from **Capability**. Add the **Place Labels** and **Country Profile** terms from spec §2.

- [ ] **Step 3: Vector-tiles plan**

Under its status line add: `**Note (2026-10-04):** \`InteractiveMap\` and the \`/map-pins\` routes were removed (place labels and world places spec); location pages use \`LocationHeroMap\`.`

- [ ] **Step 4: Whole suite**

```bash
cd packages/access && pnpm test && cd ../..
pnpm --filter @repo/strapi test && pnpm --filter @repo/strapi typecheck
pnpm --filter @repo/ui test && pnpm --filter @repo/ui typecheck
pnpm --filter @repo/strapi build:plugins
```

Expected: all green. Lint every file this plan touched (see Commands). Report any pre-existing failure separately from this work's.

---

## Order

Tasks 1 → 2 → 3 (after the location lookup is committed) → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14. Tasks 10 and 11 don't depend on 3–9 and may run earlier; Task 13 needs 4, 6, 9 and 11–12.

## Amendments (2026-10-04, after the Task 10 review)

Owner decision: every world place is imported; shared names are allowed. Changes to Task 10's modules, made in its fix round:

- `_shared/text.ts` gains `transliterate()` (ł→l, ø→o, æ→ae, ß→ss, đ→d, ı→i, þ→th, œ→oe and capitals), used by `slugify` and by `match.ts` before accents are stripped. "Łódź Voivodeship" slugs to `lodz-voivodeship`.
- `planChildren` matches by id for every source first, then by name; a name match is used only when it pairs one source with one existing place. Ambiguous sources match nothing, are treated as unmatched, and are returned in `ChildPlan.ambiguous: SourcePlace[]`. The result is order-independent.
- The "name is a different Region" skip (`blocked`, reason `name-is-a-region`) is removed; `not-added` only has `parent-has-places`.
- `planSlugs` guarantees uniqueness after the tie-break (`-2`, `-3`…), and an empty suffix adds nothing.
- Task 12's report gains `regions.ambiguous` and `areas.ambiguous`; the England profile's alias is dropped (it only fed the removed skip).

## Amendments (2026-10-04, final fix wave)

- A fill's `PUT` had no `?status`, so it silently published whichever draft it touched (Strapi 5's default). `import.ts` now also reads published Regions and Areas and only writes a fill (`?status=published`) when the place's draft already matches its published version (`decideFill` in the new `run-rules.ts`); otherwise it's left unwritten and listed in the report as `fillsSkipped`. README, spec §6.5 and the inline comment are corrected to match.
- The unbounded public route `GET /areas/slugs` (and its only caller, the dead `fetchAllAreaSlugs`) is deleted — nothing used it.
- The world place import downloaded every country-with-Regions' full GeoNames dump even when every one of its places already carried a `geonamesId`/`gssCode` and so needed no name matching at all. It now loads a country's dump only for an Area level-3 split, or when at least one existing Region or Area there is still missing its id.

## Follow-up tasks (owner decisions after the final review, 2026-10-04)

Run after the final fix wave. Same Global Constraints (never commit; surgical edits; no git writes).

### Task 15: Delete the dead Area page code

Areas have had no route since commit cb686c8 (`[region]/[...rest]` became `[region]/[library]`), so `AreaDetailPage` is unreachable. Owner decision: delete it; Areas stay as data for filing and filters.

- Delete `apps/ui/src/components/area/AreaDetailPage.tsx`, `area-map.ts` and `__tests__/area-map.test.ts` (and the folder if empty).
- `apps/ui/src/lib/strapi-api/content/server.ts`: delete `fetchArea` and `PopulatedAreaData` (and any type only they use). In `fetchPlaceLink`, keep only the kinds something still calls (`grep -rn "fetchPlaceLink(" apps/ui/src`); remove the unused branches and their types.
- Strapi: delete the area `detail` action and the `/areas/detail/:slug` route (`apps/strapi/src/api/area/routes/area-detail.ts`; delete the file if no route is left). Keep the core `area.ts` REST routes (the import and the place picker use them). Update `tests/location-controllers.test.ts` if it covers the action.
- `grep -rn "AreaDetailPage\|fetchArea\|areas/detail\|area-map" apps docs/agents CLAUDE.md CONTEXT.md` → nothing left (dated specs/plans under docs/superpowers are history).
- Verify: UI and Strapi tests and typecheck.

### Task 16: One whole-country Region where GeoNames has none

15 countries have no GeoNames subdivisions (AW, BL, CW, EH, FK, GI, MF, NF, NU, PN, SG, SX, TC, VA, VG), so they have no Region and a library there can't be published.

- In the import's planning: when a country's source has zero Regions and the country has zero existing Regions, plan one Region with the country's name, `sourceId` `country:<iso2>`, `key` `"*"`, no `geonamesId`, attribution `"Libraries Global: whole-country region (GeoNames lists no subdivisions)"`. No Areas. Put the pure rule in `run-rules.ts` (e.g. `wholeCountryRegion(country): SourcePlace | null` given the source and existing counts) with tests: created only when both are zero; never when the country has any Region; a re-run matches the existing whole-country Region by name (no duplicate).
- Report `wholeCountryRegion: true` on that country.
- README: document it.
- The controller runs `--dry-run --country=AW,BL,CW,EH,FK,GI,MF,NF,NU,PN,SG,SX,TC,VA,VG`, then the live run.

### Task 17: Fix the matchable unmatched Regions (data)

The world run left 649 Areas without a parent (`noRegion`) and 4 ambiguous pairs (Kyiv, Minsk, North/South Aegean vs "Aegean", Razgrad/Ruse) — see `.runs/2026-10-04T18-06-33.585Z.json`.

- For every country with `regions.unmatchedExisting` and `areas.noRegion`, classify each unmatched existing Region:
  - **Same place, different spelling** (typo such as "Castillay León", local or genitive name such as "Alytaus", mis-encoding such as "Ãstfold"): add a profile `aliases` entry (existing name → the GeoNames admin-code name).
  - **Ambiguous** (one existing Region two sources hit, e.g. city vs oblast "Kyiv"): decide which GeoNames place it is from its libraries' locations or its entityRef, and write that `geonamesId` onto the existing Region (REST `PUT ?status=published` only if it has no unpublished changes; otherwise list it). Id-first matching then resolves it on the next run.
  - **Different entity or level** (Norway's pre-2020 counties, Finland's old provinces, Slovenia's statistical regions, Latvia's planning regions, Serbia's districts, Greece's old regions…): don't alias; list them in the report for the owner.
- Add tests in `gazetteer-data.test.ts` that every alias target exists in the cached GeoNames admin-code names for that country (skip if the cache is absent).
- The controller dry-runs the touched countries, reviews, then runs them live.

### Task 18: Prerender only Regions with libraries

`generateStaticParams` on the Region page prerenders every Region (~3,500, ~2,900 new and empty). Owner decision: prerender only Regions with at least one published library; the rest render on demand (`dynamicParams` is already true).

- Strapi `GET /regions/slugs`: add `withLibraries=1` (only Regions with ≥1 published library in that locale) and keyset paging like `/libraries/slugs` (`after`, `limit` ≤ 1000, `meta.next`), with a fixed cap per call. Tests in the location-controllers suite.
- UI `fetchAllRegions` (server.ts) pages through `withLibraries=1`; the Region page's `generateStaticParams` uses it. Check the sitemap code (`lib/sitemap/`) doesn't rely on `/regions/slugs` returning every Region; if it does, keep its behaviour (it already filters by `MIN_INDEXABLE_LIBRARIES`).
- Verify: Strapi and UI tests and typecheck.
