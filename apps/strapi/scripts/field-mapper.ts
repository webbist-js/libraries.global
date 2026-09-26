/**
 * Maps a LibraryOn v4 API record to a libraries.global LibraryCreateData object.
 */

import type { LibraryCreateData } from "./strapi-client"

// ── Operator type + operational status ────────────────────────────────────────

// libraryOn's facilityOperated mixes operator and status. "Facility Not Open"
// is used as a catch-all for libraries whose operator hasn't been classified
// (many are open and have hours), so it maps to an unknown operator rather
// than a closure.
const OPERATOR_MAP: Record<string, string> = {
  "Local Authority Run": "Municipality",
  "Local Authority Run Unstaffed": "Municipality",
  Commissioned: "Municipality",
  "Community Run": "Community Managed",
  "Independent Community": "Community Managed",
}

function mapOperatorType(facilityOperated: string | null | undefined): string {
  return OPERATOR_MAP[facilityOperated ?? ""] ?? "Other"
}

function mapStatus(
  facilityOperated: string | null | undefined,
  permanentlyClosed: boolean | null | undefined,
  tempClosedUntil: string | null | undefined,
  hasHours: boolean
): string {
  if (permanentlyClosed || facilityOperated === "Closed")
    return "permanently_closed"
  if (tempClosedUntil || facilityOperated === "Temporary Closure")
    return "temporarily_closed"
  if (facilityOperated === "Facility Not Open")
    return hasHours ? "open" : "unknown"

  return "open"
}

// ── Library type inference ────────────────────────────────────────────────────

function inferLibraryType(name: string, isMobile: boolean | null): string {
  const n = name.toLowerCase()

  if (isMobile || n.includes("mobile library")) return "Mobile"
  if (n.includes("university") || n.includes("college")) return "University"
  if (n.includes("archive") || n.includes("record office")) return "Archive"

  return "Public"
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

// LibraryOn ref format: {cc}:{nation}:{authority-slug}:{library-slug}
// e.g. gb:eng:cambridgeshire:cherry-hinton-library

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

// Returns the authority slug segment from the ref (3rd segment for GB, 2nd for IE)
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
  return s
    .replaceAll("-", " ")
    .replaceAll(/\b\w/g, (c) => c.toUpperCase())
    .replaceAll(/\b(And|Of|The|Upon|On)\b/g, (w) => w.toLowerCase())
}

// London libraries sit under the greater-london region, with the borough
// (libraryOn authority) as an area.
const LONDON_BOROUGHS = new Set([
  "barking-and-dagenham",
  "barnet",
  "bexley",
  "brent",
  "bromley",
  "camden",
  "city-of-london",
  "croydon",
  "ealing",
  "enfield",
  "greenwich",
  "hackney",
  "hammersmith-and-fulham",
  "haringey",
  "harrow",
  "havering",
  "hillingdon",
  "hounslow",
  "islington",
  "kensington-and-chelsea",
  "kingston-upon-thames",
  "lambeth",
  "lewisham",
  "merton",
  "newham",
  "redbridge",
  "richmond-upon-thames",
  "southwark",
  "sutton",
  "tower-hamlets",
  "waltham-forest",
  "wandsworth",
  "westminster",
])

// ── Location extraction ───────────────────────────────────────────────────────

interface LibraryOnCoords {
  lat: number | null
  lng: number | null
  city: string | null
  postalCode: string | null
}

