# Location Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step 2 of the Index editor ("Where is it?") gets an address search, "Use my location", a draggable map pin and pasted-coordinate splitting, all filling the existing fields and the atlas hierarchy, with the fields still editable by hand.

**Architecture:** The browser calls two signed-in, rate-limited Next routes (`/api/geocode/search`, `/api/geocode/reverse`) that proxy komoot's public Photon (OpenStreetMap) server and return a normalised `Place`. Pure helpers turn a `Place` into form values and match it to the atlas (country by ISO code through the relations proxy, region and area by name). A hook (`useLocationFill`) orchestrates the lookups for `StepLocation`, which composes a combobox (`LocationLookup`), the existing fields and a MapLibre pin map (`LocationPinMap`).

**Tech Stack:** Next.js 16 route handlers, React 19 client components, MapLibre GL 5.22, Vitest (node and happy-dom with Testing Library), Playwright (the opt-in `access` project).

**Spec:** `docs/superpowers/specs/2026-10-04-location-lookup-design.md`

## Global Constraints

- Geocoder: Photon, `PHOTON_URL` env var, default `https://photon.komoot.io`. The browser never calls Photon directly.
- Upstream requests: `User-Agent: libraries.global (https://libraries.global; info@libraries.global)`, 5 s timeout, `lang=en`, `next: { revalidate: 86400 }`.
- Search: `q` trimmed, 3–200 characters, `limit=6`; 60 a minute per user. Reverse: lat in [-90, 90], lng in [-180, 180], rounded to 5 decimal places for Photon, `limit=1`; 20 a minute per user. Both 401 when signed out, 429 with `Retry-After`, 502 `{ error: "unavailable" }` when Photon fails.
- Stored coordinates: 6 decimal places, trailing zeros trimmed (`formatCoord`).
- An explicit pick overwrites only the address parts the place has. A reverse lookup fills the address only when every address field is empty; otherwise it offers the address with a "Use this address" button.
- UK: the atlas files England, Scotland, Wales and Northern Ireland as countries with codes `GB-ENG`, `GB-SCT`, `GB-WLS`, `GB-NIR`.
- Design tokens only (`T`, `TYPE_TINT`, `fieldInputStyle`, `fieldHintStyle`, `fieldLabelStyle`); never suppress the global `:focus-visible` outline; status is colour + icon + text.
- Translation mode (`useIsShared("lat")` is true): no search, no location button, no map.
- Copy: "Find the library or its address", "Use my location", "Filled in from OpenStreetMap. Check the details below.", "No matches. Try the street and town, or enter the address below.", "Search isn’t available right now", "Location access is off", "Your location is approximate", "Nearest address to the pin:", "Use this address", "Set from the address. Check these.", "Latitude is a number between -90 and 90.", "Longitude is a number between -180 and 180.", "Paste “51.5297, -0.1271” from Google Maps into either box to fill both."
- Commits: stage and commit only the files the task names (`git add <files> && git commit -m "…" -- <files>`). The tree has other people's uncommitted work: never `git add -A`, never commit `TODOS.md`, `CLAUDE.md` or `apps/ui/.env.local.example`. No `Co-Authored-By` lines.
- Commands run from `apps/ui` unless shown otherwise. Run one test file with `npx vitest run <path>`.

## File map

| File (under `apps/ui/src/` unless stated)                                                     | Responsibility                                                          |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `lib/geocode/coordinates.ts`                                                                  | read, validate, format and paste-split coordinates (pure)               |
| `lib/geocode/place.ts`                                                                        | `Place` type, Photon feature → `Place` (pure, shared server and client) |
| `lib/geocode/photon.ts`                                                                       | server-only Photon calls                                                |
| `lib/geocode/client.ts`                                                                       | browser fetchers for `/api/geocode/*`                                   |
| `app/api/geocode/search/route.ts`, `app/api/geocode/reverse/route.ts`                         | the proxy routes                                                        |
| `app/api/relations/[type]/route.ts`                                                           | adds `countries?iso2=` lookup                                           |
| `app/[locale]/contribute/index/_components/location.apply.ts`                                 | form ← place, UK codes, name matching (pure)                            |
| `app/[locale]/contribute/index/_components/location.hierarchy.ts`                             | `resolveHierarchy` (fetches the atlas lists)                            |
| `app/[locale]/contribute/index/_components/useLocationFill.ts`                                | the lookups' orchestration for step 2                                   |
| `app/[locale]/contribute/index/_components/LocationLookup.tsx`                                | combobox + "Use my location"                                            |
| `app/[locale]/contribute/index/_components/LocationPinMap.tsx`                                | MapLibre map with a draggable pin                                       |
| `app/[locale]/contribute/index/_components/StepLocation.tsx`                                  | step 2, moved out of `WizardSteps.tsx`                                  |
| `app/[locale]/contribute/index/_components/WizardFields.tsx`                                  | `Field` gains `onPaste`, `errorText`                                    |
| `app/[locale]/contribute/index/_components/wizard.validation.ts`                              | coordinate format errors                                                |
| deleted: `lib/geo-lookup.ts`, `hooks/useGeoLookup.ts`, `hooks/__tests__/useGeoLookup.test.ts` | unused browser-side Nominatim helper                                    |
| `qa/tests/playwright/e2e/access/location-lookup.spec.ts` (repo root)                          | E2E                                                                     |

Below, `C` means `src/app/[locale]/contribute/index/_components` (quote the path in a shell: it contains brackets).

---

### Task 1: Coordinate helpers

**Files:**

- Create: `apps/ui/src/lib/geocode/coordinates.ts`
- Test: `apps/ui/src/lib/geocode/__tests__/coordinates.test.ts`

**Interfaces:**

- Produces:
  - `isLatitude(n: number): boolean`, `isLongitude(n: number): boolean`
  - `readCoord(text: string): number` (NaN unless plain decimal degrees)
  - `formatCoord(n: number): string` (6 dp, no trailing zeros)
  - `coordIsValid(axis: "lat" | "lng", text: string): boolean` (blank is valid)
  - `parseCoordinatePair(text: string): { lat: number; lng: number } | null`

- [ ] **Step 1: Write the failing test**

`apps/ui/src/lib/geocode/__tests__/coordinates.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  coordIsValid,
  formatCoord,
  isLatitude,
  isLongitude,
  parseCoordinatePair,
  readCoord,
} from "../coordinates"

describe("readCoord", () => {
  it("reads plain decimal degrees", () => {
    expect(readCoord(" 51.5297 ")).toBe(51.5297)
    expect(readCoord("-0.1271")).toBe(-0.1271)
    expect(readCoord("+12")).toBe(12)
    expect(readCoord(".5")).toBe(0.5)
  })

  it("is NaN for anything else", () => {
    for (const text of [
      "",
      "abc",
      "51,5297",
      "51.5297N",
      "1e3",
      "--1",
      "1.2.3",
    ])
      expect(readCoord(text)).toBeNaN()
  })
})

describe("isLatitude / isLongitude", () => {
  it("bounds latitude to ±90 and longitude to ±180", () => {
    expect(isLatitude(90)).toBe(true)
    expect(isLatitude(-90.0001)).toBe(false)
    expect(isLongitude(-180)).toBe(true)
    expect(isLongitude(180.5)).toBe(false)
    expect(isLatitude(Number.NaN)).toBe(false)
  })
})

describe("formatCoord", () => {
  it("keeps six decimal places and drops trailing zeros", () => {
    expect(formatCoord(51.5299119)).toBe("51.529912")
    expect(formatCoord(-0.12)).toBe("-0.12")
    expect(formatCoord(-0.0000001)).toBe("0")
  })
})

describe("coordIsValid", () => {
  it("accepts a blank box or a number in range", () => {
    expect(coordIsValid("lat", "  ")).toBe(true)
    expect(coordIsValid("lat", "53.83")).toBe(true)
    expect(coordIsValid("lng", "179.9")).toBe(true)
  })

  it("rejects text and numbers out of range", () => {
    expect(coordIsValid("lat", "91")).toBe(false)
    expect(coordIsValid("lng", "-181")).toBe(false)
    expect(coordIsValid("lat", "north")).toBe(false)
  })
})

describe("parseCoordinatePair", () => {
  it.each([
    "51.5297, -0.1271",
    "51.5297,-0.1271",
    "51.5297 -0.1271",
    "(51.5297, -0.1271)",
    "  51.5297 ,  -0.1271  ",
  ])("splits %j", (text) => {
    expect(parseCoordinatePair(text)).toEqual({ lat: 51.5297, lng: -0.1271 })
  })

  it.each(["51.5297", "51.5, -0.1, 3", "91, 0", "0, 181", "51.5297, west", ""])(
    "ignores %j",
    (text) => {
      expect(parseCoordinatePair(text)).toBeNull()
    }
  )
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/geocode/__tests__/coordinates.test.ts`
Expected: FAIL, cannot resolve `../coordinates`.

- [ ] **Step 3: Implement**

`apps/ui/src/lib/geocode/coordinates.ts`:

```ts
// Latitude and longitude as the Index editor stores them: decimal degrees
// in text boxes.

export const isLatitude = (n: number) => Number.isFinite(n) && Math.abs(n) <= 90
export const isLongitude = (n: number) =>
  Number.isFinite(n) && Math.abs(n) <= 180

const DECIMAL = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/

/** A typed coordinate as a number: plain decimal degrees, else NaN. */
export function readCoord(text: string): number {
  const t = text.trim()

  return DECIMAL.test(t) ? Number(t) : Number.NaN
}

/** Six decimal places (about 10 cm) without trailing zeros: "51.5297". */
export function formatCoord(n: number): string {
  return String(Number(n.toFixed(6)) || 0)
}

/** Whether a latitude or longitude box is blank or holds a number in range. */
export function coordIsValid(axis: "lat" | "lng", text: string): boolean {
  if (!text.trim()) return true
  const n = readCoord(text)

  return axis === "lat" ? isLatitude(n) : isLongitude(n)
}

/**
 * Both coordinates from one pasted string: "51.5297, -0.1271" (as Google
 * Maps copies them), "51.5297 -0.1271" or "(51.5297, -0.1271)". Null unless
 * there are exactly two numbers and both are in range.
 */
export function parseCoordinatePair(
  text: string
): { lat: number; lng: number } | null {
  const parts = text
    .trim()
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .split(/[\s,]+/)
    .filter(Boolean)
  if (parts.length !== 2) return null
  const lat = readCoord(parts[0] ?? "")
  const lng = readCoord(parts[1] ?? "")

  return isLatitude(lat) && isLongitude(lng) ? { lat, lng } : null
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/geocode/__tests__/coordinates.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
git add apps/ui/src/lib/geocode/coordinates.ts apps/ui/src/lib/geocode/__tests__/coordinates.test.ts
git commit -m "feat(ui): add coordinate helpers for the location lookup" -- apps/ui/src/lib/geocode/coordinates.ts apps/ui/src/lib/geocode/__tests__/coordinates.test.ts
```

---

### Task 2: Photon features → `Place`

**Files:**

- Create: `apps/ui/src/lib/geocode/place.ts`
- Create: `apps/ui/src/lib/geocode/__tests__/photon-fixtures.ts`
- Test: `apps/ui/src/lib/geocode/__tests__/place.test.ts`

**Interfaces:**

- Produces:
  - `interface PlaceAddress { streetAddress; district; city; postalCode; country; countryCode; state; county }` (all `string`)
  - `interface Place { id: string; label: string; detail: string; kind: string; lat: number; lng: number; precise: boolean; address: PlaceAddress }`
  - `interface PhotonFeature` (input shape)
  - `streetLine(street: string, housenumber: string, countryCode: string): string`
  - `toPlace(feature: PhotonFeature): Place | null`
  - `toPlaces(json: unknown): Place[]`
- Fixtures (used again in Task 3): `BRITISH_LIBRARY`, `BAVARIAN_STATE_LIBRARY`, `BRONTE_MUSEUM`, `HAWORTH_VILLAGE`, `CHURCH_STREET`, `HAWORTH_CHURCHYARD`.

- [ ] **Step 1: Add the fixtures**

Real Photon answers, recorded 2026-10-04 (only the keys `toPlace` reads).

`apps/ui/src/lib/geocode/__tests__/photon-fixtures.ts`:

```ts
// Photon answers recorded on 2026-10-04 (`lang=en`), trimmed to the keys
// toPlace reads.
import type { PhotonFeature } from "../place"

export const BRITISH_LIBRARY: PhotonFeature = {
  geometry: { coordinates: [-0.1276918, 51.5299119] },
  properties: {
    osm_type: "W",
    osm_id: 4680891,
    osm_key: "amenity",
    osm_value: "library",
    type: "house",
    housenumber: "96",
    name: "British Library",
    street: "Euston Road",
    district: "Somers Town",
    city: "London",
    state: "England",
    country: "United Kingdom",
    postcode: "NW1 2DB",
    countrycode: "GB",
  },
}

export const BAVARIAN_STATE_LIBRARY: PhotonFeature = {
  geometry: { coordinates: [11.5806127, 48.1473962] },
  properties: {
    osm_type: "R",
    osm_id: 52412,
    osm_key: "amenity",
    osm_value: "library",
    type: "house",
    housenumber: "16",
    name: "Bavarian State Library",
    street: "Ludwigstraße",
    locality: "Schönfeldvorstadt",
    district: "Maxvorstadt",
    city: "Munich",
    state: "Bavaria",
    country: "Germany",
    postcode: "80539",
    countrycode: "DE",
  },
}

export const BRONTE_MUSEUM: PhotonFeature = {
  geometry: { coordinates: [-1.9574451, 53.8311966] },
  properties: {
    osm_type: "W",
    osm_id: 61300076,
    osm_key: "tourism",
    osm_value: "museum",
    type: "house",
    name: "Bronte Parsonage Museum",
    street: "Church Street",
    locality: "Haworth Brow",
    district: "Haworth and Stanbury",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    postcode: "BD22 8DR",
    countrycode: "GB",
  },
}

export const HAWORTH_VILLAGE: PhotonFeature = {
  geometry: { coordinates: [-1.9485865, 53.8311942] },
  properties: {
    osm_type: "N",
    osm_id: 4813966154,
    osm_key: "place",
    osm_value: "village",
    type: "district",
    name: "Haworth",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    postcode: "BD22 8NJ",
    countrycode: "GB",
  },
}

export const CHURCH_STREET: PhotonFeature = {
  geometry: { coordinates: [-1.9573306, 53.8312899] },
  properties: {
    osm_type: "W",
    osm_id: 694332238,
    osm_key: "highway",
    osm_value: "unclassified",
    type: "street",
    name: "Church Street",
    locality: "Haworth Brow",
    district: "Haworth and Stanbury",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    postcode: "BD22 8DR",
    countrycode: "GB",
  },
}

/** A reverse-lookup answer: no street, no postcode. */
export const HAWORTH_CHURCHYARD: PhotonFeature = {
  geometry: { coordinates: [-1.9566318, 53.8309287] },
  properties: {
    osm_type: "W",
    osm_id: 120289822,
    osm_key: "landuse",
    osm_value: "cemetery",
    type: "other",
    name: "Haworth Churchyard",
    locality: "Haworth Brow",
    district: "Haworth and Stanbury",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    countrycode: "GB",
  },
}
```

