# Stress-Test Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the 2026-10-04 New York import (1,083 IMLS libraries, 1,190 in total) exposed, except the Atlas and location-map pins, which the vector tiles plan (`2026-09-30-atlas-vector-tiles.md`) replaces.

**Architecture:** Find libraries stops downloading 1,000 hits and filtering in the browser: the library index gains the derived fields the page filters, counts and sorts on, and the page asks Meilisearch for one page plus exact facet counts. The homepage reads its coverage from one grouped SQL query and its globe from a Meilisearch grid-cell facet. The ingest client sends the bridge secret so `?status=draft` survives C1, a document middleware refuses to publish a library into an unpublished place, and the region page renders 24 cards instead of 100. The Meilisearch seed imports `config/plugins.ts` so the index shape has one source.

**Tech Stack:** Strapi 5.55 (Document Service, document middlewares), strapi-plugin-meilisearch 0.16.5, Meilisearch 1.42, meilisearch-js 0.57, Next.js 16 App Router, Vitest.

## Global Constraints

- Scale target: every feature must work at ~2.9M libraries (`docs/adr/0004-design-for-three-million-libraries.md`): never load every library; count in the database or Meilisearch; cap every read.
- Strapi 5: use `strapi.documents()` for reads and writes, never `strapi.db.query()` for finding or updating records.
- Don't commit. The user commits; other agents have uncommitted work in this tree (`apps/strapi/src/api/continent/controllers/continent.ts` has a one-line change of theirs).
- No worktrees; work in the main tree.
- Node 22 for Strapi (`$HOME/.nvm/versions/node/v22.22.0/bin`).
- Strapi tests: `cd apps/strapi && npx vitest run <files>`. UI tests: `cd apps/ui && npx vitest run <files>` (only `src/**/*.test.ts` are collected; component tests use `// @vitest-environment happy-dom` and `createElement`, as in `src/app/[locale]/contribute/_components/__tests__/ContributeNavBar.test.ts`).
- Editing anything under `apps/strapi/src`, `config` or `tests` restarts the running `strapi develop`; `scripts/**` is ignored.
- Copy rules: plain sentences, sentence case, "Find libraries", "Knowledge", "Journal".

---

### Task 1: The ingest client writes drafts

C1 (`src/middlewares/strip-draft-status.ts`) removes `?status` from every `/api/*` request without `X-Service-Secret`, so `StrapiClient`'s `?status=draft` writes published everything (the NY import, every LibraryOn run).

**Files:**

- Modify: `apps/strapi/scripts/strapi-client.ts:13-21,197-203`
- Modify: `apps/strapi/scripts/ingests/usa/imls-pls/README.md` (run commands)
- Test: `apps/strapi/tests/ingests/strapi-client.test.ts`

**Interfaces:**

- Produces: scripts using `StrapiClient` need `STRAPI_BRIDGE_SECRET` in the environment (same value as `apps/strapi/.env`).

- [ ] **Step 1: Write the failing test**

```ts
// apps/strapi/tests/ingests/strapi-client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("StrapiClient", () => {
  it("sends the bridge secret, so ?status=draft survives C1", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "token")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge")
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { documentId: "d1" } }), {
          status: 201,
        })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { StrapiClient } = await import("../../scripts/strapi-client")

    await new StrapiClient().createLibrary({ name: "X" } as never)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toContain("/libraries?status=draft")
    expect((init.headers as Record<string, string>)["X-Service-Secret"]).toBe(
      "bridge"
    )
  })

  it("refuses to run without the bridge secret", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "token")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const exit = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`exit ${code}`)
    }) as never)

    await expect(import("../../scripts/strapi-client")).rejects.toThrow(
      "exit 1"
    )
    expect(exit).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd apps/strapi && npx vitest run tests/ingests/strapi-client.test.ts`
Expected: FAIL: the header is `undefined`, and the second test resolves instead of exiting.

- [ ] **Step 3: Send the secret and require it**

In `scripts/strapi-client.ts`, after the `STRAPI_API_TOKEN` check:

```ts
// C1 (src/middlewares/strip-draft-status.ts) drops `?status` from every
// /api request without the bridge secret, so without it a "draft" write
// publishes straight away.
const STRAPI_BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""

if (!STRAPI_BRIDGE_SECRET) {
  console.error(
    "STRAPI_BRIDGE_SECRET is not set. Without it Strapi ignores ?status=draft and every write publishes. Export it from apps/strapi/.env before running scripts."
  )
  process.exit(1)
}
```

and in the constructor's headers add `"X-Service-Secret": STRAPI_BRIDGE_SECRET,`. Update the file header's `Env:` line to `STRAPI_URL, STRAPI_API_TOKEN, STRAPI_BRIDGE_SECRET`.

- [ ] **Step 4: Run the test**

Run: `cd apps/strapi && npx vitest run tests/ingests`
Expected: PASS.

- [ ] **Step 5: Prove the header gets drafts through C1**

North Ayrshire is a draft-only region (until Task 3 publishes it):

```bash
cd apps/strapi
TOKEN=$(grep '^STRAPI_API_TOKEN=' .env | cut -d= -f2-); SECRET=$(grep '^STRAPI_BRIDGE_SECRET=' .env | cut -d= -f2-)
U='http://127.0.0.1:1337/api/regions?filters[slug][$eq]=north-ayrshire&status=draft&fields[0]=slug'
curl -sg -H "Authorization: Bearer $TOKEN" "$U" | head -c 120; echo
curl -sg -H "Authorization: Bearer $TOKEN" -H "X-Service-Secret: $SECRET" "$U" | head -c 120
```

Expected: the first returns `"data":[]`, the second returns the draft.

- [ ] **Step 6: Update the run commands**

In `scripts/ingests/usa/imls-pls/README.md` change the live example to

```bash
STRAPI_API_TOKEN=… STRAPI_BRIDGE_SECRET=… npx tsx scripts/ingests/usa/imls-pls/ingest.ts --state=NY --limit=25
```

and in "Running it" add: "Both come from `apps/strapi/.env`. Without the bridge secret Strapi ignores `?status=draft` and publishes, so the client refuses to start."

---

### Task 2: Client components render the client media URL

`formatStrapiMediaUrl` answers `${STRAPI_URL}/uploads/…` on the server and `/api/asset/uploads/…` in the browser, so a client component renders a different `<img src>` on each side (the hydration warning on Find libraries) and ships Strapi's origin in the HTML. `formatStrapiMediaUrlForClient` gives the same answer on both.

**Files:**

- Modify: `apps/ui/src/components/index-page/FindCards.tsx`, `apps/ui/src/components/contribute/article-editor/ArticleEditorShell.tsx`, `apps/ui/src/components/map/InteractiveMap.tsx`, `apps/ui/src/components/atlas/AtlasLibraryPanel.tsx`
- Test: `apps/ui/src/lib/__tests__/client-media-url.test.ts`

- [ ] **Step 1: Write the failing guard test**

```ts
// apps/ui/src/lib/__tests__/client-media-url.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * formatStrapiMediaUrl answers with the Strapi origin on the server and
 * /api/asset/… in the browser, so a client component that renders it
 * hydrates with a different <img src> and leaks Strapi's address into the
 * HTML. Client modules use formatStrapiMediaUrlForClient.
 */
const SRC = path.resolve(__dirname, "../..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory())
      return name === "__tests__" || name === "node_modules"
        ? []
        : sourceFiles(full)

    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

describe("client modules use the client media URL", () => {
  it("never call formatStrapiMediaUrl from a 'use client' module", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => {
        const src = readFileSync(file, "utf8")

        return (
          /^\s*["']use client["']/.test(src) &&
          /\bformatStrapiMediaUrl\(/.test(src)
        )
      })
      .map((file) => path.relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/client-media-url.test.ts`
Expected: FAIL listing the four files above.

- [ ] **Step 3: Switch the four files**

In each file replace the import `formatStrapiMediaUrl` with `formatStrapiMediaUrlForClient` and every call `formatStrapiMediaUrl(` with `formatStrapiMediaUrlForClient(` (same signature: `(url: string | null | undefined) => string | undefined`).