function extractLocation(
  location: Record<string, unknown> | null | undefined
): LibraryOnCoords {
  const result: LibraryOnCoords = {
    lat: null,
    lng: null,
    city: null,
    postalCode: null,
  }
  if (!location) return result

  // Mapbox geocoder feature: geometry.coordinates and center are both [lng, lat]
  const geo = location.geometry as { coordinates?: number[] } | null
  const coords = geo?.coordinates ?? (location.center as number[] | undefined)
  if (coords && coords.length >= 2) {
    result.lng = coords[0]
    result.lat = coords[1]
  }

  const context =
    (location.context as { id?: string; text?: string }[] | undefined) ?? []
  for (const c of context) {
    const id = c.id ?? ""
    if (id.startsWith("postcode.")) result.postalCode = c.text ?? null
    if (id.startsWith("place.") || id.startsWith("locality."))
      result.city = c.text ?? null
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

// global::opening-times only accepts times on 15-minute steps
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

// ── Taxonomies ────────────────────────────────────────────────────────────────

// Canonical entries the import expects to exist in Strapi. Entries that are
// missing are created (and published) by the importer before libraries are
// written. `from` lists the libraryOn values that map onto the entry.
export interface TaxonomyEntry {
  name: string
  category: string
  summary: string
  from: string[]
}

export const ACCESSIBILITY_TAXONOMY: TaxonomyEntry[] = [
  {
    name: "Step-free access",
    category: "Mobility",
    summary: "Entry and movement through the library without steps.",
    from: ["step-free-access"],
  },
  {
    name: "Wheelchair access",
    category: "Mobility",
    summary:
      "The building and its main spaces can be used by wheelchair users.",
    from: ["wheelchair-access"],
  },
  {
    name: "Lift access",
    category: "Mobility",
    summary: "A lift serves the public floors.",
    from: ["lift-access"],
  },
  {
    name: "Accessible parking",
    category: "Mobility",
    summary: "Blue Badge or accessible parking bays close to the entrance.",
    from: ["accessible-parking"],
  },
  {
    name: "Accessible toilets",
    category: "Facilities",
    summary: "At least one accessible toilet is available to visitors.",
    from: ["accessible-restrooms"],
  },
  {
    name: "Automatic doors",
    category: "Mobility",
    summary: "Powered doors at the main entrance.",
    from: ["automatic-doors"],
  },
  {
    name: "Adjustable seating",
    category: "Facilities",
    summary: "Seating and desks that can be adjusted for different needs.",
    from: ["adjustable-seating"],
  },
  {
    name: "Hearing loop",
    category: "Sensory",
    summary: "An induction loop is available for hearing aid users.",
    from: ["hearing-loop-system"],
  },
  {
    name: "Braille signage",
    category: "Sensory",
    summary: "Key signs include Braille.",
    from: ["braille-signage"],
  },
  {
    name: "Accessible public transport",
    category: "Mobility",
    summary: "Accessible bus or rail connections close to the library.",
    from: ["accessible-public-transport-connections"],
  },
  {
    name: "Assistive technology",
    category: "Sensory",
    summary:
      "Screen readers, magnifiers or other assistive technology are available.",
    from: ["assistive-technology-available"],
  },
  {
    name: "Baby changing facilities",
    category: "Facilities",
    summary: "Baby changing facilities are available to visitors.",
    from: ["baby-changing-facilities"],
  },
  {
    name: "DDA-compliant",
    category: "Other",
    summary: "The building meets UK disability access requirements.",
    from: ["dda-compliant"],
  },
  {
    name: "Low vision support",
    category: "Sensory",
    summary:
      "Large print, magnifiers or other support for visitors with low vision.",
    from: ["low-vision-support"],
  },
  {
    name: "Neurodivergent-friendly spaces",
    category: "Cognitive",
    summary: "Spaces designed with neurodivergent visitors in mind.",
    from: ["neurodivergent-spaces"],
  },
  {
    name: "Quiet room",
    category: "Cognitive",
    summary: "A quiet room or low-stimulus space is available.",
    from: ["quiet-room"],
  },
  {
    name: "Sensory-friendly environment",
    category: "Cognitive",
    summary: "Lighting, sound and layout chosen to reduce sensory overload.",
    from: ["sensory-friendly-environment"],
  },
  {
    name: "Assistance dogs welcome",
    category: "Other",
    summary: "Guide dogs and other assistance dogs are welcome.",
    from: ["service-dog-friendly", "guide-dog-friendly"],
  },
  {
    name: "Sign language interpretation",
    category: "Communication",
    summary: "Sign language interpretation can be arranged.",
    from: ["sign-language-interpretation"],
  },
  {
    name: "Staff support",
    category: "Staff Support",
    summary: "Staff are available to help visitors with access needs.",
    from: ["staff-support"],
  },
  {
    name: "Tactile flooring",
    category: "Sensory",
    summary: "Tactile paving or flooring guides visitors through the building.",
    from: ["tactile-flooring"],
  },
  {
    name: "Visual alarms",
    category: "Sensory",
    summary: "Fire alarms include visual signals.",
    from: ["visual-alarms"],
  },
]

export const AMENITY_TAXONOMY: TaxonomyEntry[] = [
  {
    name: "Wi-Fi",
    category: "Technology",
    summary: "Free or public Wi-Fi is available for visitors.",
    from: ["Free Wi-Fi"],
  },
  {
    name: "Public computers",
    category: "Technology",
    summary: "Computers are available for public use.",
    from: ["Computers"],
  },
  {
    name: "Printing",
    category: "Technology",
    summary: "Printing is available to visitors.",
    from: ["Printing"],
  },
  {
    name: "Photocopying",
    category: "Technology",
    summary: "Photocopiers are available to visitors.",
    from: ["Photocopiers"],
  },
  {
    name: "Scanning",
    category: "Technology",
    summary: "Document scanning is available to visitors.",
    from: ["Scanning"],
  },
  {
    name: "Fax",
    category: "Technology",
    summary: "A fax service is available.",
    from: ["Faxing"],
  },
  {
    name: "Bookable spaces",
    category: "Workspace",
    summary: "Rooms or spaces can be booked for meetings and events.",
    from: ["Bookable space"],
  },
  {
    name: "Garden",
    category: "Comfort",
    summary: "An outdoor garden or green space is open to visitors.",
    from: ["Garden"],
  },
]

export const SERVICE_TAXONOMY: TaxonomyEntry[] = [
  {
    name: "Book lending",
    category: "Access",
    summary: "Borrow books for free with a library card.",
    from: ["Books"],
  },
  {
    name: "Home library service",
    category: "Access",
    summary: "Books delivered to people who can't get to the library.",
    from: ["Books delivered"],
  },
  {
    name: "Digital lending",
    category: "Digital",
    summary: "Borrow eBooks, eAudiobooks and eMagazines online.",
    from: ["Digital lending"],
  },
  {
    name: "BFI Replay",
    category: "Culture",
    summary: "Free access to the BFI's digitised film and TV archive.",
    from: ["BFI Replay"],
  },
  {
    name: "British Newspaper Archive",
    category: "Research",
    summary: "Free access to digitised historic British newspapers.",
    from: ["British Newspaper Archive"],
  },
  {
    name: "Findmypast",
    category: "Research",
    summary: "Free access to Findmypast family history records.",
    from: ["Findmypast"],
  },
  {
    name: "Family history",
    category: "Archives",
    summary: "Help and resources for researching family history.",
    from: ["Family history"],
  },
  {
    name: "Children's activities",
    category: "Family",
    summary: "Story times, rhyme times and activities for children.",
    from: ["Children's activities"],
  },
  {
    name: "Hobby and interest groups",
    category: "Community",
    summary: "Clubs and groups that meet at the library.",
    from: ["Hobby and interest groups"],
  },
  {
    name: "Digital skills sessions",
    category: "Learning",
    summary: "Help getting online and using computers and devices.",
    from: ["Digital skills sessions"],
  },
  {
    name: "Career support",
    category: "Learning",
    summary: "Help with job searching, CVs and applications.",
    from: ["Career support"],
  },
  {
    name: "Business support",
    category: "Business",
    summary: "Resources and advice for small businesses and start-ups.",
    from: ["Business support"],
  },
  {
    name: "Cafes & restaurant",
    category: "Family",
    summary: "A cafe or restaurant on site.",
    from: ["Cafe"],
  },
]

function lookupTable(entries: TaxonomyEntry[]): Map<string, string> {
  return new Map(entries.flatMap((e) => e.from.map((f) => [f, e.name])))
}

const ACCESSIBILITY_LOOKUP = lookupTable(ACCESSIBILITY_TAXONOMY)
const AMENITY_LOOKUP = lookupTable(AMENITY_TAXONOMY)
const SERVICE_LOOKUP = lookupTable(SERVICE_TAXONOMY)

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)]
}