- [ ] **Step 2: Write the failing test**

`apps/ui/src/lib/geocode/__tests__/place.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { streetLine, toPlace, toPlaces } from "../place"
import {
  BAVARIAN_STATE_LIBRARY,
  BRITISH_LIBRARY,
  BRONTE_MUSEUM,
  CHURCH_STREET,
  HAWORTH_CHURCHYARD,
  HAWORTH_VILLAGE,
} from "./photon-fixtures"

describe("toPlace", () => {
  it("reads a library with a house number, number first in the UK", () => {
    expect(toPlace(BRITISH_LIBRARY)).toEqual({
      id: "W4680891",
      label: "British Library",
      detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
      kind: "Library",
      lat: 51.5299119,
      lng: -0.1276918,
      precise: true,
      address: {
        streetAddress: "96 Euston Road",
        district: "Somers Town",
        city: "London",
        postalCode: "NW1 2DB",
        country: "United Kingdom",
        countryCode: "GB",
        state: "England",
        county: "",
      },
    })
  })

  it("puts the number after the street in Germany", () => {
    const place = toPlace(BAVARIAN_STATE_LIBRARY)
    expect(place?.address.streetAddress).toBe("Ludwigstraße 16")
    expect(place?.address.city).toBe("Munich")
    expect(place?.address.countryCode).toBe("DE")
  })

  it("reads a building on a street without a number", () => {
    const place = toPlace(BRONTE_MUSEUM)
    expect(place).toMatchObject({
      label: "Bronte Parsonage Museum",
      kind: "Museum",
      precise: true,
      detail:
        "Church Street, Haworth and Stanbury, Bradford, West Yorkshire, England, United Kingdom",
    })
    expect(place?.address).toMatchObject({
      streetAddress: "Church Street",
      district: "Haworth and Stanbury",
      city: "Bradford",
      postalCode: "BD22 8DR",
      county: "West Yorkshire",
    })
  })

  it("names a settlement as its own city, without its stray postcode", () => {
    expect(toPlace(HAWORTH_VILLAGE)).toMatchObject({
      label: "Haworth",
      kind: "Village",
      precise: false,
      detail: "West Yorkshire, England, United Kingdom",
      address: { city: "Haworth", district: "", postalCode: "" },
    })
  })

  it("takes a street result's name as the street", () => {
    expect(toPlace(CHURCH_STREET)).toMatchObject({
      label: "Church Street",
      kind: "Street",
      precise: false,
      detail:
        "Haworth and Stanbury, Bradford, West Yorkshire, England, United Kingdom",
      address: { streetAddress: "Church Street", postalCode: "BD22 8DR" },
    })
  })

  it("reads a reverse answer with no street", () => {
    expect(toPlace(HAWORTH_CHURCHYARD)).toMatchObject({
      label: "Haworth Churchyard",
      kind: "Cemetery",
      precise: false,
      address: { streetAddress: "", city: "Bradford", postalCode: "" },
    })
  })

  it("skips a feature without a position or anything to call it", () => {
    expect(toPlace({ properties: { name: "Nowhere" } })).toBeNull()
    expect(
      toPlace({ geometry: { coordinates: [0, 0] }, properties: {} })
    ).toBeNull()
  })
})

describe("streetLine", () => {
  it("orders the number as the country writes it", () => {
    expect(streetLine("Euston Road", "96", "GB")).toBe("96 Euston Road")
    expect(streetLine("Ludwigstraße", "16", "DE")).toBe("Ludwigstraße 16")
    expect(streetLine("Main St", "", "US")).toBe("Main St")
    expect(streetLine("", "3", "GB")).toBe("")
  })
})

describe("toPlaces", () => {
  it("reads a FeatureCollection, dropping duplicates and junk", () => {
    const places = toPlaces({
      features: [
        BRITISH_LIBRARY,
        BRITISH_LIBRARY,
        { properties: {} },
        HAWORTH_VILLAGE,
      ],
    })
    expect(places.map((p) => p.id)).toEqual(["W4680891", "N4813966154"])
  })

  it("is empty for anything that isn't one", () => {
    expect(toPlaces(null)).toEqual([])
    expect(toPlaces({ features: "x" })).toEqual([])
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/lib/geocode/__tests__/place.test.ts`
Expected: FAIL, cannot resolve `../place`.

- [ ] **Step 4: Implement**

`apps/ui/src/lib/geocode/place.ts`:

```ts
// Photon (OpenStreetMap) features, normalised to what the Index editor needs.
// Shared by the server routes that call Photon and the client that shows
// the results.

export interface PlaceAddress {
  streetAddress: string
  district: string
  city: string
  postalCode: string
  /** In English, as Photon names it: "United Kingdom". */
  country: string
  /** ISO 3166-1 alpha-2, upper-case: "GB". Empty when unknown. */
  countryCode: string
  state: string
  county: string
}

export interface Place {
  /** OSM type and id: "W4680891". */
  id: string
  /** The place's name, or its street line when it has none. */
  label: string
  /** Where it is: "96 Euston Road, Somers Town, London, England, United Kingdom". */
  detail: string
  /** What it is: "Library", "Street", "Village". */
  kind: string
  lat: number
  lng: number
  /** A building or an address, not a street, settlement or region. */
  precise: boolean
  address: PlaceAddress
}

type PhotonKey =
  | "osm_type"
  | "osm_key"
  | "osm_value"
  | "type"
  | "name"
  | "housenumber"
  | "street"
  | "locality"
  | "district"
  | "city"
  | "county"
  | "state"
  | "country"
  | "postcode"
  | "countrycode"

/** The parts of a Photon GeoJSON feature we read. */
export interface PhotonFeature {
  geometry?: { coordinates?: number[] }
  properties?: Partial<Record<PhotonKey, string>> & { osm_id?: number }
}

// Countries that write the house number after the street: "Ludwigstraße 16".
const NUMBER_AFTER_STREET = new Set([
  "AR",
  "AT",
  "BA",
  "BE",
  "BO",
  "BR",
  "CH",
  "CL",
  "CO",
  "CR",
  "CZ",
  "DE",
  "DK",
  "EC",
  "ES",
  "FI",
  "GR",
  "GT",
  "HN",
  "HR",
  "HU",
  "IS",
  "IT",
  "LI",
  "LU",
  "ME",
  "MK",
  "MX",
  "NI",
  "NL",
  "NO",
  "PA",
  "PE",
  "PL",
  "PT",
  "PY",
  "RO",
  "RS",
  "SE",
  "SI",
  "SK",
  "SV",
  "TR",
  "UY",
  "VE",
])

const SETTLEMENTS = new Set(["city", "town", "village", "hamlet"])

const KINDS = new Map([
  ["library", "Library"],
  ["museum", "Museum"],
  ["archive", "Archive"],
  ["university", "University"],
  ["college", "College"],
  ["school", "School"],
  ["place_of_worship", "Place of worship"],
  ["community_centre", "Community centre"],
  ["arts_centre", "Arts centre"],
  ["townhall", "Town hall"],
  ["house", "Address"],
  ["city", "City"],
  ["town", "Town"],
  ["village", "Village"],
  ["hamlet", "Hamlet"],
])

type Props = NonNullable<PhotonFeature["properties"]>

const text = (value: string | undefined) => value?.trim() ?? ""

/** The street with its number, in the order the country writes them. */
export function streetLine(
  street: string,
  housenumber: string,
  countryCode: string
): string {
  if (!street) return ""
  if (!housenumber) return street

  return NUMBER_AFTER_STREET.has(countryCode)
    ? `${street} ${housenumber}`
    : `${housenumber} ${street}`
}

function kindOf(props: Props): string {
  const value = text(props.osm_value)
  const known = KINDS.get(value)
  if (known) return known
  if (props.type === "street") return "Street"
  if (!value || value === "yes") return "Place"
  const words = value.replaceAll("_", " ")

  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** One Photon feature as a Place, or null without a position or a name. */
export function toPlace(feature: PhotonFeature): Place | null {
  const p: Props = feature.properties ?? {}
  const [lng, lat] = feature.geometry?.coordinates ?? []
  if (typeof lat !== "number" || typeof lng !== "number") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const countryCode = text(p.countrycode).toUpperCase()
  const name = text(p.name)
  const isStreet = p.type === "street"
  const isSettlement =
    p.osm_key === "place" && SETTLEMENTS.has(text(p.osm_value))
  const precise = p.type === "house" || !!text(p.housenumber)
  const street = streetLine(
    text(p.street) || (isStreet ? name : ""),
    text(p.housenumber),
    countryCode
  )
  // Photon's `city` is the district council in some countries (Haworth's is
  // "Bradford"), so a settlement is its own city.
  const city = isSettlement ? name : text(p.city) || text(p.locality)
  const district = text(p.district) === city ? "" : text(p.district)
  const label = name || street || city
  if (!label) return null

  const where = [
    street,
    district,
    city,
    text(p.county),
    text(p.state),
    text(p.country),
  ]

  return {
    id: `${text(p.osm_type)}${p.osm_id ?? ""}` || `${lat},${lng}`,
    label,
    detail: [...new Set(where.filter((part) => part && part !== label))].join(
      ", "
    ),
    kind: kindOf(p),
    lat,
    lng,
    precise,
    address: {
      streetAddress: street,
      district,
      city,
      // A settlement's postcode is one of many: only an address or a street
      // has its own.
      postalCode: precise || isStreet ? text(p.postcode) : "",
      country: text(p.country),
      countryCode,
      state: text(p.state),
      county: text(p.county),
    },
  }
}

/** A Photon FeatureCollection as Places, without duplicates. */
export function toPlaces(json: unknown): Place[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  const seen = new Set<string>()
  const places: Place[] = []
  for (const feature of features) {
    const place = toPlace(feature as PhotonFeature)
    if (!place || seen.has(place.id)) continue
    seen.add(place.id)
    places.push(place)
  }

  return places
}
```

Prettier will reflow `NUMBER_AFTER_STREET` to one code per line on commit; that's fine.

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run src/lib/geocode/__tests__/place.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
F="apps/ui/src/lib/geocode/place.ts apps/ui/src/lib/geocode/__tests__/photon-fixtures.ts apps/ui/src/lib/geocode/__tests__/place.test.ts"
git add $F && git commit -m "feat(ui): normalise Photon results into places" -- $F
```

---

### Task 3: Photon client and the geocoding routes

**Files:**

- Create: `apps/ui/src/lib/geocode/photon.ts`
- Create: `apps/ui/src/app/api/geocode/search/route.ts`
- Create: `apps/ui/src/app/api/geocode/reverse/route.ts`
- Delete: `apps/ui/src/lib/geo-lookup.ts`, `apps/ui/src/hooks/useGeoLookup.ts`, `apps/ui/src/hooks/__tests__/useGeoLookup.test.ts`
- Test: `apps/ui/src/lib/geocode/__tests__/photon.test.ts`, `apps/ui/src/app/api/geocode/__tests__/routes.test.ts`

**Interfaces:**

- Consumes: `toPlaces`, `Place` (Task 2); `readCoord`, `isLatitude`, `isLongitude` (Task 1); `getSessionSSR` (`@/lib/auth-server`); `createRateLimiter`, `rateLimitResponse` (`@/lib/rate-limit`).
- Produces:
  - `searchPlaces(query: string): Promise<Place[]>` (throws when Photon fails)
  - `reversePlace(lat: number, lng: number): Promise<Place | null>` (throws when Photon fails)
  - `GET /api/geocode/search?q=` → `{ data: Place[] }`
  - `GET /api/geocode/reverse?lat=&lng=` → `{ data: Place | null }`

- [ ] **Step 1: Write the failing Photon test**

`apps/ui/src/lib/geocode/__tests__/photon.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { reversePlace, searchPlaces } from "../photon"
import { BRITISH_LIBRARY, HAWORTH_CHURCHYARD } from "./photon-fixtures"

const fetchMock = vi.fn()

function requested() {
  const [url, init] = fetchMock.mock.calls[0] ?? []

  return {
    url: new URL(String(url)),
    init: init as RequestInit & { next?: { revalidate?: number } },
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(Response.json({ features: [BRITISH_LIBRARY] }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

describe("searchPlaces", () => {
  it("asks komoot's Photon for six English results, as us, cached a day", async () => {
    const places = await searchPlaces("British Library")
    const { url, init } = requested()
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "British Library",
      limit: "6",
      lang: "en",
    })
    expect(new Headers(init.headers).get("User-Agent")).toBe(
      "libraries.global (https://libraries.global; info@libraries.global)"
    )
    expect(init.next?.revalidate).toBe(86_400)
    expect(places.map((p) => p.label)).toEqual(["British Library"])
  })

  it("uses PHOTON_URL when it is set", async () => {
    vi.stubEnv("PHOTON_URL", "https://photon.example.org/")
    await searchPlaces("Haworth")
    expect(requested().url.href).toMatch(
      /^https:\/\/photon\.example\.org\/api\?/
    )
  })

  it("throws when Photon fails", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 503 }))
    await expect(searchPlaces("Haworth")).rejects.toThrow()
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    await expect(searchPlaces("Haworth")).rejects.toThrow()
  })
})