- [ ] **Step 4: Run the test, types and lint**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/client-media-url.test.ts && npx tsc --noEmit -p . 2>&1 | grep -E "FindCards|ArticleEditorShell|InteractiveMap|AtlasLibraryPanel"; npx eslint <the four files>`
Expected: PASS, no type errors in those files, no lint errors.

---

### Task 3: Libraries can't be published into unpublished places

Strapi 5 leaves a relation to a document with no published version out of the published entry. North Ayrshire, Lisburn and Castlereagh and County Down were only ever drafts, so 11 published UK libraries (Fairlie, Irvine, Moira…) have no region: no page path, no region listing. Fix the data, then refuse such publishes with a message that names the place.

**Files:**

- Create: `apps/strapi/src/documentMiddlewares/library-publish-places.ts`
- Modify: `apps/strapi/src/index.ts` (register next to `registerChangeRecordsMiddleware`)
- Test: `apps/strapi/tests/library-publish-places.test.ts`

**Interfaces:**

- Produces: `unpublishedPlaces(strapi, params): Promise<string[]>`, `registerLibraryPublishPlacesMiddleware({ strapi }): void`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/strapi/tests/library-publish-places.test.ts
import { describe, expect, it, vi } from "vitest"

import {
  registerLibraryPublishPlacesMiddleware,
  unpublishedPlaces,
} from "../src/documentMiddlewares/library-publish-places"

type Versions = { draft?: Record<string, unknown>; published?: unknown }

/** uid:documentId → its draft and published versions. */
function fakeStrapi(docs: Record<string, Versions>) {
  const middlewares: ((ctx: unknown, next: () => unknown) => unknown)[] = []
  const documents = Object.assign(
    (uid: string) => ({
      findOne: vi.fn(
        async ({
          documentId,
          status,
        }: {
          documentId: string
          status: "draft" | "published"
        }) => docs[`${uid}:${documentId}`]?.[status] ?? null
      ),
    }),
    {
      use: (fn: (ctx: unknown, next: () => unknown) => unknown) =>
        middlewares.push(fn),
    }
  )
  const strapi = {
    documents,
    contentType: () => ({ pluginOptions: { i18n: { localized: true } } }),
  }

  return { strapi, middleware: () => middlewares[0]! }
}

const LIB = "api::library.library"
const draftLibrary = {
  documentId: "lib",
  continent: { documentId: "eu", name: "Europe" },
  country: { documentId: "sc", name: "Scotland" },
  region: { documentId: "na", name: "North Ayrshire" },
  area: null,
}

describe("unpublishedPlaces", () => {
  it("names each linked place with no published version", async () => {
    const { strapi } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      "api::continent.continent:eu": { published: { documentId: "eu" } },
      "api::country.country:sc": { published: { documentId: "sc" } },
      "api::region.region:na": { draft: { documentId: "na" } },
    })

    expect(
      await unpublishedPlaces(strapi, { documentId: "lib", locale: "en" })
    ).toEqual(["region “North Ayrshire”"])
  })

  it("is empty when every linked place is published", async () => {
    const { strapi } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      "api::continent.continent:eu": { published: { documentId: "eu" } },
      "api::country.country:sc": { published: { documentId: "sc" } },
      "api::region.region:na": { published: { documentId: "na" } },
    })

    expect(await unpublishedPlaces(strapi, { documentId: "lib" })).toEqual([])
  })
})

describe("library publish middleware", () => {
  it("refuses to publish a library into a draft region", async () => {
    const { strapi, middleware } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      "api::continent.continent:eu": { published: { documentId: "eu" } },
      "api::country.country:sc": { published: { documentId: "sc" } },
    })
    registerLibraryPublishPlacesMiddleware({ strapi })
    const next = vi.fn()

    await expect(
      middleware()(
        { uid: LIB, action: "publish", params: { documentId: "lib" } },
        next
      )
    ).rejects.toThrow(/Publish the region “North Ayrshire” first/)
    expect(next).not.toHaveBeenCalled()
  })

  it("leaves other actions and content types alone", async () => {
    const { strapi, middleware } = fakeStrapi({})
    registerLibraryPublishPlacesMiddleware({ strapi })
    const next = vi.fn(async () => "ok")

    await middleware()(
      { uid: LIB, action: "update", params: { documentId: "lib" } },
      next
    )
    await middleware()(
      { uid: "api::region.region", action: "publish", params: {} },
      next
    )
    expect(next).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/strapi && npx vitest run tests/library-publish-places.test.ts`
Expected: FAIL: module not found.

- [ ] **Step 3: Write the middleware**

```ts
// apps/strapi/src/documentMiddlewares/library-publish-places.ts
import { errors } from "@strapi/utils"

const LIBRARY = "api::library.library"

/** A library's location relations: field, target type, label. */
const PLACE_RELATIONS = [
  ["continent", "api::continent.continent", "continent"],
  ["country", "api::country.country", "country"],
  ["region", "api::region.region", "region"],
  ["area", "api::area.area", "area"],
] as const

type Place = { documentId?: string; name?: string } | null | undefined

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StrapiLike = { documents: any; contentType: (uid: string) => any }

const isLocalized = (strapi: StrapiLike, uid: string) =>
  strapi.contentType(uid)?.pluginOptions?.i18n?.localized === true

/**
 * The places a library's draft links to that have no published version.
 * Strapi 5 leaves such a relation out of the published entry, so publishing
 * the library would silently drop its region (no page path, no listing).
 */
export async function unpublishedPlaces(
  strapi: StrapiLike,
  params: { documentId?: unknown; locale?: unknown }
): Promise<string[]> {
  if (typeof params.documentId !== "string") return []
  const locale =
    typeof params.locale === "string" && params.locale !== "*"
      ? params.locale
      : undefined

  const draft = (await strapi.documents(LIBRARY).findOne({
    documentId: params.documentId,
    ...(locale ? { locale } : {}),
    status: "draft",
    fields: ["documentId"],
    populate: Object.fromEntries(
      PLACE_RELATIONS.map(([field]) => [
        field,
        { fields: ["documentId", "name"] },
      ])
    ),
  })) as Record<string, Place> | null
  if (!draft) return []

  const missing: string[] = []
  for (const [field, uid, label] of PLACE_RELATIONS) {
    const place = draft[field]
    if (!place?.documentId) continue
    const published = await strapi.documents(uid).findOne({
      documentId: place.documentId,
      ...(locale && isLocalized(strapi, uid) ? { locale } : {}),
      status: "published",
      fields: ["documentId"],
    })
    if (!published) missing.push(`${label} “${place.name ?? place.documentId}”`)
  }

  return missing
}

/** Refuses to publish a library whose continent, country, region or area is unpublished. */
export function registerLibraryPublishPlacesMiddleware({
  strapi,
}: {
  strapi: StrapiLike
}): void {
  strapi.documents.use(
    async (
      context: {
        uid: string
        action: string
        params?: Record<string, unknown>
      },
      next: () => Promise<unknown>
    ) => {
      if (context.uid !== LIBRARY || context.action !== "publish") return next()

      const missing = await unpublishedPlaces(strapi, context.params ?? {})
      if (missing.length > 0)
        throw new errors.ValidationError(
          `Publish the ${missing.join(" and the ")} first: a published library can only link to published places.`
        )

      return next()
    }
  )
}
```

In `src/index.ts` import it and call `registerLibraryPublishPlacesMiddleware({ strapi })` on the line after `registerChangeRecordsMiddleware({ strapi })`, with the comment `// Refuse to publish a library into a draft place (Strapi drops the link).`

- [ ] **Step 4: Run the tests**

Run: `cd apps/strapi && npx vitest run tests/library-publish-places.test.ts`
Expected: PASS.

- [ ] **Step 5: Prove the guard in the running Strapi**

```bash
cd apps/strapi && TOKEN=$(grep '^STRAPI_API_TOKEN=' .env | cut -d= -f2-)
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Fairlie Library"}}' http://127.0.0.1:1337/api/libraries/gnyxc2xe5qozyg3yyn2b8wny | head -c 300
```

Expected: a 400 whose message is "Publish the region “North Ayrshire” first: …" (a REST update publishes, so the guard runs).

- [ ] **Step 6: Fix the data through the libraries-local MCP**

Publish, in order: region `v8acsnaw0304pus0kr2bvuwu` (North Ayrshire), region `grfobly62ajgqzc80glg273t` (Lisburn and Castlereagh), area `z5y0frxaocb6w1sdo8ol2fz9` (County Down), then republish each library: `gnyxc2xe5qozyg3yyn2b8wny`, `j0nwpvlgkzluvno59d3mr7b8`, `o8l8x0iwcwthmi7zeq5ta62v`, `tk2grvkdz2dasxledn0mibwt`, `uxx23ga62n2jvcki5fy5888f`, `tfzn7h1g2qiuyw0dtyo8g1ay`, `avdwz8w7dbnve24zl1euwixc`, `dkrj8jah4cvo98lzitccq1fl`, `ib57v8tjs917x7qhueiypm44`, `d1z4klbe9oc7d3lddrw6o813`, `bgtdbpx9hnyrawc38a4tfyyl`.

