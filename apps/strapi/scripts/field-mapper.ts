/**
 * Maps a LibraryOn v4 API record to a libraries.global LibraryCreateData object.
 */

import type { LibraryCreateData } from "./strapi-client"

// ── Operator type mapping ─────────────────────────────────────────────────────

const OPERATOR_MAP: Record<string, string> = {
  "local authority run": "Municipality",
  "local authority": "Municipality",
  council: "Municipality",
  university: "University",
  "academic institution": "University",
  college: "University",
  volunteer: "Volunteer Managed",
  "volunteer managed": "Volunteer Managed",
  community: "Community Managed",
  "community managed": "Community Managed",
  "community run": "Community Managed",
  independent: "Independent",
  national: "National Government",
  "national government": "National Government",
  "central government": "National Government",
  private: "Private Foundation",
  "private foundation": "Private Foundation",
  trust: "Private Foundation",
  charity: "Private Foundation",
  religious: "Religious Institution",
  church: "Religious Institution",
  "regional government": "Regional Government",
}

function mapOperatorType(facilityOperated: string | null | undefined): string {
  if (!facilityOperated) return "Other"
  const key = facilityOperated.toLowerCase().trim()
  for (const [pattern, mapped] of Object.entries(OPERATOR_MAP)) {
    if (key.includes(pattern)) return mapped
  }

  return "Other"
}

// ── Library type inference ────────────────────────────────────────────────────

function inferLibraryType(
  name: string,
  facilityOperated: string | null | undefined,
  isMobile: boolean | null
): string {
  const n = name.toLowerCase()
  const op = (facilityOperated ?? "").toLowerCase()

  if (isMobile) return "Mobile"
  if (
    n.includes("university") ||
    n.includes("college") ||
    op.includes("university") ||
    op.includes("academic")
  )
    return "University"
  if (n.includes("national library") || n.includes("national archive"))
    return "National"
  if (n.includes("archive") || n.includes("record office")) return "Archive"
  if (
    n.includes("cathedral") ||
    n.includes("monastery") ||
    n.includes("abbey") ||
    op.includes("religious") ||
    op.includes("church")
  )
    return "Monastic"
  if (n.includes("parliamentary") || n.includes("parliament"))
    return "Parliamentary"
  if (
    n.includes("special") ||
    n.includes("medical") ||
    n.includes("law library") ||
    n.includes("business library")
  )
    return "Special"

  return "Public"
}

// ── Operational status mapping ────────────────────────────────────────────────

function mapStatus(
  isOpen: boolean,
  permanentlyClosed: boolean | null,
  tempClosedUntil: string | null
): string {
  if (permanentlyClosed) return "permanently_closed"
  if (tempClosedUntil) return "temporarily_closed"
  if (!isOpen) return "temporarily_closed"

  return "open"
}

// ── Timezone by country ───────────────────────────────────────────────────────

const COUNTRY_TIMEZONE: Record<string, string> = {
  england: "Europe/London",
  scotland: "Europe/London",
  wales: "Europe/London",
  "northern-ireland": "Europe/London",
  "republic-of-ireland": "Europe/Dublin",
}

// ── Nation/region parsing from LibraryOn ref ──────────────────────────────────

// LibraryOn ref format: {cc}:{nation}:{region-slug}:{library-slug}
// e.g. gb:eng:cambridgeshire:cherry-hinton-library
// e.g. ie:cork:cork-city-library

export function parseNationFromRef(
  ref: string
): { countrySlug: string; countryName: string } | null {
  const parts = ref.split(":")
  if (parts[0] === "gb") {
    switch (parts[1]) {
      case "eng":
        return { countrySlug: "england", countryName: "England" }
      case "sct":
        return { countrySlug: "scotland", countryName: "Scotland" }
      case "wls":
        return { countrySlug: "wales", countryName: "Wales" }
      case "nir":
        return {
          countrySlug: "northern-ireland",
          countryName: "Northern Ireland",
        }
    }
  }
  if (parts[0] === "ie")
    return {
      countrySlug: "republic-of-ireland",
      countryName: "Republic of Ireland",
    }

  return null
}

// Returns the region slug segment from the ref (3rd segment for GB, 2nd for IE)
export function parseRegionSlugFromRef(ref: string): string | null {
  const parts = ref.split(":")
  if (parts[0] === "gb" && parts.length >= 4) return parts[2] ?? null
  if (parts[0] === "ie" && parts.length >= 3) return parts[1] ?? null

  return null
}