describe("reversePlace", () => {
  it("rounds the point to five places and returns the nearest place", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ features: [HAWORTH_CHURCHYARD] })
    )
    const place = await reversePlace(53.83092871, -1.95663181)
    const { url } = requested()
    expect(url.pathname).toBe("/reverse")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: "53.83093",
      lon: "-1.95663",
      limit: "1",
      lang: "en",
    })
    expect(place?.label).toBe("Haworth Churchyard")
  })

  it("is null when nothing is near", async () => {
    fetchMock.mockResolvedValue(Response.json({ features: [] }))
    expect(await reversePlace(0, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/geocode/__tests__/photon.test.ts`
Expected: FAIL, cannot resolve `../photon`.

- [ ] **Step 3: Implement the Photon client**

`apps/ui/src/lib/geocode/photon.ts`:

```ts
import "server-only"

import { type Place, toPlaces } from "./place"

// komoot's public Photon: OpenStreetMap data, no key, fair use. Set
// PHOTON_URL to use a self-hosted Photon instead.
const DEFAULT_URL = "https://photon.komoot.io"
const USER_AGENT =
  "libraries.global (https://libraries.global; info@libraries.global)"

async function photon(
  path: "/api" | "/reverse",
  params: Record<string, string>
): Promise<Place[]> {
  const base = process.env.PHOTON_URL || DEFAULT_URL
  const url = new URL(`${base.endsWith("/") ? base.slice(0, -1) : base}${path}`)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    // The same query gives everyone the same places: keep answers a day.
    next: { revalidate: 86_400 },
  })
  if (!res.ok) throw new Error(`Photon answered ${res.status}`)

  return toPlaces(await res.json())
}

/** Up to six places matching a name or address. Throws when Photon fails. */
export function searchPlaces(query: string): Promise<Place[]> {
  return photon("/api", { q: query, limit: "6", lang: "en" })
}

/**
 * The place nearest a point, or null. The point is rounded to five decimal
 * places (about a metre) so nearby pins share a cache entry. Throws when
 * Photon fails.
 */
export async function reversePlace(
  lat: number,
  lng: number
): Promise<Place | null> {
  const [place] = await photon("/reverse", {
    lat: lat.toFixed(5),
    lon: lng.toFixed(5),
    limit: "1",
    lang: "en",
  })

  return place ?? null
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/geocode/__tests__/photon.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route tests**

`apps/ui/src/app/api/geocode/__tests__/routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  value: null as null | { user: { id: string } },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
const photon = vi.hoisted(() => ({
  searchPlaces: vi.fn(),
  reversePlace: vi.fn(),
}))
vi.mock("@/lib/geocode/photon", () => photon)

const search = await import("../search/route")
const reverse = await import("../reverse/route")

const get = (path: string) => new Request(`http://localhost${path}`)

let user = 0
beforeEach(() => {
  vi.clearAllMocks()
  // A new user per test: the rate limiter's counts outlive a test.
  session.value = { user: { id: `u${++user}` } }
  photon.searchPlaces.mockResolvedValue([
    { id: "W1", label: "British Library" },
  ])
  photon.reversePlace.mockResolvedValue({
    id: "W2",
    label: "Haworth Churchyard",
  })
})

describe("GET /api/geocode/search", () => {
  it("is for signed-in users only", async () => {
    session.value = null
    const res = await search.GET(get("/api/geocode/search?q=British"))
    expect(res.status).toBe(401)
    expect(photon.searchPlaces).not.toHaveBeenCalled()
  })

  it("needs 3 to 200 characters", async () => {
    for (const q of ["", "ab", "  ab  ", "x".repeat(201)]) {
      const res = await search.GET(
        get(`/api/geocode/search?q=${encodeURIComponent(q)}`)
      )
      expect(res.status).toBe(400)
    }
    expect(photon.searchPlaces).not.toHaveBeenCalled()
  })

  it("returns the places for the trimmed query", async () => {
    const res = await search.GET(
      get("/api/geocode/search?q=%20British%20Library%20")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: [{ id: "W1", label: "British Library" }],
    })
    expect(photon.searchPlaces).toHaveBeenCalledWith("British Library")
  })

  it("answers 502 when Photon fails", async () => {
    photon.searchPlaces.mockRejectedValue(new Error("Photon answered 503"))
    const res = await search.GET(get("/api/geocode/search?q=Haworth"))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: "unavailable" })
  })

  it("allows each user 60 searches a minute", async () => {
    for (let i = 0; i < 60; i++)
      await search.GET(get("/api/geocode/search?q=Haworth"))
    const res = await search.GET(get("/api/geocode/search?q=Haworth"))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBeTruthy()
  })
})

describe("GET /api/geocode/reverse", () => {
  it("is for signed-in users only", async () => {
    session.value = null
    const res = await reverse.GET(get("/api/geocode/reverse?lat=53.8&lng=-1.9"))
    expect(res.status).toBe(401)
  })

  it("needs a latitude and longitude in range", async () => {
    for (const qs of [
      "lat=91&lng=0",
      "lat=0&lng=181",
      "lat=abc&lng=0",
      "lat=0",
    ]) {
      const res = await reverse.GET(get(`/api/geocode/reverse?${qs}`))
      expect(res.status).toBe(400)
    }
    expect(photon.reversePlace).not.toHaveBeenCalled()
  })

  it("returns the nearest place", async () => {
    const res = await reverse.GET(
      get("/api/geocode/reverse?lat=53.8309287&lng=-1.9566318")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { id: "W2", label: "Haworth Churchyard" },
    })
    expect(photon.reversePlace).toHaveBeenCalledWith(53.8309287, -1.9566318)
  })

  it("answers 502 when Photon fails", async () => {
    photon.reversePlace.mockRejectedValue(new Error("timeout"))
    const res = await reverse.GET(get("/api/geocode/reverse?lat=1&lng=1"))
    expect(res.status).toBe(502)
  })

  it("allows each user 20 lookups a minute", async () => {
    for (let i = 0; i < 20; i++)
      await reverse.GET(get("/api/geocode/reverse?lat=1&lng=1"))
    const res = await reverse.GET(get("/api/geocode/reverse?lat=1&lng=1"))
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run src/app/api/geocode/__tests__/routes.test.ts`
Expected: FAIL, cannot resolve `../search/route`.

- [ ] **Step 7: Implement the routes**

`apps/ui/src/app/api/geocode/search/route.ts`:

```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { searchPlaces } from "@/lib/geocode/photon"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

// Search-as-you-type sends one request per pause: generous, but capped.
const limiter = createRateLimiter({
  name: "geocode-search",
  max: 60,
  windowMs: 60_000,
})

/** Places matching `q`, for the Index editor's location search. */
export async function GET(req: Request) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 3 || q.length > 200)
    return NextResponse.json(
      { error: "Search for 3 to 200 characters." },
      { status: 400 }
    )

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  try {
    return NextResponse.json({ data: await searchPlaces(q) })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 })
  }
}
```

`apps/ui/src/app/api/geocode/reverse/route.ts`:

```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { isLatitude, isLongitude, readCoord } from "@/lib/geocode/coordinates"
import { reversePlace } from "@/lib/geocode/photon"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

// One lookup per dropped pin or "Use my location".
const limiter = createRateLimiter({
  name: "geocode-reverse",
  max: 20,
  windowMs: 60_000,
})

/** The place nearest `lat`/`lng`, for the Index editor's map pin. */
export async function GET(req: Request) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const lat = readCoord(params.get("lat") ?? "")
  const lng = readCoord(params.get("lng") ?? "")
  if (!isLatitude(lat) || !isLongitude(lng))
    return NextResponse.json(
      { error: "lat and lng must be coordinates." },
      { status: 400 }
    )

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  try {
    return NextResponse.json({ data: await reversePlace(lat, lng) })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 })
  }
}
```

- [ ] **Step 8: Run the route tests to see them pass**

Run: `npx vitest run src/app/api/geocode/__tests__/routes.test.ts`
Expected: PASS.

- [ ] **Step 9: Delete the unused Nominatim helper**

```bash
cd /Users/alexbennett/Development/personal/libraries.global/apps/ui
grep -rn "geo-lookup\|useGeoLookup" src --include="*.ts" --include="*.tsx" | grep -v "src/lib/geo-lookup.ts\|src/hooks/useGeoLookup.ts\|src/hooks/__tests__/useGeoLookup.test.ts"
```

Expected: no output (nothing else uses them). Then:

```bash
git rm -q src/lib/geo-lookup.ts src/hooks/useGeoLookup.ts src/hooks/__tests__/useGeoLookup.test.ts
```

- [ ] **Step 10: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
F="apps/ui/src/lib/geocode/photon.ts apps/ui/src/lib/geocode/__tests__/photon.test.ts apps/ui/src/app/api/geocode/search/route.ts apps/ui/src/app/api/geocode/reverse/route.ts apps/ui/src/app/api/geocode/__tests__/routes.test.ts apps/ui/src/lib/geo-lookup.ts apps/ui/src/hooks/useGeoLookup.ts apps/ui/src/hooks/__tests__/useGeoLookup.test.ts"
git add $F && git commit -m "feat(ui): proxy Photon geocoding for signed-in contributors

Search and reverse lookups go through /api/geocode/*, rate-limited per
user and cached a day, so the browser never calls Photon. Drops the
unused browser-side Nominatim helper." -- $F
```

---

### Task 4: Atlas country by ISO code

**Files:**

- Modify: `apps/ui/src/app/api/relations/[type]/route.ts`
- Test: `apps/ui/src/app/api/relations/[type]/__tests__/route.test.ts`

**Interfaces:**

- Produces: `GET /api/relations/countries?iso2=GB-ENG,GB` → `{ data: { documentId: string; name: string; iso2: string; continentDocumentId: string }[] }`, rows in the order the codes were given, at most 3 codes, codes matching `/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/` after upper-casing.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/api/relations/[type]/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

const { GET } = await import("../route")

const countries = (qs: string) =>
  GET(new Request(`http://localhost/api/relations/countries?${qs}`), {
    params: Promise.resolve({ type: "countries" }),
  })

const strapiUrl = () => decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))

const ENGLAND = {
  documentId: "eng",
  name: "England",
  iso2: "GB-ENG",
  continent: { documentId: "eu", name: "Europe" },
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(Response.json({ data: [ENGLAND] }))
  vi.stubGlobal("fetch", fetchMock)
})