- [ ] **Step 7: Verify no published library lacks a region**

```bash
psql … -c "select count(*) from libraries l left join libraries_region_lnk r on r.library_id=l.id where l.published_at is not null and r.library_id is null;"
curl -s http://127.0.0.1:1337/api/libraries/atlas | python3 -c "import json,sys; print(sum(1 for f in json.load(sys.stdin)['features'] if not f['properties']['path']))"
```

Expected: `0` and `0`.

---

### Task 4: One source for the search index, and the fields Find libraries needs

The seed script repeats `config/plugins.ts` in plain JS with a parity test. Task 5 adds ~100 lines of derived fields, so make the seed TypeScript and import the config instead, then add the fields.

**Files:**

- Create: `apps/strapi/scripts/seed-meilisearch.ts` (replaces `seed-meilisearch.mjs`, which is deleted)
- Create: `apps/strapi/src/utils/library-search-fields.ts`
- Modify: `apps/strapi/config/plugins.ts` (library index), `apps/strapi/package.json` (`seed:meilisearch` script)
- Modify: `apps/strapi/tests/meilisearch-config.test.ts`
- Test: `apps/strapi/tests/library-search-fields.test.ts`

**Interfaces:**

- Produces (index `library`, every document):
  - `completeness: number` (0–100, sortable; the stored field)
  - `has_hours: boolean` (opening-times days exist; "N records have checked hours")
  - `has_iiif: boolean` (digital collections)
  - `needs: ("hours"|"photo"|"facilities")[]` (the Contribute gaps)
  - `open_tz: string` (IANA zone, `"UTC"` when unset)
  - `open_<ddd>_<n>_from|to: number` (minutes after local midnight, `ddd` = `mon`…`sun`, `n` = 0–5; present only for real timeframes)
  - `geo_cell: string` (`"<round(lat)>,<round(lng)>"`, only with coordinates)
- Settings: all of the above filterable (and so displayed); `completeness` sortable; `faceting: { maxValuesPerFacet: 5000, sortFacetValuesBy: { "*": "alpha", geo_cell: "count" } }`.
- `OPEN_FIELD_NAMES: string[]`, `openField(day, n, edge)` exported from `library-search-fields.ts` for the UI to mirror (the UI keeps its own copy of the naming rule: `open_${day.slice(0,3)}_${n}_${edge}`).

- [ ] **Step 1: Write the failing field tests**

```ts
// apps/strapi/tests/library-search-fields.test.ts
import { describe, expect, it } from "vitest"

import {
  OPEN_FIELD_NAMES,
  geoCell,
  librarySearchFields,
  openFields,
} from "../src/utils/library-search-fields"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [
        { startTime: "09:30", endTime: "13:00" },
        { startTime: "14:00", endTime: "24:00" },
      ],
    },
    {
      day: "tuesday",
      enabled: false,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
    {
      day: "friday",
      enabled: true,
      timeframes: [{ startTime: "18:00", endTime: "09:00" }],
    },
  ],
}

describe("openFields", () => {
  it("stores each enabled timeframe as minutes after local midnight", () => {
    expect(openFields(hours)).toEqual({
      open_mon_0_from: 570,
      open_mon_0_to: 780,
      open_mon_1_from: 840,
      open_mon_1_to: 1440,
    })
  })

  it("names 84 fields: seven days, six timeframes, from and to", () => {
    expect(OPEN_FIELD_NAMES).toHaveLength(84)
    expect(OPEN_FIELD_NAMES).toContain("open_sun_5_to")
  })
})

describe("librarySearchFields", () => {
  it("derives the Find libraries filters", () => {
    expect(
      librarySearchFields(
        {
          completeness: 63,
          openingTimes: hours,
          timezone: "Europe/London",
          iiifEndpoint: "https://iiif.example",
          heroImage: null,
          accessibility: [{ name: "Step-free access" }],
          services: [],
        },
        51.53,
        -0.127
      )
    ).toEqual({
      completeness: 63,
      has_hours: true,
      has_iiif: true,
      needs: ["photo"],
      open_tz: "Europe/London",
      open_mon_0_from: 570,
      open_mon_0_to: 780,
      open_mon_1_from: 840,
      open_mon_1_to: 1440,
      geo_cell: "52,0",
    })
  })

  it("marks a bare record with every gap", () => {
    const fields = librarySearchFields({}, null, null)
    expect(fields).toEqual({
      completeness: 0,
      has_hours: false,
      has_iiif: false,
      needs: ["hours", "photo", "facilities"],
      open_tz: "UTC",
    })
    expect(geoCell(null, 1)).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/strapi && npx vitest run tests/library-search-fields.test.ts`
Expected: FAIL: module not found.

- [ ] **Step 3: Write the field module**

```ts
// apps/strapi/src/utils/library-search-fields.ts

/**
 * Derived fields the library search index carries so Find libraries can
 * filter, count and sort in Meilisearch instead of loading every record:
 * "open now", the record's gaps, digital collections, checked hours, the
 * stored completeness, and a 1° grid cell for the homepage globe.
 */

export const OPEN_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

/** The opening-times normaliser allows six timeframes a day. */
export const OPEN_FRAMES_PER_DAY = 6

/** `open_mon_0_from`: minutes after local midnight on that weekday. */
export const openField = (day: string, frame: number, edge: "from" | "to") =>
  `open_${day.slice(0, 3)}_${frame}_${edge}`

export const OPEN_FIELD_NAMES = OPEN_DAYS.flatMap((day) =>
  Array.from({ length: OPEN_FRAMES_PER_DAY }, (_, n) => [
    openField(day, n, "from"),
    openField(day, n, "to"),
  ]).flat()
)

type Day = { day?: unknown; enabled?: unknown; timeframes?: unknown }
type Timeframe = { startTime?: unknown; endTime?: unknown }

function days(openingTimes: unknown): Day[] {
  const list = (openingTimes as { days?: unknown } | null | undefined)?.days

  return Array.isArray(list) ? (list as Day[]) : []
}

function minutes(hm: unknown): number | null {
  if (typeof hm !== "string") return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const value = Number(m[1]) * 60 + Number(m[2])

  return value <= 1440 ? value : null
}

const optionCount = (value: unknown) =>
  Array.isArray(value) ? value.length : 0

/**
 * Each enabled day's timeframes as minute ranges. Mirrors the Find page's
 * `openStatus`: open when `from <= now < to` on today's weekday; a timeframe
 * that ends before it starts never matches, so it's left out.
 */
export function openFields(openingTimes: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const day of days(openingTimes)) {
    const key = typeof day.day === "string" ? day.day.toLowerCase() : ""
    if (
      !day.enabled ||
      !(OPEN_DAYS as readonly string[]).includes(key) ||
      !Array.isArray(day.timeframes)
    )
      continue
    let n = 0
    for (const tf of day.timeframes as Timeframe[]) {
      const from = minutes(tf?.startTime)
      const to = minutes(tf?.endTime)
      if (from == null || to == null || to <= from) continue
      if (n >= OPEN_FRAMES_PER_DAY) break
      out[openField(key, n, "from")] = from
      out[openField(key, n, "to")] = to
      n++
    }
  }

  return out
}

/** The gaps a contributor can fill, as the Find page's "Needs" filter names them. */
export function libraryNeeds(entry: Record<string, unknown>): string[] {
  const needs: string[] = []
  const hasHours = days(entry.openingTimes).some(
    (d) => d.enabled && optionCount(d.timeframes) > 0
  )
  if (!hasHours) needs.push("hours")
  if (!(entry.heroImage as { url?: unknown } | null | undefined)?.url)
    needs.push("photo")
  if (!optionCount(entry.accessibility) && !optionCount(entry.services))
    needs.push("facilities")

  return needs
}

/** A 1° grid cell, `"52,0"`, for counting libraries per place on the globe. */
export function geoCell(lat: number | null, lng: number | null): string | null {
  return lat == null || lng == null
    ? null
    : `${Math.round(lat) + 0},${Math.round(lng) + 0}`
}

export function librarySearchFields(
  entry: Record<string, unknown>,
  lat: number | null,
  lng: number | null
): Record<string, unknown> {
  const cell = geoCell(lat, lng)

  return {
    completeness:
      typeof entry.completeness === "number" ? entry.completeness : 0,
    has_hours: days(entry.openingTimes).length > 0,
    has_iiif:
      typeof entry.iiifEndpoint === "string" &&
      entry.iiifEndpoint.trim() !== "",
    needs: libraryNeeds(entry),
    open_tz:
      typeof entry.timezone === "string" && entry.timezone !== ""
        ? entry.timezone
        : "UTC",
    ...openFields(entry.openingTimes),
    ...(cell ? { geo_cell: cell } : {}),
  }
}
```