// Returns the library slug from the last ref segment
export function parseLibrarySlugFromRef(ref: string): string | null {
  const parts = ref.split(":")

  return parts.at(-1) ?? null
}

function titleCase(s: string): string {
  return s.replaceAll("-", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase())
}

// ── Location extraction ───────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

interface LibraryOnCoords {
  lat: number | null
  lng: number | null
  city: string | null
  postalCode: string | null
  districtName: string | null // "Greater London", "Cambridgeshire" — from district.* context
  districtSlug: string | null // slugified districtName
}

function extractLocation(
  location: Record<string, unknown> | null | undefined
): LibraryOnCoords {
  const result: LibraryOnCoords = {
    lat: null,
    lng: null,
    city: null,
    postalCode: null,
    districtName: null,
    districtSlug: null,
  }
  if (!location) return result

  const geo = location.geometry as { coordinates?: number[] } | null
  if (geo?.coordinates && geo.coordinates.length >= 2) {
    result.lng = geo.coordinates[0]
    result.lat = geo.coordinates[1]
  }

  const context =
    (location.context as {
      id?: string
      text?: string
      short_code?: string
    }[]) ?? []
  for (const c of context) {
    const id = c.id ?? ""
    if (id.startsWith("postcode.")) result.postalCode = c.text ?? null
    if (id.startsWith("place.") || id.startsWith("locality."))
      result.city = c.text ?? null
    if (id.startsWith("district.") && c.text) {
      result.districtName = c.text
      result.districtSlug = slugify(c.text)
    }
  }

  return result
}

// ── Opening times mapping ─────────────────────────────────────────────────────

// LibraryOn format: { monday: { timeFrames: [{ type, startTime, endTime }] }, ... }
// Our format:       { version: 1, days: [{ day, enabled, timeframes: [{ id, startTime, endTime, staffing }] }] }

type StaffingType = "staffed" | "volunteer" | "self_service"

const STAFFING_MAP: Record<string, StaffingType> = {
  Staffed: "staffed",
  "Self-service": "self_service",
  Volunteer: "volunteer",
}

const DAYS_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

function snapTo15Min(time: string): string {
  const [h, m] = time.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return "09:00"
  const snapped = Math.round(m / 15) * 15
  if (snapped === 60) return `${String(h + 1).padStart(2, "0")}:00`

  return `${String(h).padStart(2, "0")}:${String(snapped).padStart(2, "0")}`
}

let _tfIdCounter = 0
function makeTfId(): string {
  _tfIdCounter++

  return `tf-${Date.now()}-${_tfIdCounter}`
}

function mapOpeningTimes(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!raw) return null

  const days = DAYS_ORDER.map((dayKey) => {
    const dayData = raw[dayKey] as {
      timeFrames?: { type?: string; startTime?: string; endTime?: string }[]
    } | null
    const rawFrames = dayData?.timeFrames ?? []

    const timeframes = rawFrames
      .filter((tf) => tf.startTime && tf.endTime)
      .map((tf) => ({
        id: makeTfId(),
        startTime: snapTo15Min(tf.startTime!),
        endTime: snapTo15Min(tf.endTime!),
        staffing: (STAFFING_MAP[tf.type ?? ""] ?? "staffed") as StaffingType,
      }))
      .filter((tf) => tf.startTime < tf.endTime)

    return {
      day: dayKey,
      enabled: timeframes.length > 0,
      timeframes,
    }
  })

  if (!days.some((d) => d.enabled)) return null

  return { version: 1, days }
}

// ── Accessibility mapping ─────────────────────────────────────────────────────

const ACCESSIBILITY_MAP: Record<string, string> = {
  "wheelchair-access": "Wheelchair Access",
  "accessible-parking": "Accessible Parking",
  "accessible-restrooms": "Accessible Toilets",
  "hearing-loop": "Hearing Loop",
  "braille-materials": "Braille Materials",
  "large-print": "Large Print Materials",
  "assisted-technology": "Assistive Technology",
}

// ── Main mapper ───────────────────────────────────────────────────────────────

export interface LibraryOnRecord {
  id: number
  attributes: {
    name: string
    slug: string
    ref: string
    libraryID?: string
    phone?: string | null
    email?: string | null
    website?: string | null
    streetAddress?: string | null
    facilityOperated?: string | null
    isOpen: boolean
    permanentlyClosed?: boolean | null
    tempClosedUntil?: string | null
    isMobileLibrary?: boolean | null
    accessibility?: string[] | null
    location?: Record<string, unknown> | null
    openingTimes?: Record<string, unknown> | null
    yearOpen?: number | null
    yearClosed?: number | null
    catalogue?: string | null
    joinOnline?: string | null
    virtualTourUrl?: string | null
    virtualTourEmbed?: string | null
    notes?: string | null
  }
}