describe("GET /api/relations/countries?iso2=", () => {
  it("finds atlas countries by code, in the order asked, with their continent", async () => {
    const res = await countries("iso2=gb-eng,GB")
    expect(await res.json()).toEqual({
      data: [
        {
          documentId: "eng",
          name: "England",
          iso2: "GB-ENG",
          continentDocumentId: "eu",
        },
      ],
    })
    const url = strapiUrl()
    expect(url).toContain("filters[iso2][$in][0]=GB-ENG")
    expect(url).toContain("filters[iso2][$in][1]=GB")
    expect(url).toContain("populate[continent]")
    expect(url).toContain("status=published")
  })

  it("drops codes that aren't ISO codes and asks for at most three", async () => {
    await countries("iso2=GB-ENG,../x,GB,DE,FR")
    const url = strapiUrl()
    expect(url).toContain("[$in][2]=DE")
    expect(url).not.toContain("FR")
    expect(url).not.toContain("../x")
  })

  it("is empty without a valid code, and asks Strapi nothing", async () => {
    const res = await countries("iso2=%2C%2C")
    expect(await res.json()).toEqual({ data: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is empty when Strapi fails", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 500 }))
    expect(await (await countries("iso2=GB")).json()).toEqual({ data: [] })
  })

  it("still lists a continent's countries without iso2", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ data: [{ documentId: "eng", name: "England" }] })
    )
    await countries("continentDocumentId=eu")
    expect(strapiUrl()).toContain("filters[continent][documentId][$eq]=eu")
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run "src/app/api/relations/[type]/__tests__/route.test.ts"`
Expected: FAIL; the first three tests get the continent list response instead.

- [ ] **Step 3: Implement**

In `apps/ui/src/app/api/relations/[type]/route.ts`, add after the `locales()` function:

```ts
const ISO_CODE = /^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/

type CountryRow = {
  documentId: string
  name: string
  iso2?: string | null
  continent?: { documentId?: string } | null
}

/**
 * Atlas countries by ISO code (`?iso2=GB-ENG,GB`), in the order asked, for
 * the location lookup. The UK's countries are filed by ISO 3166-2 code.
 */
async function countriesByCode(raw: string) {
  const codes = raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => ISO_CODE.test(code))
    .slice(0, 3)
  if (codes.length === 0) return NextResponse.json({ data: [] })

  const filters = codes
    .map((code, i) => `filters[iso2][$in][${i}]=${encodeURIComponent(code)}`)
    .join("&")
  const res = await fetch(
    `${STRAPI}/api/countries?${filters}&status=published&pagination[limit]=${codes.length}&fields[0]=name&fields[1]=iso2&populate[continent][fields][0]=name`,
    {
      headers: { ...(SECRET ? { "X-Service-Secret": SECRET } : {}) },
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) return NextResponse.json({ data: [] })
  const rows = ((await res.json()) as { data?: CountryRow[] }).data ?? []

  return NextResponse.json({
    data: codes.flatMap((code) => {
      const row = rows.find((r) => r.iso2?.toUpperCase() === code)
      const continentDocumentId = row?.continent?.documentId

      return row && continentDocumentId
        ? [
            {
              documentId: row.documentId,
              name: row.name,
              iso2: code,
              continentDocumentId,
            },
          ]
        : []
    }),
  })
}
```

Then in `GET`, move the `searchParams` line up and branch before the `TYPE_MAP` lookup. The start of `GET` becomes:

```ts
const { type } = await params
if (type === "topics") return approvedTopics()
if (type === "locales") return locales()
const searchParams = new URL(req.url).searchParams
const iso2 = searchParams.get("iso2")
if (type === "countries" && iso2) return countriesByCode(iso2)
const strapiPlural = TYPE_MAP[type]
if (!strapiPlural)
  return NextResponse.json({ error: "Not found" }, { status: 404 })

const continentFilter = searchParams.get("continentDocumentId")
```

(delete the old `const searchParams = new URL(req.url).searchParams` line further down).

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run "src/app/api/relations/[type]/__tests__/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Check against local Strapi (Strapi running on :1337)**

```bash
curl -s -g "http://127.0.0.1:1337/api/countries?filters[iso2][\$in][0]=GB-ENG&filters[iso2][\$in][1]=GB&status=published&pagination[limit]=2&fields[0]=name&fields[1]=iso2&populate[continent][fields][0]=name" -o /tmp/iso.json && python3 -c "import json;print([(c['name'],c['iso2'],c['continent']['documentId']) for c in json.load(open('/tmp/iso.json'))['data']])"
```

Expected: `[('England', 'GB-ENG', '<a documentId>')]`.

- [ ] **Step 6: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
git add "apps/ui/src/app/api/relations/[type]/route.ts" "apps/ui/src/app/api/relations/[type]/__tests__/route.test.ts"
git commit -m "feat(ui): find atlas countries by ISO code in the relations proxy" -- "apps/ui/src/app/api/relations/[type]/route.ts" "apps/ui/src/app/api/relations/[type]/__tests__/route.test.ts"
```

---

### Task 5: Form ← place, and name matching (pure)

**Files:**

- Create: `apps/ui/C/location.apply.ts` (i.e. `apps/ui/src/app/[locale]/contribute/index/_components/location.apply.ts`)
- Test: `apps/ui/C/__tests__/location.apply.test.ts`

**Interfaces:**

- Consumes: `formatCoord` (Task 1); `Place`, `PlaceAddress` (Task 2); `FormData`, `EMPTY_FORM` (`./wizard.types`).
- Produces:
  - `ADDRESS_KEYS` (`streetAddress`, `district`, `city`, `postalCode`, `country`)
  - `withAddress(form: FormData, address: PlaceAddress): FormData`
  - `applyPlace(form: FormData, place: Place): FormData`
  - `addressIsEmpty(form: FormData): boolean`
  - `locationKey(form: FormData): string`
  - `atlasCountryCodes(address: PlaceAddress): string[]`
  - `placeKey(name: string): string`
  - `matchByName(options: readonly { documentId: string; name: string }[], names: readonly string[]): string | null`

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/[locale]/contribute/index/_components/__tests__/location.apply.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { Place, PlaceAddress } from "@/lib/geocode/place"

import {
  addressIsEmpty,
  applyPlace,
  atlasCountryCodes,
  locationKey,
  matchByName,
  placeKey,
  withAddress,
} from "../location.apply"
import { EMPTY_FORM } from "../wizard.types"

const ADDRESS: PlaceAddress = {
  streetAddress: "96 Euston Road",
  district: "Somers Town",
  city: "London",
  postalCode: "NW1 2DB",
  country: "United Kingdom",
  countryCode: "GB",
  state: "England",
  county: "",
}

const LIBRARY: Place = {
  id: "W4680891",
  label: "British Library",
  detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
  kind: "Library",
  lat: 51.5299119,
  lng: -0.1276918,
  precise: true,
  address: ADDRESS,
}

describe("applyPlace", () => {
  it("writes the address and the coordinates", () => {
    expect(applyPlace({ ...EMPTY_FORM, name: "BL" }, LIBRARY)).toEqual({
      ...EMPTY_FORM,
      name: "BL",
      streetAddress: "96 Euston Road",
      district: "Somers Town",
      city: "London",
      postalCode: "NW1 2DB",
      country: "United Kingdom",
      lat: "51.529912",
      lng: "-0.127692",
    })
  })

  it("keeps what the place doesn't have", () => {
    const form = { ...EMPTY_FORM, district: "Camden", postalCode: "NW1 9ZZ" }
    const place = {
      ...LIBRARY,
      address: { ...ADDRESS, district: "", postalCode: "" },
    }
    expect(applyPlace(form, place)).toMatchObject({
      district: "Camden",
      postalCode: "NW1 9ZZ",
      city: "London",
    })
  })
})

describe("withAddress", () => {
  it("leaves the coordinates alone", () => {
    const form = { ...EMPTY_FORM, lat: "53.83", lng: "-1.95" }
    expect(withAddress(form, ADDRESS)).toMatchObject({
      lat: "53.83",
      lng: "-1.95",
      city: "London",
    })
  })
})

describe("addressIsEmpty", () => {
  it("ignores the coordinates and blank space", () => {
    expect(addressIsEmpty(EMPTY_FORM)).toBe(true)
    expect(addressIsEmpty({ ...EMPTY_FORM, lat: "1", city: "  " })).toBe(true)
    expect(addressIsEmpty({ ...EMPTY_FORM, country: "England" })).toBe(false)
  })
})

describe("locationKey", () => {
  it("changes with any address field or coordinate", () => {
    const key = locationKey(EMPTY_FORM)
    expect(locationKey({ ...EMPTY_FORM, name: "x" })).toBe(key)
    expect(locationKey({ ...EMPTY_FORM, city: "x" })).not.toBe(key)
    expect(locationKey({ ...EMPTY_FORM, lng: "1" })).not.toBe(key)
  })
})

describe("atlasCountryCodes", () => {
  it("tries the UK's countries by their own codes first", () => {
    expect(atlasCountryCodes(ADDRESS)).toEqual(["GB-ENG", "GB"])
    expect(atlasCountryCodes({ ...ADDRESS, state: "Scotland" })).toEqual([
      "GB-SCT",
      "GB",
    ])
    expect(atlasCountryCodes({ ...ADDRESS, state: "" })).toEqual(["GB"])
  })

  it("uses the plain code elsewhere, and nothing without one", () => {
    expect(
      atlasCountryCodes({ ...ADDRESS, countryCode: "DE", state: "Bavaria" })
    ).toEqual(["DE"])
    expect(atlasCountryCodes({ ...ADDRESS, countryCode: "" })).toEqual([])
  })
})

describe("placeKey", () => {
  it("ignores case, accents, spacing and a leading qualifier", () => {
    expect(placeKey("Greater London")).toBe("london")
    expect(placeKey("  The   Hague ")).toBe("hague")
    expect(placeKey("Île-de-France")).toBe("ile-de-france")
    expect(placeKey("County of Durham")).toBe("durham")
    expect(placeKey("West Yorkshire")).toBe("west yorkshire")
  })
})

describe("matchByName", () => {
  const regions = [
    { documentId: "gl", name: "Greater London" },
    { documentId: "wy", name: "West Yorkshire" },
  ]

  it("finds the one option named like any of the names", () => {
    expect(matchByName(regions, ["England", "", "London"])).toBe("gl")
    expect(matchByName(regions, ["west yorkshire"])).toBe("wy")
  })

  it("is null for no match or several", () => {
    expect(matchByName(regions, ["Kent"])).toBeNull()
    expect(matchByName(regions, ["London", "West Yorkshire"])).toBeNull()
    expect(matchByName([{ documentId: "x", name: "" }], [""])).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/location.apply.test.ts"`
Expected: FAIL, cannot resolve `../location.apply`.

- [ ] **Step 3: Implement**

`apps/ui/src/app/[locale]/contribute/index/_components/location.apply.ts`:

```ts
import { formatCoord } from "@/lib/geocode/coordinates"
import type { Place, PlaceAddress } from "@/lib/geocode/place"

import type { FormData } from "./wizard.types"

/** The address fields a place can fill. */
export const ADDRESS_KEYS = [
  "streetAddress",
  "district",
  "city",
  "postalCode",
  "country",
] as const satisfies readonly (keyof FormData & keyof PlaceAddress)[]

const LOCATION_KEYS = [...ADDRESS_KEYS, "lat", "lng"] as const

/** The form with the parts of `address` that aren't empty written over it. */
export function withAddress(form: FormData, address: PlaceAddress): FormData {
  const next = { ...form }
  for (const key of ADDRESS_KEYS) if (address[key]) next[key] = address[key]

  return next
}

/** A search result picked: its address parts and its coordinates. */
export function applyPlace(form: FormData, place: Place): FormData {
  return {
    ...withAddress(form, place.address),
    lat: formatCoord(place.lat),
    lng: formatCoord(place.lng),
  }
}

/** No address field has anything in it (the coordinates don't count). */
export function addressIsEmpty(form: FormData): boolean {
  return ADDRESS_KEYS.every((key) => !form[key].trim())
}

/** The address and coordinates as one string, to tell when they change. */
export function locationKey(form: FormData): string {
  return LOCATION_KEYS.map((key) => form[key]).join("\u0000")
}

// The atlas files the UK as its four countries, by ISO 3166-2 code.
const SUBDIVISIONS = new Map([
  [
    "GB",
    new Map([
      ["england", "GB-ENG"],
      ["scotland", "GB-SCT"],
      ["wales", "GB-WLS"],
      ["northern ireland", "GB-NIR"],
    ]),
  ],
])

/** The atlas country codes to try for an address, most specific first. */
export function atlasCountryCodes(address: PlaceAddress): string[] {
  const code = address.countryCode
  if (!code) return []
  const part = SUBDIVISIONS.get(code)?.get(address.state.trim().toLowerCase())

  return part ? [part, code] : [code]
}

const QUALIFIER = /^(?:the|greater|county of|city of) /

/**
 * A place name compared loosely: case, accents, spacing and a leading
 * "The", "Greater", "County of" or "City of" don't count.
 */
export function placeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .replace(QUALIFIER, "")
}

/** The one option named like any of `names`; null for none or several. */
export function matchByName(
  options: readonly { documentId: string; name: string }[],
  names: readonly string[]
): string | null {
  const wanted = new Set(names.map(placeKey).filter(Boolean))
  const hits = options.filter((option) => wanted.has(placeKey(option.name)))

  return hits.length === 1 ? (hits[0]?.documentId ?? null) : null
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/location.apply.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
D="apps/ui/src/app/[locale]/contribute/index/_components"
git add "$D/location.apply.ts" "$D/__tests__/location.apply.test.ts"
git commit -m "feat(ui): map geocoded places onto the Index editor form" -- "$D/location.apply.ts" "$D/__tests__/location.apply.test.ts"
```

---

### Task 6: Browser fetchers and the atlas hierarchy lookup

**Files:**

- Create: `apps/ui/src/lib/geocode/client.ts`
- Create: `apps/ui/src/app/[locale]/contribute/index/_components/location.hierarchy.ts`
- Test: `apps/ui/src/lib/geocode/__tests__/client.test.ts`, `apps/ui/src/app/[locale]/contribute/index/_components/__tests__/location.hierarchy.test.ts`

**Interfaces:**

- Consumes: `Place`, `PlaceAddress` (Task 2); `atlasCountryCodes`, `matchByName` (Task 5); `/api/relations/countries?iso2=` (Task 4); existing `/api/relations/regions?countryDocumentId=`, `/api/relations/areas?regionDocumentId=`.
- Produces:
  - `findPlaces(query: string, signal?: AbortSignal): Promise<Place[]>` (throws on a non-OK answer)
  - `placeNear(lat: number, lng: number): Promise<Place | null>` (null on any failure)
  - `type HierarchyFill = Pick<FormData, "continentDocumentId" | "countryDocumentId" | "regionDocumentId" | "areaDocumentId" | "country"> & Partial<Pick<FormData, "proposedRegionName" | "proposedAreaName" | "locationRequestDocumentId">>`
  - `resolveHierarchy(form: FormData, address: PlaceAddress): Promise<HierarchyFill | null>`

- [ ] **Step 1: Write the failing client test**

`apps/ui/src/lib/geocode/__tests__/client.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import { findPlaces, placeNear } from "../client"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

describe("findPlaces", () => {
  it("asks the proxy and returns its places", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ id: "W1" }] }))
    const signal = new AbortController().signal
    expect(await findPlaces("British Library", signal)).toEqual([{ id: "W1" }])
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/geocode/search?q=British%20Library",
      { signal }
    )
  })

  it("throws when the proxy refuses", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502 }))
    await expect(findPlaces("Haworth")).rejects.toThrow()
  })
})

describe("placeNear", () => {
  it("asks the proxy for the nearest place", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: { id: "W2" } }))
    expect(await placeNear(53.83, -1.95)).toEqual({ id: "W2" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/geocode/reverse?lat=53.83&lng=-1.95"
    )
  })

  it("is null when the lookup fails", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }))
    expect(await placeNear(0, 0)).toBeNull()
    fetchMock.mockRejectedValue(new TypeError("offline"))
    expect(await placeNear(0, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Write the failing hierarchy test**

`apps/ui/src/app/[locale]/contribute/index/_components/__tests__/location.hierarchy.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PlaceAddress } from "@/lib/geocode/place"

import { resolveHierarchy } from "../location.hierarchy"
import { EMPTY_FORM } from "../wizard.types"

const HAWORTH: PlaceAddress = {
  streetAddress: "Church Street",
  district: "Haworth and Stanbury",
  city: "Bradford",
  postalCode: "BD22 8DR",
  country: "United Kingdom",
  countryCode: "GB",
  state: "England",
  county: "West Yorkshire",
}

const ROUTES: Record<string, unknown[]> = {
  "/api/relations/countries?iso2=GB-ENG%2CGB": [
    {
      documentId: "eng",
      name: "England",
      iso2: "GB-ENG",
      continentDocumentId: "eu",
    },
  ],
  "/api/relations/regions?countryDocumentId=eng": [
    { documentId: "gl", name: "Greater London" },
    { documentId: "wy", name: "West Yorkshire" },
  ],
  "/api/relations/areas?regionDocumentId=wy": [
    { documentId: "brad", name: "Bradford" },
    { documentId: "leeds", name: "Leeds" },
  ],
}

const fetchMock = vi.fn(async (url: string) =>
  Response.json({ data: ROUTES[url] ?? [] })
)
const asked = () => fetchMock.mock.calls.map(([url]) => url)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

describe("resolveHierarchy", () => {
  it("fills every level for an empty form", async () => {
    expect(await resolveHierarchy(EMPTY_FORM, HAWORTH)).toEqual({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "wy",
      areaDocumentId: "brad",
      country: "England",
      proposedRegionName: "",
      proposedAreaName: "",
      locationRequestDocumentId: "",
    })
  })

  it("keeps a region already chosen in the same country", async () => {
    const form = {
      ...EMPTY_FORM,
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "gl",
    }
    expect(await resolveHierarchy(form, HAWORTH)).toEqual({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "gl",
      areaDocumentId: "",
      country: "England",
    })
    expect(asked()).not.toContain(
      "/api/relations/regions?countryDocumentId=eng"
    )
  })

  it("replaces another country, with its requested region or area", async () => {
    const form = {
      ...EMPTY_FORM,
      continentDocumentId: "na",
      countryDocumentId: "us",
      regionDocumentId: "ca",
      proposedAreaName: "Sunnyvale",
    }
    expect(await resolveHierarchy(form, HAWORTH)).toMatchObject({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "wy",
      areaDocumentId: "brad",
      proposedAreaName: "",
    })
  })

  it("leaves a requested region alone", async () => {
    const form = {
      ...EMPTY_FORM,
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      proposedRegionName: "Calderdale",
    }
    expect(await resolveHierarchy(form, HAWORTH)).toEqual({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "",
      areaDocumentId: "",
      country: "England",
    })
    expect(asked()).not.toContain(
      "/api/relations/regions?countryDocumentId=eng"
    )
  })

  it("is null outside the atlas or without a country code", async () => {
    expect(
      await resolveHierarchy(EMPTY_FORM, {
        ...HAWORTH,
        countryCode: "JP",
        state: "Tokyo",
      })
    ).toBeNull()
    fetchMock.mockClear()
    expect(
      await resolveHierarchy(EMPTY_FORM, { ...HAWORTH, countryCode: "" })
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is null when the lookup fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    expect(await resolveHierarchy(EMPTY_FORM, HAWORTH)).toBeNull()
  })
})
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run src/lib/geocode/__tests__/client.test.ts "src/app/[locale]/contribute/index/_components/__tests__/location.hierarchy.test.ts"`
Expected: FAIL, cannot resolve `../client` and `../location.hierarchy`.

- [ ] **Step 4: Implement the fetchers**

`apps/ui/src/lib/geocode/client.ts`:

```ts
// The browser's side of the geocoding proxy (/api/geocode/*).

import type { Place } from "./place"

/** Places matching `query`. Throws when the search is down or limited. */
export async function findPlaces(
  query: string,
  signal?: AbortSignal
): Promise<Place[]> {
  const res = await fetch(
    `/api/geocode/search?q=${encodeURIComponent(query)}`,
    { signal }
  )
  if (!res.ok) throw new Error(`Location search failed: ${res.status}`)
  const json = (await res.json()) as { data?: Place[] }

  return json.data ?? []
}

/** The place nearest a point, or null when there's none or it failed. */
export async function placeNear(
  lat: number,
  lng: number
): Promise<Place | null> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Place | null }

    return json.data ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Implement the hierarchy lookup**

`apps/ui/src/app/[locale]/contribute/index/_components/location.hierarchy.ts`:

```ts
import type { PlaceAddress } from "@/lib/geocode/place"

import { atlasCountryCodes, matchByName } from "./location.apply"
import type { FormData } from "./wizard.types"

type Option = { documentId: string; name: string }
type AtlasCountry = Option & { continentDocumentId: string }

/** What a lookup writes to the hierarchy, and the atlas name of the country. */
export type HierarchyFill = Pick<
  FormData,
  | "continentDocumentId"
  | "countryDocumentId"
  | "regionDocumentId"
  | "areaDocumentId"
  | "country"
> &
  Partial<
    Pick<
      FormData,
      "proposedRegionName" | "proposedAreaName" | "locationRequestDocumentId"
    >
  >

async function list<T>(url: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Atlas lookup failed: ${url}`)
  const json = (await res.json()) as { data?: T[] }

  return Array.isArray(json.data) ? json.data : []
}

/**
 * Where an address sits in the atlas, starting from what the form has.
 * Continent and country come from the ISO code; a different country
 * replaces the selection and any Location Request, as choosing it in the
 * selects would. Region and area are matched by name, only while empty and
 * not requested. Null when the country isn't in the atlas or a lookup failed.
 */
export async function resolveHierarchy(
  form: FormData,
  address: PlaceAddress
): Promise<HierarchyFill | null> {
  const codes = atlasCountryCodes(address)
  if (codes.length === 0) return null

  try {
    const [country] = await list<AtlasCountry>(
      `/api/relations/countries?iso2=${encodeURIComponent(codes.join(","))}`
    )
    if (!country) return null

    const moved = form.countryDocumentId !== country.documentId
    const fill: HierarchyFill = moved
      ? {
          continentDocumentId: country.continentDocumentId,
          countryDocumentId: country.documentId,
          regionDocumentId: "",
          areaDocumentId: "",
          country: country.name,
          proposedRegionName: "",
          proposedAreaName: "",
          locationRequestDocumentId: "",
        }
      : {
          continentDocumentId: form.continentDocumentId,
          countryDocumentId: form.countryDocumentId,
          regionDocumentId: form.regionDocumentId,
          areaDocumentId: form.areaDocumentId,
          country: country.name,
        }
    const requested = moved
      ? { region: "", area: "" }
      : { region: form.proposedRegionName, area: form.proposedAreaName }

    if (!fill.regionDocumentId && !requested.region) {
      const regions = await list<Option>(
        `/api/relations/regions?countryDocumentId=${encodeURIComponent(fill.countryDocumentId)}`
      )
      fill.regionDocumentId =
        matchByName(regions, [
          address.state,
          address.county,
          address.city,
          address.district,
        ]) ?? ""
    }
    if (fill.regionDocumentId && !fill.areaDocumentId && !requested.area) {
      const areas = await list<Option>(
        `/api/relations/areas?regionDocumentId=${encodeURIComponent(fill.regionDocumentId)}`
      )
      fill.areaDocumentId =
        matchByName(areas, [address.county, address.city, address.district]) ??
        ""
    }

    return fill
  } catch {
    return null
  }
}
```

- [ ] **Step 6: Run both to see them pass**

Run: `npx vitest run src/lib/geocode/__tests__/client.test.ts "src/app/[locale]/contribute/index/_components/__tests__/location.hierarchy.test.ts"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
D="apps/ui/src/app/[locale]/contribute/index/_components"
git add apps/ui/src/lib/geocode/client.ts apps/ui/src/lib/geocode/__tests__/client.test.ts "$D/location.hierarchy.ts" "$D/__tests__/location.hierarchy.test.ts"
git commit -m "feat(ui): place a geocoded address in the atlas hierarchy" -- apps/ui/src/lib/geocode/client.ts apps/ui/src/lib/geocode/__tests__/client.test.ts "$D/location.hierarchy.ts" "$D/__tests__/location.hierarchy.test.ts"
```

---

### Task 7: Coordinate validation, pasting, and `StepLocation` in its own file

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/index/_components/StepLocation.tsx`
- Modify: `.../_components/WizardSteps.tsx` (remove `StepLocation`, import it)
- Modify: `.../_components/WizardFields.tsx` (`Field`: `onPaste`, `errorText`)
- Modify: `.../_components/wizard.validation.ts`
- Test: `.../_components/wizard.validation.test.ts`, `.../_components/__tests__/IndexRecordWizard.validation.test.ts`

**Interfaces:**

- Consumes: `coordIsValid`, `parseCoordinatePair`, `formatCoord` (Task 1).
- Produces: `export function StepLocation(props: StepProps)` in `StepLocation.tsx`; `Field` props `onPaste?: React.ClipboardEventHandler<HTMLInputElement>` and `errorText?: string`; `missingFields` also lists `lat`/`lng` when filled and not a number in range.

- [ ] **Step 1: Write the failing validation tests**

Append to `apps/ui/src/app/[locale]/contribute/index/_components/wizard.validation.test.ts`, inside `describe("missingFields", …)`:

```ts
it("flags a coordinate that isn't a number in range", () => {
  expect(missingFields(2, { ...complete, lat: "91" }, adding)).toEqual(["lat"])
  expect(missingFields(2, { ...complete, lng: "west" }, adding)).toEqual([
    "lng",
  ])
  expect(
    missingFields(2, { ...complete, lat: "53.83", lng: "-1.957" }, adding)
  ).toEqual([])
  expect(missingFields(2, { ...complete, city: "", lat: "x" }, adding)).toEqual(
    ["city", "lat"]
  )
})

it("leaves the coordinates alone while translating", () => {
  const editable = new Set(editableFields(true, Object.keys(EMPTY_FORM)))
  const scope = { record: complete, editable }

  expect(missingFields(2, { ...complete, lat: "x" }, scope)).toEqual([])
})
```

and inside `describe("firstIncompleteStep", …)`:

```ts
it("stops at a malformed coordinate", () => {
  expect(firstIncompleteStep({ ...complete, lng: "200" }, adding)).toBe(2)
})
```

- [ ] **Step 2: Write the failing wizard test**

Append inside `describe("IndexRecordWizard", …)` in `.../_components/__tests__/IndexRecordWizard.validation.test.ts`:

```ts
it("holds the Location step on a coordinate out of range, and splits a pasted pair", () => {
  render(
    createElement(IndexRecordWizard, {
      mode: "new",
      initialData: {
        name: "Radlett Library",
        libraryType: "Public",
        operationalStatus: "open",
        city: "Radlett",
        country: "England",
      },
    })
  )
  fireEvent.click(nextButton())
  expect(screen.getByRole("heading", { name: "Where is it?" })).toBeTruthy()

  const latitude = () => screen.getByLabelText(/^Latitude/) as HTMLInputElement
  fireEvent.change(latitude(), { target: { value: "200" } })
  fireEvent.click(nextButton())
  expect(errorIds()).toEqual(["lat"])
  expect(
    screen.getByText("Latitude is a number between -90 and 90.")
  ).toBeTruthy()

  fireEvent.paste(latitude(), {
    clipboardData: { getData: () => "51.7031, -0.3255" },
  })
  expect(latitude().value).toBe("51.7031")
  expect((screen.getByLabelText(/^Longitude/) as HTMLInputElement).value).toBe(
    "-0.3255"
  )
  expect(errorIds()).toEqual([])

  fireEvent.click(nextButton())
  expect(
    screen.getByRole("heading", { name: "How do people visit?" })
  ).toBeTruthy()
})
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/wizard.validation.test.ts" "src/app/[locale]/contribute/index/_components/__tests__/IndexRecordWizard.validation.test.ts"`
Expected: FAIL: the coordinate tests get `[]`; the wizard test moves on to Visit with latitude 200.

- [ ] **Step 4: Validate coordinates**

In `wizard.validation.ts`:

1. Add the import at the top:

```ts
import { coordIsValid } from "@/lib/geocode/coordinates"
```

2. Replace the `STEPS_WITH_REQUIRED` block with:

```ts
/** Fields a step checks the format of once they're filled in. */
const FORMATTED_BY_STEP: Readonly<Record<number, readonly ("lat" | "lng")[]>> =
  {
    2: ["lat", "lng"],
  }

const STEPS_CHECKED = [
  ...new Set(
    [...Object.keys(REQUIRED_BY_STEP), ...Object.keys(FORMATTED_BY_STEP)].map(
      Number
    )
  ),
].sort((a, b) => a - b)
```

3. Replace `missingFields` with:

```ts
/**
 * The fields that stop `step` being left: required ones still empty, then
 * coordinates that aren't a number in range. Fields the contributor can't
 * fill here don't count: one shared across languages while translating, or
 * one the record already lacks, so fixing the hours never waits on a city
 * nobody has sourced.
 */
export function missingFields(
  step: number,
  form: FormData,
  scope: ValidationScope
): (keyof FormData)[] {
  const { record, editable } = scope
  const empty = requiredFields(step, !!record).filter((key) => {
    if (editable && !editable.has(key)) return false
    if (record && !META.has(key) && blank(record[key])) return false

    return blank(form[key])
  })
  const malformed = (FORMATTED_BY_STEP[step] ?? []).filter(
    (key) => (!editable || editable.has(key)) && !coordIsValid(key, form[key])
  )

  return [...empty, ...malformed]
}
```

4. In `firstIncompleteStep`, replace `STEPS_WITH_REQUIRED` with `STEPS_CHECKED`.

- [ ] **Step 5: Give `Field` a paste handler and its own error text**

In `WizardFields.tsx`, change `Field`'s signature and the two places that use the new props:

```tsx
export function Field({
  label,
  id,
  value,
  onChange,
  onPaste,
  placeholder,
  type = "text",
  required,
  hint,
  errorText = "Fill this in to continue.",
  autoComplete,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  onPaste?: React.ClipboardEventHandler<HTMLInputElement>
  placeholder?: string
  type?: string
  required?: boolean
  hint?: string
  /** What the field's error says, when the step flags it. */
  errorText?: string
  autoComplete?: string
}) {
```

Add `onPaste={onPaste}` to the `<input>` (after `onChange`), and change the error line to:

```tsx
{
  error.invalid && <FieldError id={error.id}>{errorText}</FieldError>
}
```

- [ ] **Step 6: Move step 2 into `StepLocation.tsx` with the paste and messages**

Create `apps/ui/src/app/[locale]/contribute/index/_components/StepLocation.tsx`:

```tsx
"use client"

import type React from "react"

import { formatCoord, parseCoordinatePair } from "@/lib/geocode/coordinates"

import { LocationHierarchySelector } from "./LocationHierarchySelector"
import type { StepProps } from "./wizard.types"
import { Field, SharedBlock, StepHeader, SubSection } from "./WizardFields"

// ── Step 2 — Location ─────────────────────────────────────────────────────────

export function StepLocation({ f, set, setFormData }: StepProps) {
  // "51.5297, -0.1271" pasted into either box fills both.
  const pasteCoordinates = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(e.clipboardData.getData("text"))
    if (!pair) return
    e.preventDefault()
    setFormData((prev) => ({
      ...prev,
      lat: formatCoord(pair.lat),
      lng: formatCoord(pair.lng),
    }))
  }

  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      <legend style={{ display: "contents" }}>
        <StepHeader
          n={2}
          label="Location"
          title="Where is it?"
          sub="An address and coordinates put the library on the map and in the right place in the atlas."
        />
      </legend>
      <Field
        label="Street address"
        id="streetAddress"
        value={f.streetAddress}
        onChange={set}
        autoComplete="street-address"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="City / Town"
          id="city"
          value={f.city}
          onChange={set}
          required
          autoComplete="address-level2"
        />
        <Field
          label="District / Borough"
          id="district"
          value={f.district}
          onChange={set}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Country"
          id="country"
          value={f.country}
          onChange={set}
          required
          autoComplete="country-name"
        />
        <Field
          label="Postal code"
          id="postalCode"
          value={f.postalCode}
          onChange={set}
          autoComplete="postal-code"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Latitude"
          id="lat"
          value={f.lat}
          onChange={set}
          onPaste={pasteCoordinates}
          placeholder="51.5297"
          hint="Paste “51.5297, -0.1271” from Google Maps into either box to fill both."
          errorText="Latitude is a number between -90 and 90."
        />
        <Field
          label="Longitude"
          id="lng"
          value={f.lng}
          onChange={set}
          onPaste={pasteCoordinates}
          placeholder="-0.1271"
          errorText="Longitude is a number between -180 and 180."
        />
      </div>

      <SubSection
        label="Content hierarchy"
        sub="Link this library to its place in the atlas — used for breadcrumbs and location browsing."
      />
      <SharedBlock
        fields={[
          "continentDocumentId",
          "countryDocumentId",
          "regionDocumentId",
          "areaDocumentId",
        ]}
      >
        <LocationHierarchySelector f={f} setFormData={setFormData} />
      </SharedBlock>
    </fieldset>
  )
}
```

In `WizardSteps.tsx`:

- delete the whole `// ── Step 2 — Location ──…` section (the `StepLocation` function);
- replace `import { LocationHierarchySelector } from "./LocationHierarchySelector"` with `import { StepLocation } from "./StepLocation"` (keep import order: `./ImageUploadEditor`, `./OpeningTimesEditor`, `./SocialLinksEditor`, `./StepLocation`, then the rest as they are);
- leave `STEP_COMPONENTS` as it is (it already lists `StepLocation`).

Check nothing else in `WizardSteps.tsx` still needs `LocationHierarchySelector`:

```bash
grep -n "LocationHierarchySelector" "src/app/[locale]/contribute/index/_components/WizardSteps.tsx"
```

Expected: no output.

- [ ] **Step 7: Run the wizard tests to see them pass**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components"`
Expected: PASS, including the required-markers test (step 2 still marks only `city` and `country`).

- [ ] **Step 8: Typecheck and lint the touched files**

```bash
npx tsc --noEmit -p . 2>&1 | grep -E "contribute/index/_components|lib/geocode" || echo "no type errors here"
rtk proxy npx eslint --quiet "src/app/[locale]/contribute/index/_components/" src/lib/geocode
```

Expected: "no type errors here", and eslint prints nothing.

- [ ] **Step 9: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
D="apps/ui/src/app/[locale]/contribute/index/_components"
F=("$D/StepLocation.tsx" "$D/WizardSteps.tsx" "$D/WizardFields.tsx" "$D/wizard.validation.ts" "$D/wizard.validation.test.ts" "$D/__tests__/IndexRecordWizard.validation.test.ts")
git add "${F[@]}" && git commit -m "feat(ui): check and split pasted coordinates in the Index editor

A latitude or longitude that isn't a number in range now holds the step
with its own message, and pasting \"lat, lng\" fills both boxes. Step 2
moves into its own file for the lookup that follows." -- "${F[@]}"
```

---

### Task 8: `LocationLookup` (search combobox and "Use my location")

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/index/_components/LocationLookup.tsx`
- Test: `.../_components/__tests__/LocationLookup.test.ts`

**Interfaces:**

- Consumes: `findPlaces` (Task 6); `Place` (Task 2); `Notice` (`@/components/ds`).
- Produces: `LocationLookup({ initialQuery: string; onPick: (place: Place) => void; onLocate: (lat: number, lng: number) => void })`.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/[locale]/contribute/index/_components/__tests__/LocationLookup.test.ts`:

```ts
// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Place } from "@/lib/geocode/place"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const place = (id: string, label: string, kind: string): Place => ({
  id,
  label,
  detail: "Euston Road, London, England, United Kingdom",
  kind,
  lat: 51.53,
  lng: -0.127,
  precise: true,
  address: {
    streetAddress: "96 Euston Road",
    district: "",
    city: "London",
    postalCode: "NW1 2DB",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "",
  },
})
const LIBRARY = place("W1", "British Library", "Library")
const INSTITUTE = place("N2", "The Alan Turing Institute", "Research")

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
  Response.json({ data: [LIBRARY, INSTITUTE] })
)