(`+ 0` turns `-0` into `0`, so `Math.round(-0.127)` gives the cell `"52,0"`, not `"52,-0"`.)

- [ ] **Step 4: Run the field tests**

Run: `cd apps/strapi && npx vitest run tests/library-search-fields.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the fields into the library index**

In `config/plugins.ts`:

- `import { OPEN_FIELD_NAMES, librarySearchFields } from "../src/utils/library-search-fields"`.
- Add `"completeness"` to `LIBRARY_FIELDS` (the libraries list shape already returns it).
- Define `const LIBRARY_SEARCH_FIELDS = ["has_hours", "has_iiif", "needs", "open_tz", "geo_cell", ...OPEN_FIELD_NAMES]` and append it to `LIBRARY_DISPLAYED`.
- In `library.settings`: append `...LIBRARY_SEARCH_FIELDS` to `filterableAttributes`, set `sortableAttributes: ["name", "featured", "completeness", "_geo"]`, add `faceting: { maxValuesPerFacet: 5000, sortFacetValuesBy: { "*": "alpha", geo_cell: "count" } }`.
- In `library.transformEntry`, after `amenity_names`, add `...librarySearchFields(entry, lat, lng),`.

- [ ] **Step 6: Make the seed read the config**

Create `scripts/seed-meilisearch.ts` (and delete `scripts/seed-meilisearch.mjs`):

```ts
// apps/strapi/scripts/seed-meilisearch.ts
/**
 * Seed the Meilisearch library, blog-article and wiki-article indexes from
 * the Strapi REST API, building exactly the documents the plugin builds: the
 * settings, the entry query and the transform all come from
 * config/plugins.ts. Use it on a fresh Meilisearch, or after changing an
 * index's shape. (The event index is filled by the plugin's own hooks.)
 *
 * Usage: pnpm --filter @repo/strapi seed:meilisearch
 * Env:   reads apps/strapi/.env for STRAPI_API_TOKEN, MEILISEARCH_HOST and
 *        MEILISEARCH_MASTER_KEY
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import pluginsConfig from "../config/plugins"

type EntriesQuery = {
  fields: string[]
  populate: Record<string, { fields: string[] }>
  locale?: string
}
type IndexConfig = {
  settings: Record<string, unknown>
  entriesQuery: EntriesQuery
  transformEntry: (args: {
    entry: Record<string, unknown>
  }) => Record<string, unknown>
}

/** Index → REST collection. */
export const SEEDED = {
  library: "libraries",
  "blog-article": "blog-articles",
  "wiki-article": "wiki-articles",
} as const

function configEnv(key: string, fallback?: unknown) {
  return process.env[key] ?? fallback
}
configEnv.array = (_key: string, fallback: unknown[] = []) => fallback
configEnv.bool = (_key: string, fallback = false) => fallback
configEnv.int = (_key: string, fallback = 0) => fallback
configEnv.json = (_key: string, fallback: unknown = {}) => fallback

/** The plugin's per-index config for every seeded index. */
export function seededIndexes() {
  const meili = (
    pluginsConfig({ env: configEnv }) as {
      meilisearch: { config: Record<string, IndexConfig> }
    }
  ).meilisearch.config

  return Object.entries(SEEDED).map(([name, apiPath]) => ({
    name,
    apiPath,
    ...meili[name]!,
  }))
}

/**
 * The plugin's document id, so the plugin's own hooks upsert the seeded
 * documents instead of adding duplicates:
 * `[collection]-[documentId]` plus `-[locale]` when the document has one.
 */
export function meilisearchId(
  collection: string,
  doc: Record<string, unknown>
): string {
  return typeof doc.locale === "string" && doc.locale !== ""
    ? `${collection}-${doc.documentId}-${doc.locale}`
    : `${collection}-${doc.documentId}`
}

/** The REST query for one page of an index's entries, from its `entriesQuery`. */
export function entriesQueryParams(
  entriesQuery: EntriesQuery,
  page: number,
  pageSize = 100
): URLSearchParams {
  const params = new URLSearchParams({
    "pagination[page]": String(page),
    "pagination[pageSize]": String(pageSize),
    status: "published",
  })
  if (entriesQuery.locale) params.set("locale", entriesQuery.locale)
  entriesQuery.fields.forEach((field, i) => params.set(`fields[${i}]`, field))
  for (const [relation, { fields }] of Object.entries(entriesQuery.populate))
    fields.forEach((field, i) =>
      params.set(`populate[${relation}][fields][${i}]`, field)
    )

  return params
}
```

Then move `main()` over from the `.mjs` unchanged except: iterate `seededIndexes()`, call `index.transformEntry({ entry })` per entry, keep the "came back without a locale" guard, and start it only when run directly: `if (process.argv[1]?.endsWith("seed-meilisearch.ts")) main().catch((e) => { console.error(e); process.exit(1) })`. Add `"seed:meilisearch": "tsx scripts/seed-meilisearch.ts"` to `apps/strapi/package.json` scripts.

- [ ] **Step 7: Update the config test**

In `tests/meilisearch-config.test.ts`:

- Replace the whole `describe("scripts/seed-meilisearch.mjs mirrors the plugin config", …)` block with:

```ts
describe("scripts/seed-meilisearch.ts", () => {
  let seed: typeof import("../scripts/seed-meilisearch")

  beforeAll(async () => {
    seed = await import("../scripts/seed-meilisearch")
  })

  it("seeds from the plugin config itself", () => {
    for (const index of seed.seededIndexes()) {
      expect(index.settings).toEqual(meili[index.name].settings)
      expect(index.entriesQuery).toEqual(meili[index.name].entriesQuery)
    }
  })

  it("builds the plugin's document id, with the locale only when present", () => {
    expect(
      seed.meilisearchId("library", { documentId: "lib-1", locale: "en" })
    ).toBe("library-lib-1-en")
    expect(
      seed.meilisearchId("event", { documentId: "ev-1", locale: null })
    ).toBe("event-ev-1")
  })

  it("library: the core list route returns every field the seed reads", () => {
    // keep the body of the existing test of this name, reading
    // seed.seededIndexes().find((i) => i.name === "library")!.entriesQuery
  })

  it("asks REST for exactly the configured fields and populate", () => {
    // keep the body of the existing test, with
    // seed.entriesQueryParams(<library entriesQuery>, 2)
  })
})
```

- In "transformEntry builds the document from an allowlist", the opening fields are sparse, so compare without them and require the rest to be displayed:

```ts
const isOpen = (key: string) => /^open_[a-z]{3}_\d_(from|to)$/.test(key)
expect(
  Object.keys(doc)
    .filter((k) => !isOpen(k))
    .sort()
).toEqual(displayed.filter((k) => !isOpen(k)).sort())
for (const key of Object.keys(doc).filter(isOpen))
  expect(displayed).toContain(key)
```

- Change the library fixture's `openingTimes` to the real shape, `{ days: [{ day: "monday", enabled: true, timeframes: [{ startTime: "09:30", endTime: "20:00" }] }] }`, and add `completeness: 63` to it.

- [ ] **Step 8: Run the Strapi suites**

Run: `cd apps/strapi && npx vitest run tests/meilisearch-config.test.ts tests/library-search-fields.test.ts tests/populate-shapes-schema.test.ts`
Expected: PASS.

- [ ] **Step 9: Re-seed and check the new fields**

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"; pnpm --filter @repo/strapi seed:meilisearch
```

Expected: `library index: 1190 documents ✓`. Then a search for `"open_tz = \"America/New_York\" AND (open_mon_0_from <= 600 AND open_mon_0_to > 600)"` with `facets: ["needs","has_hours","has_iiif","geo_cell"]` returns hits and non-empty facet counts.

---

### Task 5: Find libraries asks Meilisearch for one page at a time

Today the page loads up to 1,000 hits (the server ships them in every response, 2.1 MB, even for `?q=Brooklyn`), filters them in the browser, and says "Search 1,000 published records" because hits stop at Meilisearch's `maxTotalHits`. Facet counts are exact past that cap (`locale: en` = 1,190), so totals come from a facet.