// ── Social links ──────────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "whatsapp",
  "telegram",
  "wechat",
  "threads",
  "bluesky",
  "mastodon",
  "pinterest",
])

function mapSocial(
  social: LibraryOnSocial[] | null | undefined
): { platform: string; label?: string; url: string }[] {
  return (social ?? []).flatMap((s) => {
    const platform = s.channel === "twitter" ? "x" : (s.channel ?? "")
    if (!SOCIAL_PLATFORMS.has(platform) || !s.url) return []

    return [{ platform, ...(s.handle ? { label: s.handle } : {}), url: s.url }]
  })
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// ── Main mapper ───────────────────────────────────────────────────────────────

interface LibraryOnSocial {
  channel?: string | null
  handle?: string | null
  url?: string | null
}

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
    permanentlyClosed?: boolean | null
    tempClosedUntil?: string | null
    isMobileLibrary?: boolean | null
    accessibility?: string[] | null
    services?: { service?: string | null; url?: string | null }[] | null
    social?: LibraryOnSocial[] | null
    location?: Record<string, unknown> | null
    openingTimes?: Record<string, unknown> | null
    yearOpen?: string | number | null
    yearClosed?: string | number | null
    catalogue?: string | null
    joinOnline?: string | null
    virtualTourUrl?: string | null
    virtualTourEmbed?: string | null
    contentUpdatedAt?: string | null
  }
}