const { LocationLookup } = await import("../LocationLookup")

const onPick = vi.fn()
const onLocate = vi.fn()
const show = (initialQuery = "") =>
  render(createElement(LocationLookup, { initialQuery, onPick, onLocate }))
const box = () => screen.getByRole("combobox") as HTMLInputElement

function geolocation(value: unknown) {
  Object.defineProperty(navigator, "geolocation", {
    value,
    configurable: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  geolocation(undefined)
})
afterEach(cleanup)

describe("LocationLookup search", () => {
  it("waits for three characters and a pause before searching", async () => {
    show()
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: "Br" } })
    await new Promise((r) => setTimeout(r, 400))
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(box(), { target: { value: "Bri" } })
    expect(
      await screen.findByRole("option", { name: /^British Library/ })
    ).toBeTruthy()
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/geocode/search?q=Bri")
    expect(box().getAttribute("aria-expanded")).toBe("true")
  })

  it("picks a result with the arrow keys and Enter", async () => {
    show("British Library")
    fireEvent.focus(box())
    await screen.findByRole("option", { name: /^British Library/ })

    fireEvent.keyDown(box(), { key: "ArrowDown" })
    fireEvent.keyDown(box(), { key: "ArrowDown" })
    const second = screen.getByRole("option", { name: /^The Alan Turing/ })
    expect(box().getAttribute("aria-activedescendant")).toBe(second.id)

    fireEvent.keyDown(box(), { key: "Enter" })
    expect(onPick).toHaveBeenCalledWith(INSTITUTE)
    expect(box().value).toBe("The Alan Turing Institute")
    expect(screen.queryByRole("option")).toBeNull()
    expect(screen.getByText(/Filled in from OpenStreetMap/)).toBeTruthy()
  })

  it("picks a result with the mouse", async () => {
    show("British Library")
    fireEvent.focus(box())
    fireEvent.click(
      await screen.findByRole("option", { name: /^British Library/ })
    )
    expect(onPick).toHaveBeenCalledWith(LIBRARY)
  })

  it("says when nothing matches", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }))
    show("Nowhere at all")
    fireEvent.focus(box())
    expect(await screen.findByText(/No matches/)).toBeTruthy()
  })

  it("says when search is unavailable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 502 }))
    show("Haworth")
    fireEvent.focus(box())
    expect(
      await screen.findByText(/Search isn.t available right now/)
    ).toBeTruthy()
  })
})