**Files:**

- Create: `apps/ui/src/lib/find-search.ts`
- Modify: `apps/ui/src/lib/meilisearch.ts` (remove `searchLibrariesV2`, `SearchLibrariesV2Options`, `V2_RETRIEVE`, `V2_FACETS`, `LibrarySearchHitV2`; they move to `find-search.ts`)
- Modify: `apps/ui/src/components/index-page/find-helpers.ts` (add `findQueryOf`; `openStatus` uses `localDayMinute`; delete `completenessScore`, `hitNeeds`)
- Modify: `apps/ui/src/components/index-page/FindLibraryPage.tsx`, `FindCards.tsx`, `FindMapPanel.tsx`, `FindControls.tsx` (type imports), `LibrarySearchBox.tsx` (placeholder prop)
- Modify: `apps/ui/src/app/[locale]/libraries/page.tsx`
- Modify: `apps/ui/src/lib/__tests__/meilisearch.test.ts`, `apps/ui/src/lib/__tests__/search-locale-callers.test.ts`
- Test: `apps/ui/src/lib/__tests__/find-search.test.ts`

**Interfaces:**

- Consumes: Task 4's index fields.
- Produces (`lib/find-search.ts`):
  - `type FindSort = "complete" | "gaps" | "name" | "near"`
  - `interface FindQuery { query?; place?: { level: "continent"|"country"|"region"; slug }; libraryTypes?: string[]; accessibilityNames?: string[]; serviceNames?: string[]; digital?: boolean; openNow?: boolean; needs?: string[]; nearLat?: number; nearLng?: number; nearRadius?: number /* metres */; sort?: FindSort; page?: number /* 0-based */; hitsPerPage?: number; locale?: string; now?: Date }`
  - `interface FindResult { hits: LibrarySearchHitV2[]; total: number; pageCount: number; facets: { libraryType: Record<string, number>; accessibility: Record<string, number>; services: Record<string, number>; needs: Record<string, number>; hoursKnown: number; digital: number; openNow: number } }`
  - `FIND_MAX_REACHABLE = 1000`
  - `localDayMinute(timeZone: string, now: Date): { day: string; minute: number } | null`
  - `openNowFilter(zones: string[], now: Date): string`
  - `findFilter(q: FindQuery, zones: string[]): string`
  - `findSort(q: FindQuery): string[]`
  - `searchFind(q: FindQuery): Promise<FindResult>`
  - `libraryTotal(locale?: string): Promise<number>`
  - `findQueryOf(state: FindState, locale: string): FindQuery` (in `find-helpers.ts`)

- [ ] **Step 1: Write the failing tests**

```ts
// apps/ui/src/lib/__tests__/find-search.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const { multiSearch, search } = vi.hoisted(() => ({
  multiSearch: vi.fn(),
  search: vi.fn(),
}))

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { multiSearch, index: () => ({ search }) },
  searchLocale: (l?: string) => (l === "fr" ? "en" : (l ?? "en")),
  searchLocaleFilter: (l?: string) =>
    `locale = "${l === "fr" ? "en" : (l ?? "en")}"`,
}))

const {
  FIND_MAX_REACHABLE,
  findFilter,
  findSort,
  localDayMinute,
  openNowFilter,
  searchFind,
} = await import("../find-search")

// Sunday 4 October 2026, 00:30 UTC: 01:30 in London, 20:30 Saturday in New York.
const NOW = new Date("2026-10-04T00:30:00Z")

beforeEach(() => {
  multiSearch.mockReset()
  search.mockReset()
})

describe("localDayMinute", () => {
  it("reads the weekday and minute in the zone", () => {
    expect(localDayMinute("Europe/London", NOW)).toEqual({
      day: "sun",
      minute: 90,
    })
    expect(localDayMinute("America/New_York", NOW)).toEqual({
      day: "sat",
      minute: 1230,
    })
    expect(localDayMinute("Not/AZone", NOW)).toBeNull()
  })
})

describe("openNowFilter", () => {
  it("checks each zone's own weekday and minute", () => {
    const filter = openNowFilter(["Europe/London", "America/New_York"], NOW)
    expect(filter).toContain(
      '(open_tz IN ["Europe/London"] AND ((open_sun_0_from <= 90 AND open_sun_0_to > 90)'
    )
    expect(filter).toContain(
      '(open_tz IN ["America/New_York"] AND ((open_sat_0_from <= 1230 AND open_sat_0_to > 1230)'
    )
    expect(filter).toContain("open_sat_5_from <= 1230 AND open_sat_5_to > 1230")
  })

  it("groups zones that share a local time", () => {
    const filter = openNowFilter(["Europe/London", "Europe/Dublin"], NOW)
    expect(filter).toContain('open_tz IN ["Europe/London", "Europe/Dublin"]')
  })

  it("matches nothing without zones", () => {
    expect(openNowFilter([], NOW)).toBe('open_tz = "__none__"')
  })
})

describe("findFilter", () => {
  it("joins every clause with the locale", () => {
    const filter = findFilter(
      {
        place: { level: "region", slug: "new-york" },
        libraryTypes: ["Public"],
        digital: true,
        needs: ["photo", "hours"],
        locale: "en",
      },
      []
    )
    expect(filter).toBe(
      'region_slug = "new-york" AND libraryType IN ["Public"] AND has_iiif = true AND needs IN ["photo", "hours"] AND locale = "en"'
    )
  })
})

describe("findSort", () => {
  it("maps the page's sorts", () => {
    expect(findSort({ sort: "complete" })).toEqual([
      "completeness:desc",
      "name:asc",
    ])
    expect(findSort({ sort: "gaps" })).toEqual(["completeness:asc", "name:asc"])
    expect(findSort({ sort: "name" })).toEqual(["name:asc"])
    expect(findSort({ sort: "near", nearLat: 1, nearLng: 2 })).toEqual([
      "_geoPoint(1, 2):asc",
    ])
  })
})

describe("searchFind", () => {
  it("takes the exact total from the locale facet and caps the pages", async () => {
    search.mockResolvedValue({
      facetDistribution: { open_tz: { "America/New_York": 1 } },
    })
    multiSearch.mockResolvedValue({
      results: [
        {
          hits: [{ id: 1, name: "A" }],
          facetDistribution: {
            locale: { en: 1190 },
            libraryType: { Public: 1189 },
            needs: { photo: 1100 },
            has_hours: { true: 900, false: 290 },
            has_iiif: { false: 1190 },
          },
        },
        { facetDistribution: { locale: { en: 12 } } },
      ],
    })

    const result = await searchFind({ locale: "en", hitsPerPage: 24, now: NOW })

    expect(result.total).toBe(1190)
    expect(result.pageCount).toBe(Math.ceil(FIND_MAX_REACHABLE / 24))
    expect(result.facets).toMatchObject({
      libraryType: { Public: 1189 },
      needs: { photo: 1100 },
      hoursKnown: 900,
      digital: 0,
      openNow: 12,
    })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/find-search.test.ts`
Expected: FAIL: module not found.

- [ ] **Step 3: Write `lib/find-search.ts`**