export interface MappedLibrary {
  data: LibraryCreateData
  meta: {
    libraryOnId: number
    libraryOnRef: string
    countrySlug: string | null
    countryName: string | null
    regionSlug: string | null // libraryOn authority, or greater-london
    regionName: string | null
    areaSlug: string | null // London borough only
    areaName: string | null
    librarySlug: string | null
    accessibilityNames: string[]
    amenityNames: string[]
    serviceNames: string[]
    unmappedServices: string[]
    unmappedAccessibility: string[]
  }
}

export function mapLibraryOnRecord(record: LibraryOnRecord): MappedLibrary {
  const a = record.attributes
  const name = a.name.trim()
  const loc = extractLocation(a.location)
  const nation = parseNationFromRef(a.ref)
  const librarySlug = parseLibrarySlugFromRef(a.ref)
  const authoritySlug = parseRegionSlugFromRef(a.ref)

  let regionSlug = authoritySlug
  let areaSlug: string | null = null
  if (authoritySlug && LONDON_BOROUGHS.has(authoritySlug)) {
    regionSlug = "greater-london"
    areaSlug = authoritySlug
  }

  const openingTimes = mapOpeningTimes(a.openingTimes)

  const rawServices = uniq(
    (a.services ?? []).map((s) => s.service).filter((s): s is string => !!s)
  )
  const rawAccessibility = uniq(a.accessibility ?? [])

  const data: LibraryCreateData = {
    name,
    libraryType: inferLibraryType(name, a.isMobileLibrary ?? null),
    operationalStatus: mapStatus(
      a.facilityOperated,
      a.permanentlyClosed,
      a.tempClosedUntil,
      openingTimes !== null
    ),
    operatorType: mapOperatorType(a.facilityOperated),
    source: "libraryon",
    sourceUrl:
      authoritySlug && librarySlug
        ? `https://libraryon.org/libraries/${authoritySlug}/${librarySlug}`
        : "https://libraryon.org",
  }

  if (nation?.countrySlug) {
    const tz = COUNTRY_TIMEZONE[nation.countrySlug]
    if (tz) data.timezone = tz
  }

  if (librarySlug) data.slug = librarySlug
  if (openingTimes) data.openingTimes = openingTimes

  const email = a.email?.trim()
  if (email && EMAIL_RE.test(email)) data.email = email
  if (a.phone?.trim()) data.phone = a.phone.trim()
  if (a.website?.trim()) data.website = a.website.trim()
  if (a.streetAddress?.trim()) data.streetAddress = a.streetAddress.trim()
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
  if (a.contentUpdatedAt) data.contentUpdatedAt = a.contentUpdatedAt

  const socialLinks = mapSocial(a.social)
  if (socialLinks.length > 0) data.socialLinks = socialLinks

  return {
    data,
    meta: {
      libraryOnId: record.id,
      libraryOnRef: a.ref,
      countrySlug: nation?.countrySlug ?? null,
      countryName: nation?.countryName ?? null,
      regionSlug,
      regionName: regionSlug ? titleCase(regionSlug) : null,
      areaSlug,
      areaName: areaSlug ? titleCase(areaSlug) : null,
      librarySlug,
      accessibilityNames: uniq(
        rawAccessibility.flatMap((k) => ACCESSIBILITY_LOOKUP.get(k) ?? [])
      ),
      amenityNames: uniq(
        rawServices.flatMap((s) => AMENITY_LOOKUP.get(s) ?? [])
      ),
      serviceNames: uniq(
        rawServices.flatMap((s) => SERVICE_LOOKUP.get(s) ?? [])
      ),
      unmappedServices: rawServices.filter(
        (s) => !AMENITY_LOOKUP.has(s) && !SERVICE_LOOKUP.has(s)
      ),
      unmappedAccessibility: rawAccessibility.filter(
        (k) => !ACCESSIBILITY_LOOKUP.has(k)
      ),
    },
  }
}