describe("LocationLookup, Use my location", () => {
  const position = (accuracy: number) => ({
    getCurrentPosition: (ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 53.83, longitude: -1.957, accuracy } }),
  })

  it("isn't offered without geolocation", () => {
    show()
    expect(screen.queryByRole("button", { name: /Use my location/ })).toBeNull()
  })

  it("reports where the device is", async () => {
    geolocation(position(35))
    show()
    fireEvent.click(
      await screen.findByRole("button", { name: /Use my location/ })
    )
    expect(onLocate).toHaveBeenCalledWith(53.83, -1.957)
    expect(screen.getByText(/within 35 m/)).toBeTruthy()
  })

  it("warns when the position is approximate", async () => {
    geolocation(position(1200))
    show()
    fireEvent.click(
      await screen.findByRole("button", { name: /Use my location/ })
    )
    expect(screen.getByText("Your location is approximate")).toBeTruthy()
  })

  it("explains a refusal", async () => {
    geolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) =>
        fail({ code: 1 }),
    })
    show()
    fireEvent.click(
      await screen.findByRole("button", { name: /Use my location/ })
    )
    await waitFor(() =>
      expect(screen.getByText("Location access is off")).toBeTruthy()
    )
    expect(onLocate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/LocationLookup.test.ts"`
Expected: FAIL, cannot resolve `../LocationLookup`.

- [ ] **Step 3: Implement**

`apps/ui/src/app/[locale]/contribute/index/_components/LocationLookup.tsx`:

```tsx
"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { useEffect, useId, useState, useSyncExternalStore } from "react"

import { Notice } from "@/components/ds"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { findPlaces } from "@/lib/geocode/client"
import type { Place } from "@/lib/geocode/place"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "./wizard.constants"

const MIN_QUERY = 3
const DEBOUNCE_MS = 300
/** Beyond this many metres the device's position is only approximate. */
const APPROXIMATE_M = 200
/** GeolocationPositionError.PERMISSION_DENIED */
const PERMISSION_DENIED = 1

type Search = "idle" | "loading" | "done" | "error"
type GeoNote =
  | { kind: "located"; metres: number }
  | { kind: "refused" | "failed" }

// Geolocation can't change while the page is open: nothing to subscribe to.
const subscribeNever = () => () => {}
const hasGeolocation = () => !!navigator.geolocation

const LINK = { color: T.accent.primary }

function StatusLine({
  tone,
  children,
}: {
  readonly tone: "ok" | "info"
  readonly children: string
}) {
  const { color, icon } =
    tone === "ok"
      ? { color: T.accent.ok, icon: "mdi:check-circle-outline" }
      : { color: T.ink.dim, icon: "mdi:information-outline" }

  return (
    <p
      role="status"
      className="m-0 flex items-start gap-1.5 text-[14px] leading-normal"
      style={{ color }}
    >
      <Icon
        aria-hidden="true"
        icon={icon}
        width={16}
        height={16}
        className="mt-0.5 shrink-0"
      />
      <span>{children}</span>
    </p>
  )
}

function Alert({
  title,
  children,
}: {
  readonly title: string
  readonly children: string
}) {
  return (
    <div role="status">
      <Notice icon="mdi:alert-circle-outline" tone="warn" title={title}>
        <p className="m-0" style={{ color: T.ink.base }}>
          {children}
        </p>
      </Notice>
    </div>
  )
}

function GeoStatus({ note }: { readonly note: GeoNote }) {
  if (note.kind === "refused")
    return (
      <Alert title="Location access is off">
        Search or drop a pin instead.
      </Alert>
    )
  if (note.kind === "failed")
    return (
      <Alert title="Couldn’t get your location">
        Search or drop a pin instead.
      </Alert>
    )
  if (note.metres > APPROXIMATE_M)
    return (
      <Alert title="Your location is approximate">
        {`Your device puts you within ${note.metres} m. Drag the pin onto the building.`}
      </Alert>
    )

  return (
    <StatusLine tone="ok">{`Pin placed where you are, to within ${note.metres} m.`}</StatusLine>
  )
}

/**
 * Step 2's search: a combobox over OpenStreetMap places (through
 * /api/geocode/search) and a "Use my location" button.
 */
export function LocationLookup({
  initialQuery,
  onPick,
  onLocate,
}: {
  /** What the search box starts with: the library's name, in new mode. */
  readonly initialQuery: string
  /** A result was chosen. */
  readonly onPick: (place: Place) => void
  /** The device reported where it is. */
  readonly onLocate: (lat: number, lng: number) => void
}) {
  const id = useId()
  const inputId = `${id}-input`
  const listId = `${id}-list`
  const hintId = `${id}-hint`
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Place[]>([])
  const [search, setSearch] = useState<Search>("idle")
  const [active, setActive] = useState(-1)
  const [picked, setPicked] = useState(false)
  const [locating, setLocating] = useState(false)
  const [geo, setGeo] = useState<GeoNote | null>(null)
  const canLocate = useSyncExternalStore(
    subscribeNever,
    hasGeolocation,
    () => false
  )

  const q = query.trim()
  const typedEnough = q.length >= MIN_QUERY

  useEffect(() => {
    if (!open || !typedEnough) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearch("loading")
      findPlaces(q, controller.signal)
        .then((places) => {
          setResults(places)
          setActive(-1)
          setSearch("done")
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearch("error")
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, open, typedEnough])

  const showList = open && typedEnough && results.length > 0
  const noMatches =
    open && typedEnough && search === "done" && results.length === 0
  const found =
    results.length === 1 ? "1 place found" : `${results.length} places found`

  const choose = (place: Place) => {
    onPick(place)
    setQuery(place.label)
    setOpen(false)
    setActive(-1)
    setPicked(true)
  }

  const move = (step: 1 | -1) => {
    if (results.length === 0) return
    setActive((i) => {
      if (i < 0) return step === 1 ? 0 : results.length - 1

      return (i + step + results.length) % results.length
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      setOpen(true)
      move(e.key === "ArrowDown" ? 1 : -1)

      return
    }
    if (e.key === "Enter" && showList) {
      const place = results[active]
      if (place) {
        e.preventDefault()
        choose(place)
      }

      return
    }
    if (e.key === "Escape" && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  const locate = () => {
    setLocating(true)
    setGeo(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        setGeo({ kind: "located", metres: Math.round(coords.accuracy) })
        onLocate(coords.latitude, coords.longitude)
      },
      (error) => {
        setLocating(false)
        setGeo({
          kind: error.code === PERMISSION_DENIED ? "refused" : "failed",
        })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={inputId} style={fieldLabelStyle}>
        Find the library or its address
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
            height={20}
            icon="mdi:magnify"
            style={{
              color: search === "loading" ? T.accent.primary : T.ink.dim,
            }}
            width={20}
          />
          <input
            aria-activedescendant={
              showList && active >= 0 ? `${listId}-${active}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-describedby={hintId}
            aria-expanded={showList}
            autoComplete="off"
            id={inputId}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setPicked(false)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="e.g. British Library, or 96 Euston Road, London"
            role="combobox"
            spellCheck={false}
            style={{ ...fieldInputStyle, paddingLeft: "46px" }}
            type="text"
            value={query}
          />
          <ul
            aria-label="Places"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 m-0 max-h-[340px] list-none overflow-y-auto rounded-[14px] border bg-white p-1.5"
            hidden={!showList}
            id={listId}
            role="listbox"
            style={{
              borderColor: T.border.hi,
              boxShadow: "0 12px 28px rgba(23,22,43,.08)",
            }}
          >
            {results.map((place, i) => (
              <li
                key={place.id}
                aria-selected={i === active}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-[10px] px-3 py-2.5 hover:bg-(--t-bg-surface) aria-selected:bg-(--t-accent-chip)"
                id={`${listId}-${i}`}
                onClick={() => choose(place)}
                onMouseDown={(e) => e.preventDefault()}
                role="option"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {place.label}
                  </span>
                  {place.detail ? (
                    <span
                      className="text-[13.5px] leading-snug"
                      style={{ color: T.ink.dim }}
                    >
                      {place.detail}
                    </span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-semibold"
                  style={{
                    background: TYPE_TINT.neutral.bg,
                    color: TYPE_TINT.neutral.fg,
                  }}
                >
                  {place.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {canLocate ? (
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-muted-2) disabled:cursor-wait disabled:opacity-70"
            style={{
              border: `1px solid ${T.border.hi}`,
              background: T.bg.deep,
              color: T.ink.base,
              fontFamily: T.font.sans,
            }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:crosshairs-gps"
              width={18}
              height={18}
            />
            {locating ? "Finding you…" : "Use my location"}
          </button>
        ) : null}
      </div>
      <p id={hintId} style={fieldHintStyle}>
        Pick a result to fill in the address and drop the pin. Search by{" "}
        <a
          href="https://photon.komoot.io"
          target="_blank"
          rel="noopener noreferrer"
          style={LINK}
        >
          Photon
        </a>
        , map data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          style={LINK}
        >
          OpenStreetMap contributors
        </a>
        .
      </p>
      <p aria-live="polite" className="sr-only">
        {showList ? `${found}. Use the arrow keys to choose.` : ""}
      </p>
      {picked ? (
        <StatusLine tone="ok">
          Filled in from OpenStreetMap. Check the details below.
        </StatusLine>
      ) : null}
      {noMatches ? (
        <StatusLine tone="info">
          No matches. Try the street and town, or enter the address below.
        </StatusLine>
      ) : null}
      {search === "error" ? (
        <Alert title="Search isn’t available right now">
          Enter the address below.
        </Alert>
      ) : null}
      {geo ? <GeoStatus note={geo} /> : null}
    </div>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/LocationLookup.test.ts"`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `rtk proxy npx eslint --quiet "src/app/[locale]/contribute/index/_components/LocationLookup.tsx"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
D="apps/ui/src/app/[locale]/contribute/index/_components"
git add "$D/LocationLookup.tsx" "$D/__tests__/LocationLookup.test.ts"
git commit -m "feat(ui): add the Index editor's place search and Use my location" -- "$D/LocationLookup.tsx" "$D/__tests__/LocationLookup.test.ts"
```

---

### Task 9: `LocationPinMap`

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/index/_components/LocationPinMap.tsx`
- Test: `.../_components/__tests__/LocationPinMap.test.ts`

**Interfaces:**

- Consumes: `formatCoord`, `readCoord`, `isLatitude`, `isLongitude` (Task 1).
- Produces: `LocationPinMap({ lat: string; lng: string; precise: boolean; onMove: (lat: number, lng: number) => void })`.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/[locale]/contribute/index/_components/__tests__/LocationPinMap.test.ts`:

```ts
// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

// A stand-in MapLibre: records what the component asks of the map and pin,
// and lets a test fire the map's and pin's events.
const fake = vi.hoisted(() => {
  type Handler = (event?: unknown) => void
  const lngLat = (lng: number, lat: number) => ({
    lng,
    lat,
    wrap: () => ({ lng, lat }),
  })
  const state = {
    webgl: true,
    maps: [] as FakeMap[],
    markers: [] as FakeMarker[],
  }
  class FakeMap {
    handlers = new Map<string, Handler>()
    flyTo = vi.fn()
    jumpTo = vi.fn()
    addControl = vi.fn()
    resize = vi.fn()
    remove = vi.fn()
    touchZoomRotate = { disableRotation: vi.fn() }
    constructor() {
      if (!state.webgl) throw new Error("WebGL unavailable")
      state.maps.push(this)
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, handler)

      return this
    }
    fire(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload)
    }
  }
  class FakeMarker {
    handlers = new Map<string, Handler>()
    at: [number, number] | null = null
    shown = false
    constructor() {
      state.markers.push(this)
    }
    setLngLat(at: [number, number] | { lng: number; lat: number }) {
      this.at = Array.isArray(at) ? at : [at.lng, at.lat]

      return this
    }
    addTo() {
      this.shown = true

      return this
    }
    remove() {
      this.shown = false

      return this
    }
    getLngLat() {
      const [lng, lat] = this.at ?? [0, 0]

      return lngLat(lng, lat)
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, handler)

      return this
    }
  }

  return { state, lngLat, FakeMap, FakeMarker }
})

vi.mock("maplibre-gl", () => ({
  default: {
    Map: fake.FakeMap,
    Marker: fake.FakeMarker,
    NavigationControl: class {},
  },
}))

const { LocationPinMap } = await import("../LocationPinMap")

const onMove = vi.fn()
const props = (lat = "", lng = "", precise = false) => ({
  lat,
  lng,
  precise,
  onMove,
})

async function loaded() {
  await waitFor(() => expect(fake.state.maps).toHaveLength(1))
  const map = fake.state.maps[0]!
  act(() => map.fire("load"))

  return { map, marker: fake.state.markers[0]! }
}

beforeEach(() => {
  vi.clearAllMocks()
  fake.state.webgl = true
  fake.state.maps.length = 0
  fake.state.markers.length = 0
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(cleanup)

describe("LocationPinMap", () => {
  it("drops the pin where the map is clicked", async () => {
    render(createElement(LocationPinMap, props()))
    const { map, marker } = await loaded()
    act(() => map.fire("click", { lngLat: fake.lngLat(-1.9574, 53.8312) }))
    expect(onMove).toHaveBeenCalledWith(53.8312, -1.9574)
    expect(marker.shown).toBe(true)
  })

  it("reports a dragged pin", async () => {
    render(createElement(LocationPinMap, props("53.83", "-1.95")))
    const { marker } = await loaded()
    marker.setLngLat([-1.96, 53.84])
    act(() => marker.handlers.get("dragend")?.())
    expect(onMove).toHaveBeenCalledWith(53.84, -1.96)
  })

  it("follows coordinates set elsewhere: jumps first, then flies", async () => {
    const view = render(createElement(LocationPinMap, props()))
    const { map, marker } = await loaded()

    view.rerender(
      createElement(LocationPinMap, props("51.529912", "-0.127692", true))
    )
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [-0.127692, 51.529912],
      zoom: 17,
    })
    expect(marker.at).toEqual([-0.127692, 51.529912])

    view.rerender(
      createElement(LocationPinMap, props("53.8312", "-1.9485", false))
    )
    expect(map.flyTo).toHaveBeenCalledWith({
      center: [-1.9485, 53.8312],
      zoom: 14,
    })
  })

  it("doesn't fly to a pin it placed itself", async () => {
    const view = render(createElement(LocationPinMap, props("53", "-1", true)))
    const { map } = await loaded()
    act(() =>
      map.fire("click", { lngLat: fake.lngLat(-1.9574451, 53.8311966) })
    )
    view.rerender(
      createElement(LocationPinMap, props("53.831197", "-1.957445", true))
    )
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it("asks for a pin only while there are no coordinates", async () => {
    const view = render(createElement(LocationPinMap, props()))
    expect(screen.getByText(/click the map to drop a pin/)).toBeTruthy()
    view.rerender(createElement(LocationPinMap, props("53.83", "-1.95")))
    expect(screen.queryByText(/click the map to drop a pin/)).toBeNull()
  })

  it("falls back to a note without WebGL", async () => {
    fake.state.webgl = false
    render(createElement(LocationPinMap, props()))
    expect(await screen.findByText(/can’t load in this browser/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/LocationPinMap.test.ts"`
Expected: FAIL, cannot resolve `../LocationPinMap`.

- [ ] **Step 3: Implement**

`apps/ui/src/app/[locale]/contribute/index/_components/LocationPinMap.tsx`:

```tsx
"use client"

import type { Map as MapLibreMap, Marker } from "maplibre-gl"
import { useEffect, useId, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  formatCoord,
  isLatitude,
  isLongitude,
  readCoord,
} from "@/lib/geocode/coordinates"

import { fieldHintStyle } from "./wizard.constants"

// Voyager with labels: placing a pin needs street and place names.
const VOYAGER = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"

/** The form's coordinates as [lng, lat], or null unless both are valid. */
function pointOf(lat: string, lng: string): [number, number] | null {
  const y = readCoord(lat)
  const x = readCoord(lng)

  return isLatitude(y) && isLongitude(x) ? [x, y] : null
}

const keyOf = (lat: number, lng: number) =>
  `${formatCoord(lat)},${formatCoord(lng)}`

/** The pin: an indigo dot in a white ring, drawn in the DOM so it takes the tokens. */
function pinElement(): HTMLElement {
  const el = document.createElement("div")
  Object.assign(el.style, {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    background: T.accent.primary,
    border: `3px solid ${T.bg.deep}`,
    outline: `1px solid ${T.accent.primaryHover}`,
    cursor: "grab",
  })

  return el
}

/**
 * Step 2's map: shows the coordinates as a pin, and sets them when the pin
 * is dragged or the map clicked. The coordinate boxes are the keyboard way
 * to do the same.
 */
export function LocationPinMap({
  lat,
  lng,
  precise,
  onMove,
}: {
  readonly lat: string
  readonly lng: string
  /** The point is a building or an address: zoom in close. */
  readonly precise: boolean
  /** The pin was dragged, or the map clicked. */
  readonly onMove: (lat: number, lng: number) => void
}) {
  const captionId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onMoveRef = useRef(onMove)
  // The last point the map set itself, so it doesn't fly to its own pin.
  const ownPoint = useRef("")
  // The camera has shown a point: later ones fly, the first one jumps.
  const shown = useRef(false)
  const [ready, setReady] = useState(false)
  // No WebGL (old devices, some headless browsers): show a note instead.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onMoveRef.current = onMove
  })

  useEffect(() => {
    if (!containerRef.current) return
    let alive = true
    let observer: ResizeObserver | undefined

    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (!alive || !containerRef.current) return
        let map: MapLibreMap
        try {
          map = new maplibregl.Map({
            container: containerRef.current,
            style: VOYAGER,
            center: [10, 25],
            zoom: 1,
            // Scroll and one-finger drags move the page; zooming the map
            // takes Ctrl or two fingers.
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            // The Voyager style carries its own CARTO / OpenStreetMap credit.
            attributionControl: { compact: true },
          })
        } catch {
          setFailed(true)

          return
        }
        map.touchZoomRotate.disableRotation()
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-left"
        )

        const marker = new maplibregl.Marker({
          element: pinElement(),
          draggable: true,
        })
        const report = (at: { lat: number; lng: number }) => {
          ownPoint.current = keyOf(at.lat, at.lng)
          onMoveRef.current(at.lat, at.lng)
        }
        marker.on("dragend", () => report(marker.getLngLat().wrap()))
        map.on("click", (e) => {
          marker.setLngLat(e.lngLat).addTo(map)
          report(e.lngLat.wrap())
        })
        map.on("load", () => {
          if (alive) setReady(true)
        })
        mapRef.current = map
        markerRef.current = marker

        observer = new ResizeObserver(() => map.resize())
        observer.observe(containerRef.current)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })

    return () => {
      alive = false
      observer?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Follow coordinates set elsewhere: typed, pasted, searched or located.
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!ready || !map || !marker) return
    const point = pointOf(lat, lng)
    if (!point) {
      marker.remove()

      return
    }
    marker.setLngLat(point).addTo(map)
    if (keyOf(point[1], point[0]) === ownPoint.current) return
    const view = { center: point, zoom: precise ? 17 : 14 }
    if (shown.current) map.flyTo(view)
    else map.jumpTo(view)
    shown.current = true
  }, [ready, lat, lng, precise])

  const hasPoint = pointOf(lat, lng) !== null

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        className="relative h-[220px] overflow-hidden rounded-[20px] sm:h-[280px]"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
        }}
      >
        <div
          ref={containerRef}
          role="region"
          aria-label="Map for placing the library’s pin"
          aria-describedby={captionId}
          // maplibre-gl.css makes the container position: relative, so size it
          // explicitly rather than with inset-0.
          style={{ width: "100%", height: "100%" }}
        />
        {failed ? (
          <p
            className="absolute inset-0 m-0 flex items-center justify-center px-8 text-center text-[14px]"
            style={{ color: T.ink.dim }}
          >
            The map can’t load in this browser. Use the latitude and longitude
            boxes above.
          </p>
        ) : null}
        {!failed && !hasPoint ? (
          <p
            className="pointer-events-none absolute top-3 right-3 left-14 z-[1] m-0 rounded-full px-4 py-2 text-center text-[13.5px] font-semibold"
            style={{
              background: T.bg.deep,
              color: T.ink.base,
              border: `1px solid ${T.border.line}`,
            }}
          >
            Zoom in and click the map to drop a pin, or search above.
          </p>
        ) : null}
      </div>
      <figcaption id={captionId} style={fieldHintStyle}>
        Drag the pin or click the map to move it. The latitude and longitude
        boxes set it too.
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/LocationPinMap.test.ts"`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit -p . 2>&1 | grep -E "LocationPinMap" || echo "no type errors here"
rtk proxy npx eslint --quiet "src/app/[locale]/contribute/index/_components/LocationPinMap.tsx"
```

Expected: "no type errors here"; eslint prints nothing.

- [ ] **Step 6: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
D="apps/ui/src/app/[locale]/contribute/index/_components"
git add "$D/LocationPinMap.tsx" "$D/__tests__/LocationPinMap.test.ts"
git commit -m "feat(ui): add a draggable pin map for the Index editor" -- "$D/LocationPinMap.tsx" "$D/__tests__/LocationPinMap.test.ts"
```

---

### Task 10: `useLocationFill` and the assembled step 2

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/index/_components/useLocationFill.ts`
- Modify: `.../_components/StepLocation.tsx`
- Modify: `.../_components/__tests__/IndexRecordWizard.validation.test.ts` (mock MapLibre)
- Test: `.../_components/__tests__/StepLocation.test.ts`

**Interfaces:**

- Consumes: `placeNear` (Task 6), `formatCoord` (Task 1), `Place` (Task 2), `addressIsEmpty`, `applyPlace`, `locationKey`, `withAddress` (Task 5), `resolveHierarchy`, `HierarchyFill` (Task 6), `LocationLookup` (Task 8), `LocationPinMap` (Task 9), `useIsShared` (`./WizardFields`).
- Produces: `useLocationFill(f, setFormData): { pick(place); placeAt(lat, lng); takeAddress(place); offer: Place | null; hierarchyFilled: boolean; precise: boolean }`.

- [ ] **Step 1: Write the failing test**

`apps/ui/src/app/[locale]/contribute/index/_components/__tests__/StepLocation.test.ts`:

```ts
// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement, useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Place } from "@/lib/geocode/place"

import type { FormData } from "../wizard.types"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
// The map has its own tests; here a button stands in for a dropped pin.
vi.mock("../LocationPinMap", async () => {
  const { createElement: h } = await import("react")

  return {
    LocationPinMap: ({
      onMove,
    }: {
      onMove: (lat: number, lng: number) => void
    }) =>
      h(
        "button",
        { type: "button", onClick: () => onMove(53.8311966, -1.9574451) },
        "Drop pin"
      ),
  }
})

const LIBRARY: Place = {
  id: "W4680891",
  label: "British Library",
  detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
  kind: "Library",
  lat: 51.5299119,
  lng: -0.1276918,
  precise: true,
  address: {
    streetAddress: "96 Euston Road",
    district: "Somers Town",
    city: "London",
    postalCode: "NW1 2DB",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "",
  },
}
const CHURCHYARD: Place = {
  id: "W120289822",
  label: "Haworth Churchyard",
  detail:
    "Haworth and Stanbury, Bradford, West Yorkshire, England, United Kingdom",
  kind: "Cemetery",
  lat: 53.8309287,
  lng: -1.9566318,
  precise: false,
  address: {
    streetAddress: "",
    district: "Haworth and Stanbury",
    city: "Bradford",
    postalCode: "",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "West Yorkshire",
  },
}

const DATA: Record<string, unknown> = {
  "/api/geocode/search?q=British%20Library": [LIBRARY],
  "/api/geocode/reverse?lat=53.8311966&lng=-1.9574451": CHURCHYARD,
  "/api/relations/countries?iso2=GB-ENG%2CGB": [
    {
      documentId: "eng",
      name: "England",
      iso2: "GB-ENG",
      continentDocumentId: "eu",
    },
  ],
  "/api/relations/continents": [{ documentId: "eu", name: "Europe" }],
  "/api/relations/countries?continentDocumentId=eu": [
    { documentId: "eng", name: "England" },
  ],
  "/api/relations/regions?countryDocumentId=eng": [
    { documentId: "gl", name: "Greater London" },
    { documentId: "wy", name: "West Yorkshire" },
  ],
}
const fetchMock = vi.fn(async (url: string) =>
  Response.json({ data: DATA[url] ?? [] })
)

const { StepLocation } = await import("../StepLocation")
const { EMPTY_FORM } = await import("../wizard.types")
const { EditableFieldsContext } = await import("../WizardFields")
const { editableFields } = await import("../translation-mode")

const seen = vi.fn<(form: FormData) => void>()
const lastForm = () => seen.mock.lastCall?.[0]

function Harness({
  initial,
  improving = false,
}: {
  initial: FormData
  improving?: boolean
}) {
  const [f, setFormData] = useState(initial)
  useEffect(() => seen(f))

  return createElement(StepLocation, {
    f,
    setFormData,
    improving,
    set: (k: keyof FormData, v: string) =>
      setFormData((prev) => ({ ...prev, [k]: v })),
  })
}

const show = (initial: FormData, improving = false) =>
  render(createElement(Harness, { initial, improving }))
const value = (id: string) =>
  (document.getElementById(id) as HTMLInputElement).value

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("StepLocation", () => {
  it("fills the address, the pin and the atlas from a picked result", async () => {
    show(EMPTY_FORM)
    const box = screen.getByRole("combobox")
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: "British Library" } })
    fireEvent.click(
      await screen.findByRole("option", { name: /^British Library/ })
    )

    expect(value("streetAddress")).toBe("96 Euston Road")
    expect(value("city")).toBe("London")
    expect(value("district")).toBe("Somers Town")
    expect(value("postalCode")).toBe("NW1 2DB")
    expect(value("lat")).toBe("51.529912")
    expect(value("lng")).toBe("-0.127692")
    await waitFor(() =>
      expect(lastForm()).toMatchObject({
        continentDocumentId: "eu",
        countryDocumentId: "eng",
        regionDocumentId: "gl",
        country: "England",
      })
    )
    expect(screen.getByText("Set from the address. Check these.")).toBeTruthy()
  })

  it("fills an empty address from a dropped pin", async () => {
    show(EMPTY_FORM)
    fireEvent.click(screen.getByRole("button", { name: "Drop pin" }))
    expect(value("lat")).toBe("53.831197")
    expect(value("lng")).toBe("-1.957445")
    await waitFor(() => expect(value("city")).toBe("Bradford"))
    expect(value("district")).toBe("Haworth and Stanbury")
    await waitFor(() => expect(lastForm()?.regionDocumentId).toBe("wy"))
  })

  it("offers the nearest address instead of overwriting one", async () => {
    show({ ...EMPTY_FORM, city: "Haworth" })
    fireEvent.click(screen.getByRole("button", { name: "Drop pin" }))
    expect(await screen.findByText(/Nearest address to the pin/)).toBeTruthy()
    expect(value("city")).toBe("Haworth")

    // Editing the address withdraws the offer.
    fireEvent.change(document.getElementById("streetAddress")!, {
      target: { value: "Church Street" },
    })
    expect(screen.queryByText(/Nearest address to the pin/)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Drop pin" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Use this address" })
    )
    expect(value("city")).toBe("Bradford")
    expect(value("streetAddress")).toBe("Church Street")
    expect(screen.queryByText(/Nearest address to the pin/)).toBeNull()
  })

  it("starts a new library's search from its name", () => {
    show({ ...EMPTY_FORM, name: "Radlett Library" })
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe(
      "Radlett Library"
    )
  })

  it("starts empty when improving a record", () => {
    show({ ...EMPTY_FORM, name: "Radlett Library" }, true)
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("")
  })

  it("leaves out the search and the map while translating", () => {
    const editable = new Set(editableFields(true, Object.keys(EMPTY_FORM)))
    render(
      createElement(
        EditableFieldsContext.Provider,
        { value: editable },
        createElement(Harness, { initial: EMPTY_FORM })
      )
    )
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.queryByRole("button", { name: "Drop pin" })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components/__tests__/StepLocation.test.ts"`
Expected: FAIL: no combobox (StepLocation doesn't render the lookup yet).

- [ ] **Step 3: Implement the hook**

`apps/ui/src/app/[locale]/contribute/index/_components/useLocationFill.ts`:

```ts
"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { placeNear } from "@/lib/geocode/client"
import { formatCoord } from "@/lib/geocode/coordinates"
import type { Place } from "@/lib/geocode/place"

import {
  addressIsEmpty,
  applyPlace,
  locationKey,
  withAddress,
} from "./location.apply"
import { resolveHierarchy } from "./location.hierarchy"
import type { FormData } from "./wizard.types"

type HierarchyIds = Pick<
  FormData,
  | "continentDocumentId"
  | "countryDocumentId"
  | "regionDocumentId"
  | "areaDocumentId"
>

const hierarchyKey = (ids: HierarchyIds) =>
  [
    ids.continentDocumentId,
    ids.countryDocumentId,
    ids.regionDocumentId,
    ids.areaDocumentId,
  ].join("|")

export interface LocationFill {
  /** A search result was picked: fill the address, the pin and the atlas. */
  pick: (place: Place) => void
  /** The pin or the device set a point: look up the address there. */
  placeAt: (lat: number, lng: number) => void
  /** Take the offered nearest address. */
  takeAddress: (place: Place) => void
  /** The nearest address to the pin, while the location is as it was. */
  offer: Place | null
  /** The hierarchy selects still hold what a lookup set them to. */
  hierarchyFilled: boolean
  /** The point is a building or an address: the map zooms in close. */
  precise: boolean
}

/**
 * Step 2's lookups: a search pick, a dropped pin and the device's position
 * each fill the form and the atlas hierarchy. Each lookup takes a number,
 * and an answer for an older one is dropped.
 */
export function useLocationFill(
  f: FormData,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
): LocationFill {
  const latest = useRef(f)
  useEffect(() => {
    latest.current = f
  })
  const run = useRef(0)
  const [offered, setOffered] = useState<{ place: Place; at: string } | null>(
    null
  )
  const [filled, setFilled] = useState<string | null>(null)
  const [precise, setPrecise] = useState(() => !!f.streetAddress.trim())

  const fillHierarchy = useCallback(
    async (place: Place, token: number) => {
      const before = latest.current
      const fill = await resolveHierarchy(before, place.address)
      if (!fill || token !== run.current) return
      setFormData((prev) => ({ ...prev, ...fill }))
      if (hierarchyKey(fill) !== hierarchyKey(before))
        setFilled(hierarchyKey(fill))
    },
    [setFormData]
  )

  const takeAddress = useCallback(
    (place: Place) => {
      const token = ++run.current
      setFormData((prev) => withAddress(prev, place.address))
      setOffered(null)
      void fillHierarchy(place, token)
    },
    [fillHierarchy, setFormData]
  )

  const pick = useCallback(
    (place: Place) => {
      const token = ++run.current
      setFormData((prev) => applyPlace(prev, place))
      setOffered(null)
      setPrecise(place.precise)
      void fillHierarchy(place, token)
    },
    [fillHierarchy, setFormData]
  )

  const placeAt = useCallback(
    (lat: number, lng: number) => {
      const token = ++run.current
      setFormData((prev) => ({
        ...prev,
        lat: formatCoord(lat),
        lng: formatCoord(lng),
      }))
      setOffered(null)
      setPrecise(true)
      void placeNear(lat, lng).then((place) => {
        if (!place || token !== run.current) return
        if (addressIsEmpty(latest.current)) takeAddress(place)
        else setOffered({ place, at: locationKey(latest.current) })
      })
    },
    [setFormData, takeAddress]
  )

  return {
    pick,
    placeAt,
    takeAddress,
    offer: offered && offered.at === locationKey(f) ? offered.place : null,
    hierarchyFilled: filled !== null && filled === hierarchyKey(f),
    precise,
  }
}
```

- [ ] **Step 4: Assemble step 2**

Edit `StepLocation.tsx`:

1. Replace the imports with:

```tsx
"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"
import { formatCoord, parseCoordinatePair } from "@/lib/geocode/coordinates"
import type { Place } from "@/lib/geocode/place"

import { addressIsEmpty } from "./location.apply"
import { LocationHierarchySelector } from "./LocationHierarchySelector"
import { LocationLookup } from "./LocationLookup"
import { LocationPinMap } from "./LocationPinMap"
import { useLocationFill } from "./useLocationFill"
import type { StepProps } from "./wizard.types"
import {
  Field,
  SharedBlock,
  StepHeader,
  SubSection,
  useIsShared,
} from "./WizardFields"
```

2. Add these two components above `StepLocation`:

```tsx
/** The address found under a dropped pin, when the form already has one. */
function NearestAddress({
  place,
  onUse,
}: {
  readonly place: Place
  readonly onUse: () => void
}) {
  const { streetAddress, city } = place.address
  const where = [streetAddress, city].filter(Boolean).join(", ") || place.label

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3"
      style={{ background: T.accent.chip }}
    >
      <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
        <span className="font-semibold">Nearest address to the pin:</span>{" "}
        {where}
      </p>
      <button
        type="button"
        onClick={onUse}
        className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white hover:bg-(--t-accent-primary-hover)"
      >
        Use this address
      </button>
    </div>
  )
}

function HierarchyNote() {
  return (
    <p
      role="status"
      className="m-0 flex items-center gap-1.5 text-[14px]"
      style={{ color: T.accent.ok }}
    >
      <Icon
        aria-hidden="true"
        icon="mdi:check-circle-outline"
        width={16}
        height={16}
      />
      Set from the address. Check these.
    </p>
  )
}
```

3. Replace the start of `StepLocation` (signature down to the `return`) with:

```tsx
export function StepLocation({ f, set, setFormData, improving }: StepProps) {
  // Translation mode: the coordinates are shared, and Photon answers in English.
  const translating = useIsShared("lat")
  const fill = useLocationFill(f, setFormData)
  const { offer } = fill
  // A new library's search starts from the name given on step 1.
  const [startQuery] = useState(() =>
    !improving && addressIsEmpty(f) && !f.lat.trim() ? f.name : ""
  )

  // "51.5297, -0.1271" pasted into either box fills both.
  const pasteCoordinates = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(e.clipboardData.getData("text"))
    if (!pair) return
    e.preventDefault()
    setFormData((prev) => ({
      ...prev,
      lat: formatCoord(pair.lat),
      lng: formatCoord(pair.lng),
    }))
  }
```

4. In the JSX: change the `StepHeader` `sub` to `"Search for the library or its address and the rest fills in, pin included. You can always type it yourself."`; add the lookup right after `</legend>`:

```tsx
{
  translating ? null : (
    <LocationLookup
      initialQuery={startQuery}
      onPick={fill.pick}
      onLocate={fill.placeAt}
    />
  )
}
```

add the map and the offer right after the latitude/longitude grid's closing `</div>`:

```tsx
{
  translating ? null : (
    <LocationPinMap
      lat={f.lat}
      lng={f.lng}
      precise={fill.precise}
      onMove={fill.placeAt}
    />
  )
}
{
  offer ? (
    <NearestAddress place={offer} onUse={() => fill.takeAddress(offer)} />
  ) : null
}
```

and the note between `<SubSection … />` and `<SharedBlock …>`:

```tsx
{
  fill.hierarchyFilled ? <HierarchyNote /> : null
}
```

- [ ] **Step 5: Keep the wizard tests off the real map**

In `.../_components/__tests__/IndexRecordWizard.validation.test.ts`, below the `@iconify/react` mock, add:

```ts
// No WebGL here: the Location step's map shows its fallback note.
vi.mock("maplibre-gl", () => ({
  default: {
    Map: class {
      constructor() {
        throw new Error("WebGL unavailable")
      }
    },
  },
}))
```

- [ ] **Step 6: Run the step and wizard tests**

Run: `npx vitest run "src/app/[locale]/contribute/index/_components"`
Expected: PASS for every file, including `StepLocation.test.ts`, the required-markers test and the coordinate test from Task 7.

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc --noEmit -p . 2>&1 | grep -E "contribute/index/_components|lib/geocode|api/geocode|api/relations" || echo "no type errors here"
rtk proxy npx eslint --quiet "src/app/[locale]/contribute/index/_components/" src/lib/geocode src/app/api/geocode "src/app/api/relations"
```

Expected: "no type errors here"; eslint prints nothing.

- [ ] **Step 8: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
D="apps/ui/src/app/[locale]/contribute/index/_components"
F=("$D/useLocationFill.ts" "$D/StepLocation.tsx" "$D/__tests__/StepLocation.test.ts" "$D/__tests__/IndexRecordWizard.validation.test.ts")
git add "${F[@]}" && git commit -m "feat(ui): look up a library's location in the Index editor

Step 2 searches OpenStreetMap places, drops a draggable pin, uses the
device's position, and fills the address, coordinates and atlas
hierarchy. A reverse lookup never overwrites an address: it offers it.
Every field stays editable." -- "${F[@]}"
```

---

### Task 11: End-to-end test

**Files:**

- Create: `qa/tests/playwright/e2e/access/location-lookup.spec.ts`

**Interfaces:**

- Consumes: `pageAs`, `signedInApi` (`qa/tests/playwright/helpers/access-fixtures.ts`), `NAVIGATION` (`helpers/ui-flows.ts`), the local seed (`pnpm seed:access`), local Strapi with England (`GB-ENG`) published.

- [ ] **Step 1: Write the spec**

`qa/tests/playwright/e2e/access/location-lookup.spec.ts`:

```ts
import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  test,
} from "@playwright/test"

import { pageAs, signedInApi } from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`. The
// geocoder is stubbed with page.route, so Photon is never called; the atlas
// lookups are real and need England (GB-ENG) in the local Strapi.

const BRITISH_LIBRARY = {
  id: "W4680891",
  label: "British Library",
  detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
  kind: "Library",
  lat: 51.5299119,
  lng: -0.1276918,
  precise: true,
  address: {
    streetAddress: "96 Euston Road",
    district: "Somers Town",
    city: "London",
    postalCode: "NW1 2DB",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "",
  },
}

test.describe.configure({ mode: "serial", timeout: 120_000 })

let contributor: APIRequestContext

test.beforeAll(async ({ playwright }, testInfo) => {
  contributor = await signedInApi(
    playwright.request,
    testInfo.project.use.baseURL!,
    "contributor"
  )
})

test.afterAll(async () => {
  await contributor?.dispose()
})

/** A new-library wizard on its Location step, with the geocoder stubbed. */
async function locationStep(browser: Browser, baseURL: string): Promise<Page> {
  const page = await pageAs(browser, contributor, baseURL)
  await page.route("**/api/geocode/search?**", (route) =>
    route.fulfill({ json: { data: [BRITISH_LIBRARY] } })
  )
  await page.goto("/contribute/index/new?name=British%20Library", NAVIGATION)
  const lookup = page.getByRole("combobox", {
    name: "Find the library or its address",
  })
  // A click before hydration does nothing, so retry until the step shows.
  // Identity's required type and status come first: Next holds the step.
  await expect(async () => {
    if (await lookup.isVisible()) return
    for (const [trigger, option] of [
      ["#libraryType", "Public"],
      ["#operationalStatus", "Open"],
    ] as const) {
      await page.locator(trigger).click({ timeout: 5000 })
      await page
        .getByRole("option", { name: option, exact: true })
        .click({ timeout: 5000 })
    }
    await page
      .getByRole("button", { name: /^Next: Location/ })
      .click({ timeout: 5000 })
    await expect(lookup).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })

  return page
}

test("a picked result fills the address, the coordinates and the atlas", async ({
  browser,
  baseURL,
}) => {
  const page = await locationStep(browser, baseURL!)
  const lookup = page.getByRole("combobox", {
    name: "Find the library or its address",
  })
  await expect(lookup).toHaveValue("British Library")
  await lookup.focus()
  await page.getByRole("option", { name: /^British Library/ }).click()

  await expect(page.locator("#streetAddress")).toHaveValue("96 Euston Road")
  await expect(page.locator("#city")).toHaveValue("London")
  await expect(page.locator("#postalCode")).toHaveValue("NW1 2DB")
  await expect(page.locator("#lat")).toHaveValue("51.529912")
  await expect(page.locator("#lng")).toHaveValue("-0.127692")
  await expect(page.locator("#hier-country option:checked")).toHaveText(
    "England",
    NAVIGATION
  )
  await expect(page.locator("#country")).toHaveValue("England")
  await expect(
    page.getByText("Set from the address. Check these.")
  ).toBeVisible()
  await page.context().close()
})

test("pasting a coordinate pair fills both boxes; a bad latitude holds the step", async ({
  browser,
  baseURL,
}) => {
  const page = await locationStep(browser, baseURL!)
  await page.locator("#lat").evaluate((el, text) => {
    const data = new DataTransfer()
    data.setData("text/plain", text)
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    )
  }, "51.7031, -0.3255")
  await expect(page.locator("#lat")).toHaveValue("51.7031")
  await expect(page.locator("#lng")).toHaveValue("-0.3255")

  await page.locator("#lat").fill("200")
  await page.locator("#city").fill("Radlett")
  await page.locator("#country").fill("England")
  await page.getByRole("button", { name: /^Next:/ }).click()
  await expect(
    page.getByText("Latitude is a number between -90 and 90.")
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Where is it?" })
  ).toBeVisible()
  await page.context().close()
})
```

- [ ] **Step 2: Run it (local UI and Strapi running, fixtures seeded)**

```bash
cd /Users/alexbennett/Development/personal/libraries.global/qa/tests/playwright
npx playwright test --project=access e2e/access/location-lookup.spec.ts
```

Expected: 2 passed. If the stack isn't running, start it first (`pnpm dev` at the repo root, Strapi on :1337, UI on :3000) and run `pnpm seed:access` if the fixtures are missing.

- [ ] **Step 3: Commit**

```bash
cd /Users/alexbennett/Development/personal/libraries.global
git add qa/tests/playwright/e2e/access/location-lookup.spec.ts
git commit -m "test(playwright): cover the Index editor's location lookup" -- qa/tests/playwright/e2e/access/location-lookup.spec.ts
```

---

### Task 12: Whole-suite check and a look in the browser

**Files:** none new.

- [ ] **Step 1: Run the UI unit suite**

Run (from `apps/ui`): `npx vitest run`
Expected: every file passes. If a failure is in a file this plan didn't touch, run `git stash list` and `git diff --stat` to confirm it comes from other uncommitted work, note it in the hand-off, and don't fix it here.

- [ ] **Step 2: Typecheck the UI**

Run: `npx tsc --noEmit -p .`
Expected: no errors in `lib/geocode`, `api/geocode`, `api/relations`, or `contribute/index/_components`. Report any others as pre-existing.

- [ ] **Step 3: Look at it in the browser**

With the local stack running, sign in as the contributor fixture, open `/contribute/index/new?name=British%20Library`, fill Identity, go to Location and check:

- the search shows real Photon results; picking "British Library" fills the fields, drops the pin at Euston Road and sets Europe / England / Greater London;
- dragging the pin a street away changes lat/lng without a fly-back, and shows "Nearest address to the pin" because the address is filled;
- clearing the address fields and clicking the map fills them from the nearest place;
- "Use my location" asks for permission and places the pin;
- at a 375 px wide window the search, button and map stack without horizontal scroll, and the page still scrolls over the map with one finger (two-finger notice shows).

- [ ] **Step 4: Hand-off notes**

Tell the user:

- `PHOTON_URL` is optional and documented in `apps/ui/src/lib/geocode/photon.ts`; `.env.local.example` was left alone because another session has uncommitted edits in it.
- The privacy policy may want a line naming Photon (komoot) as the geocoding provider; the legal pages are final copy, so that's their decision.
- The Strapi admin location picker still uses Nominatim.