```ts
// apps/ui/src/lib/find-search.ts
/**
 * Find libraries search: one page of hits plus exact counts, all answered by
 * Meilisearch, so the page never loads the whole index. Totals come from the
 * `locale` facet because `totalHits` stops at the index's maxTotalHits.
 */
import {
  type LibrarySearchHit,
  meiliClient,
  searchLocale,
  searchLocaleFilter,
} from "@/lib/meilisearch"

export interface LibrarySearchHitV2 extends LibrarySearchHit {
  openingTimes?: unknown
  timezone?: string | null
  iiifEndpoint?: string | null
  completeness?: number | null
}

export type FindSort = "complete" | "gaps" | "name" | "near"

export interface FindQuery {
  query?: string
  place?: { level: "continent" | "country" | "region"; slug: string }
  libraryTypes?: string[]
  accessibilityNames?: string[]
  serviceNames?: string[]
  digital?: boolean
  openNow?: boolean
  needs?: string[]
  nearLat?: number
  nearLng?: number
  /** metres; omit for any distance */
  nearRadius?: number
  sort?: FindSort
  /** 0-based */
  page?: number
  hitsPerPage?: number
  locale?: string
  now?: Date
}

export interface FindResult {
  hits: LibrarySearchHitV2[]
  /** Exact number of matching records. */
  total: number
  /** Pages Meilisearch will serve: maxTotalHits caps deep paging. */
  pageCount: number
  facets: {
    libraryType: Record<string, number>
    accessibility: Record<string, number>
    services: Record<string, number>
    needs: Record<string, number>
    hoursKnown: number
    digital: number
    openNow: number
  }
}

/** The library index's pagination.maxTotalHits. */
export const FIND_MAX_REACHABLE = 1000

const FRAMES_PER_DAY = 6

const RETRIEVE = [
  "id",
  "documentId",
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "libraryType",
  "operationalStatus",
  "city",
  "featured",
  "continent_slug",
  "continent_name",
  "country_slug",
  "country_name",
  "region_slug",
  "region_name",
  "foundedYear",
  "operatorType",
  "heroImage",
  "openingTimes",
  "timezone",
  "iiifEndpoint",
  "completeness",
  "accessibility_names",
  "service_names",
  "_geo",
]

const FACETS = [
  "libraryType",
  "accessibility_names",
  "service_names",
  "needs",
  "has_hours",
  "has_iiif",
  "locale",
]

const quoted = (values: readonly string[]) =>
  `[${values.map((v) => JSON.stringify(v)).join(", ")}]`

/** The weekday ("mon"…"sun") and minute after local midnight in a zone. */
export function localDayMinute(
  timeZone: string,
  now: Date
): { day: string; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value
    const day = get("weekday")?.toLowerCase().slice(0, 3)
    if (!day) return null

    return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) }
  } catch {
    return null
  }
}

/**
 * "Open now": each zone's libraries checked against that zone's own weekday
 * and minute. Zones sharing a local time share one clause.
 */
export function openNowFilter(zones: string[], now: Date): string {
  const groups = new Map<
    string,
    { day: string; minute: number; zones: string[] }
  >()
  for (const zone of zones) {
    const local = localDayMinute(zone, now)
    if (!local) continue
    const key = `${local.day}:${local.minute}`
    const group = groups.get(key) ?? { ...local, zones: [] }
    group.zones.push(zone)
    groups.set(key, group)
  }
  if (groups.size === 0) return 'open_tz = "__none__"'

  const clauses = [...groups.values()].map(({ day, minute, zones: z }) => {
    const frames = Array.from(
      { length: FRAMES_PER_DAY },
      (_, n) =>
        `(open_${day}_${n}_from <= ${minute} AND open_${day}_${n}_to > ${minute})`
    ).join(" OR ")

    return `(open_tz IN ${quoted(z)} AND (${frames}))`
  })

  return clauses.length === 1 ? clauses[0]! : `(${clauses.join(" OR ")})`
}

export function findFilter(q: FindQuery, zones: string[]): string {
  const parts: string[] = []
  if (q.place)
    parts.push(`${q.place.level}_slug = ${JSON.stringify(q.place.slug)}`)
  if (q.libraryTypes?.length)
    parts.push(`libraryType IN ${quoted(q.libraryTypes)}`)
  if (q.accessibilityNames?.length)
    parts.push(`accessibility_names IN ${quoted(q.accessibilityNames)}`)
  if (q.serviceNames?.length)
    parts.push(`service_names IN ${quoted(q.serviceNames)}`)
  if (q.digital) parts.push("has_iiif = true")
  if (q.needs?.length) parts.push(`needs IN ${quoted(q.needs)}`)
  if (q.nearLat != null && q.nearLng != null && q.nearRadius != null)
    parts.push(`_geoRadius(${q.nearLat}, ${q.nearLng}, ${q.nearRadius})`)
  if (q.openNow) parts.push(openNowFilter(zones, q.now ?? new Date()))
  parts.push(searchLocaleFilter(q.locale))

  return parts.join(" AND ")
}

export function findSort(q: FindQuery): string[] {
  if (q.sort === "near" && q.nearLat != null && q.nearLng != null)
    return [`_geoPoint(${q.nearLat}, ${q.nearLng}):asc`]
  if (q.sort === "name") return ["name:asc"]
  if (q.sort === "gaps") return ["completeness:asc", "name:asc"]

  return ["completeness:desc", "name:asc"]
}

const ZONES_TTL_MS = 10 * 60 * 1000
const zoneCache = new Map<string, { at: number; zones: Promise<string[]> }>()

/** Every opening-hours zone in the index, from a facet (cached ten minutes). */
async function openZones(locale?: string): Promise<string[]> {
  const key = searchLocale(locale)
  const hit = zoneCache.get(key)
  if (hit && Date.now() - hit.at < ZONES_TTL_MS) return hit.zones
  const zones = meiliClient
    .index("library")
    .search("", {
      filter: searchLocaleFilter(locale),
      limit: 0,
      facets: ["open_tz"],
    })
    .then((res) => Object.keys(res.facetDistribution?.open_tz ?? {}))
  zones.catch(() => zoneCache.delete(key))
  zoneCache.set(key, { at: Date.now(), zones })

  return zones
}

const countOf = (
  dist: Record<string, Record<string, number>> | undefined,
  facet: string
) => Object.values(dist?.[facet] ?? {}).reduce((sum, n) => sum + n, 0)

export async function searchFind(q: FindQuery): Promise<FindResult> {
  const hitsPerPage = q.hitsPerPage ?? 24
  const zones = await openZones(q.locale)
  const base = { indexUid: "library", q: q.query ?? "" }
  const { results } = await meiliClient.multiSearch({
    queries: [
      {
        ...base,
        filter: findFilter(q, zones),
        sort: findSort(q),
        page: (q.page ?? 0) + 1,
        hitsPerPage,
        facets: FACETS,
        attributesToRetrieve: RETRIEVE,
      },
      {
        ...base,
        filter: findFilter({ ...q, openNow: true }, zones),
        limit: 0,
        facets: ["locale"],
      },
    ],
  })
  const [main, open] = results as {
    hits?: LibrarySearchHitV2[]
    facetDistribution?: Record<string, Record<string, number>>
  }[]
  const dist = main?.facetDistribution
  const total = countOf(dist, "locale")

  return {
    hits: main?.hits ?? [],
    total,
    pageCount: Math.max(
      1,
      Math.ceil(Math.min(total, FIND_MAX_REACHABLE) / hitsPerPage)
    ),
    facets: {
      libraryType: dist?.libraryType ?? {},
      accessibility: dist?.accessibility_names ?? {},
      services: dist?.service_names ?? {},
      needs: dist?.needs ?? {},
      hoursKnown: dist?.has_hours?.true ?? 0,
      digital: dist?.has_iiif?.true ?? 0,
      openNow: countOf(open?.facetDistribution, "locale"),
    },
  }
}

/** Every published library in the route's search locale: an exact count. */
export async function libraryTotal(locale?: string): Promise<number> {
  const res = await meiliClient
    .index("library")
    .search("", {
      filter: searchLocaleFilter(locale),
      limit: 0,
      facets: ["locale"],
    })

  return countOf(res.facetDistribution, "locale")
}
```

- [ ] **Step 4: Run the new tests**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/find-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Map page state to a query and move the clock helper**

In `find-helpers.ts`:

```ts
import { localDayMinute, type FindQuery } from "@/lib/find-search"

/** The page state as a search: the one mapping the server and browser share. */
export function findQueryOf(state: FindState, locale: string): FindQuery {
  return {
    query: state.q,
    place: state.place ?? undefined,
    libraryTypes: state.groups.flatMap(
      (key) => TYPE_GROUPS.find((g) => g.key === key)?.types ?? []
    ),
    accessibilityNames: state.access,
    serviceNames: state.services,
    digital: state.digital,
    openNow: state.openNow,
    needs: state.needs,
    nearLat: state.nearLat,
    nearLng: state.nearLng,
    nearRadius:
      state.nearLat != null && state.radiusKm > 0
        ? state.radiusKm * 1000
        : undefined,
    sort: state.sort,
    page: state.page,
    hitsPerPage: 24,
    locale,
  }
}
```

Rewrite `openStatus`'s clock to use `localDayMinute(timezone || "UTC", now)` (compare minutes, with `minutes("HH:mm")` for each timeframe's ends) so the badge and the filter read the clock the same way; keep its return shape. Delete `completenessScore` and `hitNeeds`; change their type import to `import type { LibrarySearchHitV2 } from "@/lib/find-search"`. Add a `find-helpers.test.ts` case: `findQueryOf({ ...DEFAULT_FIND_STATE, groups: ["academic"], nearLat: 1, nearLng: 2, radiusKm: 5 }, "en")` gives `libraryTypes: ["Academic", "University"]`, `nearRadius: 5000`.