export interface MappedLibrary {
  data: LibraryCreateData
  meta: {
    libraryOnId: number
    libraryOnRef: string
    countrySlug: string | null
    countryName: string | null
    regionSlug: string | null // county/metropolitan area level (e.g. "greater-london")
    regionName: string | null
    areaSlug: string | null // borough/district level — only set when below region (e.g. "wandsworth")
    areaName: string | null
    librarySlug: string | null
    accessibilityLabels: string[]
  }
}

export function mapLibraryOnRecord(record: LibraryOnRecord): MappedLibrary {
  const a = record.attributes
  const loc = extractLocation(a.location ?? null)
  const nation = parseNationFromRef(a.ref)
  const librarySlug = parseLibrarySlugFromRef(a.ref)
  const refSegmentSlug = parseRegionSlugFromRef(a.ref)

  // Determine Region vs Area:
  //   - If the district context slug matches the ref segment, the ref segment IS the region
  //   - If they differ, the district context is the region and the ref segment is the area
  //     (e.g., district="Greater London", refSegment="wandsworth" → region=greater-london, area=wandsworth)
  let regionSlug: string | null
  let regionName: string | null
  let areaSlug: string | null = null
  let areaName: string | null = null

  if (
    loc.districtSlug &&
    refSegmentSlug &&
    loc.districtSlug !== refSegmentSlug
  ) {
    regionSlug = loc.districtSlug
    regionName = loc.districtName
    areaSlug = refSegmentSlug
    areaName = titleCase(refSegmentSlug)
  } else {
    regionSlug = refSegmentSlug ?? loc.districtSlug
    regionName = regionSlug ? titleCase(regionSlug) : loc.districtName
  }

  const operatorType = mapOperatorType(a.facilityOperated)
  const libraryType = inferLibraryType(
    a.name,
    a.facilityOperated,
    a.isMobileLibrary ?? null
  )
  const operationalStatus = mapStatus(
    a.isOpen,
    a.permanentlyClosed ?? null,
    a.tempClosedUntil ?? null
  )

  const accessibilityLabels = (a.accessibility ?? [])
    .map((key) => ACCESSIBILITY_MAP[key])
    .filter(Boolean) as string[]

  const data: LibraryCreateData = {
    name: a.name,
    libraryType,
    operationalStatus,
    operatorType,
    source: "libraryon",
    sourceUrl: "https://libraryon.org",
  }

  // Timezone from country
  if (nation?.countrySlug) {
    const tz = COUNTRY_TIMEZONE[nation.countrySlug]
    if (tz) data.timezone = tz
  }

  // Slug from LibraryOn ref — last segment, already in slug format
  if (librarySlug) data.slug = librarySlug

  // Opening times
  const openingTimes = mapOpeningTimes(a.openingTimes)
  if (openingTimes) data.openingTimes = openingTimes

  if (a.phone) data.phone = a.phone
  if (a.email) data.email = a.email
  if (a.website) data.website = a.website
  if (a.streetAddress) data.streetAddress = a.streetAddress
  if (loc.city) data.city = loc.city
  if (loc.postalCode) data.postalCode = loc.postalCode
  if (loc.lat !== null && loc.lng !== null)
    data.location = { lat: loc.lat, lng: loc.lng }
  if (a.yearOpen) data.openedYear = String(a.yearOpen)
  if (a.yearClosed) data.closedYear = String(a.yearClosed)
  if (a.catalogue) data.catalogueUrl = a.catalogue
  if (a.joinOnline) data.membershipUrl = a.joinOnline
  if (a.virtualTourUrl) data.virtualTourUrl = a.virtualTourUrl
  if (a.virtualTourEmbed) data.virtualTourEmbed = a.virtualTourEmbed
  if (a.notes) data.summary = a.notes.slice(0, 500)

  return {
    data,
    meta: {
      libraryOnId: record.id,
      libraryOnRef: a.ref,
      countrySlug: nation?.countrySlug ?? null,
      countryName: nation?.countryName ?? null,
      regionSlug,
      regionName,
      areaSlug,
      areaName,
      librarySlug,
      accessibilityLabels,
    },
  }
}