- [ ] **Step 6: Rewrite `FindLibraryPage`**

Props become `{ initial: FindResult | null; statsTotal: number }`. Replace the bulk fetch and client refinement:

- `const [result, setResult] = useState(initial)`; on mount skip the first fetch when `initial` is present.
- The fetch effect depends on `JSON.stringify({ ...state, view: undefined })` (page and sort are server-side now) and calls `searchFind({ ...findQueryOf(state, locale), now: new Date() })`; keep the sequence guard and the 250 ms debounce.
- `pageHits = result?.hits ?? []`, `pageCount = result?.pageCount ?? 1`, `total = result?.total ?? 0`; results controls get `total`.
- Facets for the sidebar: `{ libraryType, accessibility, services, needs, openNowCount: facets.openNow, hoursKnownCount: facets.hoursKnown, digitalCount: facets.digital }`.
- `FindMapPanel hits={pageHits}`.
- Under the pager, when `total > FIND_MAX_REACHABLE`: `<p role="status" className="mt-3 text-center text-[14.5px]" style={{ color: T.ink.dim }}>Showing the first {FIND_MAX_REACHABLE.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}. Add a search term or a filter to reach the rest.</p>`.
- The search box gets `placeholder="Library, town or country"` (add `placeholder?: string` to `LibrarySearchBox`, default `"Search libraries, towns or countries"`).

- [ ] **Step 7: Server-render the URL's own state**

```tsx
// apps/ui/src/app/[locale]/libraries/page.tsx (route body)
export default async function FindLibraryRoute(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await props.params
  const raw = await props.searchParams
  const params = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v]] : []
    )
  )
  const state = findStateFromParams(params)
  const [initial, statsTotal] = await Promise.all([
    searchFind(findQueryOf(state, locale)).catch(() => null),
    libraryTotal(locale).catch(() => strapiLibraryTotal()),
  ])
  // …same wrapper, <FindLibraryPage initial={initial} statsTotal={statsTotal} />
}
```

Keep the existing Strapi count as `strapiLibraryTotal()` (the fallback when Meilisearch is down).

- [ ] **Step 8: Update the existing search tests**

In `lib/__tests__/meilisearch.test.ts` drop the `searchLibrariesV2` call from "adds the locale to the v2, Knowledge and Journal searches" (Knowledge and Journal stay). In `search-locale-callers.test.ts` replace `searchLibrariesV2` in `CALL` with `searchFind|libraryTotal`, and make sure `findQueryOf` callers pass a locale.

- [ ] **Step 9: Run the UI tests, types and lint**

Run: `cd apps/ui && npx vitest run src/lib src/components/index-page && npx tsc --noEmit -p . 2>&1 | grep -E "index-page|find-search|libraries/page|meilisearch"; npx eslint src/lib/find-search.ts src/components/index-page "src/app/[locale]/libraries/page.tsx"`
Expected: PASS, no type errors in these files, no lint errors.

- [ ] **Step 10: Check the page**

`curl -s localhost:3000/libraries` → under 400 KB and contains "Search 1,190 published records"; `?q=Brooklyn` is similar in size; Playwright: the default page shows 24 cards, "Open now" filters, page 2 loads, Near me sorts by distance, and the console has no hydration warnings.

---

### Task 6: Homepage coverage and globe count every library

The homepage asks for `pageSize=500`, Strapi caps it at 100, so the globe and coverage have only ever seen 100 libraries (the US isn't listed).

**Files:**

- Modify: `apps/strapi/src/api/continent/services/continent.ts` (`getHomepageSummaries`)
- Test: `apps/strapi/tests/homepage-summaries.test.ts`
- Modify: `apps/ui/src/components/home/homepage.types.ts`, `apps/ui/src/components/home/LibraryHomePage.tsx`, `apps/ui/src/lib/meilisearch.ts` (`fetchGlobeMarkers`)
- Test: `apps/ui/src/lib/__tests__/meilisearch.test.ts`

**Interfaces:**

- Produces: `/api/homepage/continents` items gain `countryTotal: number` and `countries: { name: string; slug: string; libraryCount: number }[]` (countries with libraries, most first); `libraryCount` comes from the same grouped count.
- Produces: `fetchGlobeMarkers(locale?: string): Promise<{ lat: number; lng: number; featured: boolean }[]>`.

- [ ] **Step 1: Write the failing Strapi test**

```ts
// apps/strapi/tests/homepage-summaries.test.ts
import { describe, expect, it, vi } from "vitest"

vi.mock("../src/utils/library-location-counts", () => ({
  countLibrariesByLocationPath: vi.fn(async () => ({
    europe: 107,
    "europe/scotland": 81,
    "europe/england": 26,
    "north-america": 1083,
    "north-america/united-states": 1083,
  })),
}))

const { default: serviceFactory } =
  await import("../src/api/continent/services/continent")

function fakeStrapi() {
  const findMany = vi.fn(async ({ fields }: { fields: string[] }) =>
    fields.includes("code")
      ? [
          { documentId: "eu", name: "Europe", slug: "europe", code: "eu" },
          {
            documentId: "na",
            name: "North America",
            slug: "north-america",
            code: "na",
          },
          { documentId: "af", name: "Africa", slug: "africa", code: "af" },
        ]
      : [
          { name: "Scotland", slug: "scotland", continent: { slug: "europe" } },
          { name: "England", slug: "england", continent: { slug: "europe" } },
          { name: "France", slug: "france", continent: { slug: "europe" } },
          {
            name: "United States",
            slug: "united-states",
            continent: { slug: "north-america" },
          },
        ]
  )

  return { documents: () => ({ findMany }) }
}

describe("getHomepageSummaries", () => {
  it("counts every library per continent and country from one grouped query", async () => {
    const service = (
      serviceFactory as (a: { strapi: unknown }) => {
        getHomepageSummaries: (p: { status: "published" }) => Promise<unknown[]>
      }
    )({ strapi: fakeStrapi() })

    const [europe, northAmerica, africa] = (await service.getHomepageSummaries({
      status: "published",
    })) as Record<string, unknown>[]

    expect(europe).toMatchObject({
      libraryCount: 107,
      countryTotal: 3,
      countries: [
        { name: "Scotland", slug: "scotland", libraryCount: 81 },
        { name: "England", slug: "england", libraryCount: 26 },
      ],
    })
    expect(northAmerica).toMatchObject({
      libraryCount: 1083,
      countryTotal: 1,
      countries: [
        { name: "United States", slug: "united-states", libraryCount: 1083 },
      ],
    })
    expect(africa).toMatchObject({
      libraryCount: 0,
      countryTotal: 0,
      countries: [],
    })
  })
})
```

(Check how `services/continent.ts` is exported first; if it's `factories.createCoreService(uid, ({ strapi }) => ({…}))`, call the inner factory the same way the existing service tests do, e.g. in `tests/location-controllers.test.ts`.)

- [ ] **Step 2: Run it to see it fail**

Run: `cd apps/strapi && npx vitest run tests/homepage-summaries.test.ts`
Expected: FAIL: no `countries` or `countryTotal`.

- [ ] **Step 3: Rewrite `getHomepageSummaries`**

```ts
/** There are under 250 countries; a fixed cap keeps the read bounded. */
const COUNTRY_LIMIT = 500

async getHomepageSummaries({ locale, status }: HomepageSummaryParams) {
  const [continents, countries, counts] = await Promise.all([
    strapi.documents("api::continent.continent").findMany({
      fields: ["documentId", "name", "slug", "code"],
      locale,
      status,
    }),
    strapi.documents("api::country.country").findMany({
      fields: ["name", "slug"],
      populate: { continent: { fields: ["slug"] } },
      locale,
      status,
      limit: COUNTRY_LIMIT,
    }),
    countLibrariesByLocationPath(strapi, { locale, status }),
  ])
  if (!Array.isArray(continents) || continents.length === 0) return []

  return continents.map((continent) => {
    const inContinent = (countries as {
      name?: string
      slug?: string
      continent?: { slug?: string } | null
    }[]).filter((c) => c.continent?.slug === continent.slug && c.slug)

    return {
      ...continent,
      libraryCount: counts[continent.slug ?? ""] ?? 0,
      countryTotal: inContinent.length,
      countries: inContinent
        .map((c) => ({
          name: c.name ?? c.slug!,
          slug: c.slug!,
          libraryCount: counts[`${continent.slug}/${c.slug}`] ?? 0,
        }))
        .filter((c) => c.libraryCount > 0)
        .sort((a, b) => b.libraryCount - a.libraryCount || a.name.localeCompare(b.name)),
    }
  })
}
```

Import `countLibrariesByLocationPath` from `../../../utils/library-location-counts`; remove the per-continent `strapi.db.query(...).count` block and the metadata guard it needed.

- [ ] **Step 4: Run it**

Run: `cd apps/strapi && npx vitest run tests/homepage-summaries.test.ts tests/location-controllers.test.ts tests/library-location-counts.test.ts`
Expected: PASS. `curl -s localhost:1337/api/homepage/continents` shows North America with `countries: [{ name: "United States", libraryCount: 1083 }]`.

- [ ] **Step 5: Write the failing globe test**

Add to `apps/ui/src/lib/__tests__/meilisearch.test.ts` (it already mocks the client's `search` as `mockSearch`):

```ts
describe("fetchGlobeMarkers", () => {
  it("plots one marker per grid cell plus each featured library", async () => {
    mockSearch
      .mockResolvedValueOnce({
        facetDistribution: { geo_cell: { "41,-74": 400, "56,-4": 81 } },
      })
      .mockResolvedValueOnce({ hits: [{ _geo: { lat: 51.53, lng: -0.127 } }] })

    expect(await fetchGlobeMarkers("en")).toEqual([
      { lat: 41, lng: -74, featured: false },
      { lat: 56, lng: -4, featured: false },
      { lat: 51.53, lng: -0.127, featured: true },
    ])
  })
})
```

- [ ] **Step 6: Add `fetchGlobeMarkers`**

```ts
// apps/ui/src/lib/meilisearch.ts
/**
 * Hero-globe markers: one per 1° grid cell that has a library (a facet
 * count, so its size follows the map, not the index), plus every featured
 * library at its own position.
 */
export async function fetchGlobeMarkers(
  locale?: string
): Promise<{ lat: number; lng: number; featured: boolean }[]> {
  const index = meiliClient.index("library")
  const [cells, featured] = await Promise.all([
    index.search("", {
      filter: searchLocaleFilter(locale),
      limit: 0,
      facets: ["geo_cell"],
    }),
    index.search<LibrarySearchHit>("", {
      filter: withSearchLocale(["featured = true"], locale),
      limit: 200,
      attributesToRetrieve: ["_geo"],
    }),
  ])
  const cellMarkers = Object.keys(
    cells.facetDistribution?.geo_cell ?? {}
  ).flatMap((cell) => {
    const [lat, lng] = cell.split(",").map(Number)

    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ lat: lat!, lng: lng!, featured: false }]
      : []
  })
  const featuredMarkers = featured.hits.flatMap((h) =>
    h._geo ? [{ lat: h._geo.lat, lng: h._geo.lng, featured: true }] : []
  )

  return [...cellMarkers, ...featuredMarkers]
}
```

- [ ] **Step 7: Use both on the homepage**

In `homepage.types.ts` add to `HomepageContinentSummary`: `countryTotal?: number` and `countries?: { name: string; slug: string; libraryCount: number }[]`. In `LibraryHomePage.tsx`: delete the `markersPromise` REST fetch and the per-continent `countries?filters…` fetches; build

```ts
const continentSummaries = use(continentSummariesPromise)?.data ?? []
const globeMarkers = use(fetchGlobeMarkers(locale).catch(() => []))
const countryBreakdown = Object.fromEntries(
  continentSummaries
    .filter((c) => c.slug && c.countries?.length)
    .map((c) => [
      c.slug!,
      c.countries!.map(({ name, libraryCount }) => ({
        name,
        count: libraryCount,
      })),
    ])
)
const totalCountriesByContinent = Object.fromEntries(
  continentSummaries.flatMap((c) =>
    c.slug && typeof c.countryTotal === "number"
      ? [[c.slug, c.countryTotal]]
      : []
  )
)
```

(create the `fetchGlobeMarkers` promise next to the other promises at the top so it runs in parallel).

- [ ] **Step 8: Run the tests and check the page**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/meilisearch.test.ts && npx eslint src/components/home src/lib/meilisearch.ts`
Expected: PASS. The homepage HTML lists "United States" with 1,083 in the coverage section; the globe renders.

---

### Task 7: The region page renders 24 cards, and the hydration failure is checked on a production build

The New York page renders 100 library cards (1.6 MB in dev; ~700 KB of it the cards' element tree). "See all 1,083 libraries in New York" already links to Find libraries. A hydration failure showed on about one load in five in dev; check whether a production build has it.

**Files:**

- Modify: `apps/ui/src/components/region/RegionLibraryList.tsx`
- Test: `apps/ui/src/components/region/__tests__/RegionLibraryList.test.ts`

**Interfaces:**

- Produces: `REGION_LIST_LIMIT = 24` exported from `RegionLibraryList.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/ui/src/components/region/__tests__/RegionLibraryList.test.ts
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href }, children),
  }
})
vi.mock("@/components/location/LocationLibraryCard", async () => {
  const { createElement: h } = await import("react")

  return {
    LocationLibraryCard: ({ library }: { library: { name: string } }) =>
      h("span", null, library.name),
  }
})

const { REGION_LIST_LIMIT, RegionLibraryList } =
  await import("../RegionLibraryList")

afterEach(cleanup)

const libraries = Array.from({ length: 100 }, (_, i) => ({
  documentId: `d${i}`,
  slug: `lib-${i}`,
  name: `Library ${i}`,
}))

describe("RegionLibraryList", () => {
  it("renders the first 24 and links to the rest", () => {
    render(
      createElement(RegionLibraryList, {
        regionName: "New York",
        basePath: "/north-america/united-states/new-york",
        libraries: libraries as never,
        gapsBySlug: {},
        total: 1083,
        findHref: "/libraries?region=new-york",
      })
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(REGION_LIST_LIMIT)
    expect(
      screen.getByRole("link", { name: "See all 1,083 libraries in New York" })
    ).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd apps/ui && npx vitest run src/components/region/__tests__/RegionLibraryList.test.ts`
Expected: FAIL: `REGION_LIST_LIMIT` undefined and 100 list items.

- [ ] **Step 3: Cap the list**

In `RegionLibraryList.tsx`:

```ts
/** Cards rendered on a region page; "See all" opens the rest in Find libraries. */
export const REGION_LIST_LIMIT = 24
```

render `libraries.slice(0, REGION_LIST_LIMIT)` and show the "See all" link when `total > shown.length` (`shown` is the slice). The gap stats and hero-map pins keep using the full list from Strapi.

- [ ] **Step 4: Run it and measure**

Run: `cd apps/ui && npx vitest run src/components/region/__tests__/RegionLibraryList.test.ts`, then `curl -s -o /dev/null -w "%{size_download}\n" localhost:3000/north-america/united-states/new-york`.
Expected: PASS; the page drops from ~1.58 MB to under 800 KB in dev.

- [ ] **Step 5: Check hydration on a production build**

```bash
cd apps/ui && export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
NEXT_DIST_DIR=.next-prodcheck npx next build && npx next start -p 3100
```

(If the build fails on another agent's work in progress, record the error and skip to Step 6.) Load `http://localhost:3100/north-america/united-states/new-york` ten times in fresh Playwright contexts and count `pageerror` hydration messages; record the production HTML size.
Expected: zero hydration errors. If there are any, debug with superpowers:systematic-debugging before changing code: capture the full React diff, find the client component whose first render differs, and fix that component.

- [ ] **Step 6: Stop the production server**

Kill the `next start -p 3100` process and remove `apps/ui/.next-prodcheck`.

---

### Task 8: Docs

**Files:**

- Modify: `CLAUDE.md` (Development notes: the seed command; Scale target: Find libraries now pages through Meilisearch)
- Modify: `apps/strapi/scripts/ingests/README.md` (step 5: the bridge secret)
- Modify: memory `project-meilisearch-plugin-sync.md` (seed command)

- [ ] **Step 1: Update CLAUDE.md**

Replace `node apps/strapi/scripts/seed-meilisearch.mjs` with `pnpm --filter @repo/strapi seed:meilisearch` (it reads `config/plugins.ts`, so it seeds every index the plugin indexes). Under the scale rules' known places add nothing new; in "Ask Meilisearch the questions" note "Find libraries asks for one page plus facet counts (`lib/find-search.ts`); totals come from the `locale` facet because `totalHits` stops at 1,000."

- [ ] **Step 2: Run every suite touched**

Run: `cd apps/strapi && npx vitest run` and `cd apps/ui && npx vitest run`
Expected: all pass.
