/**
 * IMLS Public Libraries Survey → libraries.global mapping. Pure functions only;
 * ingest.ts does the reading and writing. The column → field table and the
 * reasoning behind each rule are in README.md next to this file.
 */

import { properCase, slugify } from "../../_shared/text"
import { US_STATES, US_TERRITORIES } from "../states"

export const DATASET_KEY = "imls-pls"
export const SURVEY_YEAR = "FY 2023"
export const SURVEY_URL =
  "https://www.imls.gov/research-evaluation/surveys/public-libraries-survey-pls"

/** A row of the outlet file (pls_fy23_outlet_pud23i.csv). */
export type OutletRow = Record<string, string>
/** A row of the administrative entity file (PLS_FY23_AE_pud23i.csv). */
export type AdminRow = Record<string, string>

export interface MappedOutlet {
  recordId: string
  state: string
  data: {
    name: string
    slug: string
    libraryType: "Public" | "Mobile"
    operationalStatus: "open" | "temporarily_closed" | "unknown"
    operatorType?: string
    streetAddress?: string
    city?: string
    postalCode?: string
    phone?: string
    location: { lat: number; lng: number }
    timezone?: string
    libraryStats?: { value: string; label: string; note: string }[]
    source: string
    sourceUrl: string
  }
  geo: {
    /** A territory's own Country. Unset: the United States. */
    countrySlug?: string
    regionName: string
    regionSlug: string
    /** The survey's county, as written, for matching to the atlas's Areas. */
    county?: string
    areaName?: string
    areaSlug?: string
    areaTypeLabel?: string
  }
  warnings: string[]
}

export type MapResult =
  | { ok: true; outlet: MappedOutlet }
  | { ok: false; recordId: string; name: string; reason: string }

/** FSCSKEY + FSCS_SEQ: stable across survey years for the same outlet. */
export function recordIdOf(row: OutletRow): string {
  return `${row.FSCSKEY}-${row.FSCS_SEQ}`
}

// C_LEGBAS: the local government structure the library operates under.
const OPERATOR_BY_LEGAL_BASIS: Record<string, string> = {
  CI: "Municipality", // city, town or village
  CC: "Municipality", // run jointly by a city and a county
  MJ: "Municipality", // multi-jurisdictional
  LD: "Municipality", // library district
  SD: "Municipality", // school district
  CO: "Regional Government", // county or parish
  NP: "Independent", // non-profit association or agency
  NL: "Other", // Native American tribal government
  OT: "Other",
}

/** A reported value only: IMLS imputes missing ones, and we don't show those. */
function reported(value: string, imputationFlag: string): number | null {
  if (!imputationFlag.startsWith("R_")) return null
  const n = Number(value)

  return Number.isFinite(n) && n > 0 ? n : null
}

function formatPhone(raw: string): string | undefined {
  const digits = raw.replaceAll(/\D/g, "")
  if (digits.length !== 10) return undefined

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function outletName(row: OutletRow, admin: AdminRow | undefined): string {
  let name = properCase(row.LIBNAME)

  // Many bookmobiles are filed under their library's own name.
  if (
    row.C_OUT_TY === "BS" &&
    !/mobile|bus\b|van\b|cruiser|rover|wagon|outreach/i.test(name)
  ) {
    name = `${name} Bookmobile`
  }

  if (row.C_OUT_TY === "CE" || !admin) return name
  if (/librar/i.test(name)) return name

  // Branches and bookmobiles named only by place ("McKinley Park",
  // "Kidsmobile") take the system's name so the record stands on its own.
  // Only the part before a comma: NYPL's system is filed as
  // "NEW YORK PUBLIC LIBRARY, THE BRANCH LIBRARIES".
  const system = properCase(admin.LIBNAME.split(",")[0]!)
  if (name.toLowerCase().includes(system.toLowerCase())) return name

  return `${system}, ${name}`
}

/**
 * The library slug must be unique across the whole index (library pages are
 * looked up by slug alone), so it always carries the state and, unless the
 * name already contains it, the city.
 */
export function outletSlug(name: string, city: string, state: string): string {
  const base = slugify(name)
  const citySlug = slugify(city)
  const withCity =
    citySlug && !base.includes(citySlug) ? `${base}-${citySlug}` : base

  return `${withCity}-${state.toLowerCase()}`
}

function areaOf(row: OutletRow, countyLabel: string, state: string) {
  const county = row.CNTY?.trim()
  if (!county || county.startsWith("-")) return {}

  // Virginia's independent cities are reported as e.g. "RICHMOND CITY".
  const isCity = / CITY$/i.test(county)
  const areaName = isCity
    ? properCase(county)
    : `${properCase(county)} ${countyLabel}`

  return {
    county,
    areaName,
    // County names repeat across states (30 have a Washington County).
    areaSlug: `${slugify(areaName)}-${state.toLowerCase()}`,
    areaTypeLabel: isCity ? "City" : countyLabel,
  }
}

// A territory's Region is named by the county column (Guam's: the city one).
// The resolver in ingest.ts matches it to the atlas; the slug is a first guess.
function territoryGeo(
  row: OutletRow,
  territory: (typeof US_TERRITORIES)[string]
): MappedOutlet["geo"] {
  const raw = (territory.regionFrom === "city" ? row.CITY : row.CNTY)?.trim()
  const regionName =
    territory.regionAliases?.[raw?.toUpperCase() ?? ""] ?? properCase(raw ?? "")

  return {
    countrySlug: territory.countrySlug,
    regionName,
    regionSlug: slugify(regionName),
  }
}

export function mapOutlet(
  row: OutletRow,
  admin: AdminRow | undefined
): MapResult {
  const recordId = recordIdOf(row)
  const state = row.STABR
  const stateInfo = US_STATES[state]
  const territory = US_TERRITORIES[state]
  const rawName = properCase(row.LIBNAME)

  if (!stateInfo && !territory) {
    return {
      ok: false,
      recordId,
      name: rawName,
      reason: `Unknown state code ${state}`,
    }
  }
  if (row.C_OUT_TY === "BM") {
    return {
      ok: false,
      recordId,
      name: rawName,
      reason: "Books-by-mail service, not a place to visit",
    }
  }

  const lat = Number(row.LATITUDE)
  const lng = Number(row.LONGITUD)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) {
    return { ok: false, recordId, name: rawName, reason: "No coordinates" }
  }

  const warnings: string[] = []
  const name = outletName(row, admin)
  const city = properCase(row.CITY)

  let operationalStatus: MappedOutlet["data"]["operationalStatus"] = "open"
  if (row.STATSTRU === "23") operationalStatus = "temporarily_closed"
  if (row.STATSTRU === "25") {
    operationalStatus = "unknown"
    warnings.push("Survey non-respondent: status unknown")
  }

  const operatorType = admin
    ? OPERATOR_BY_LEGAL_BASIS[admin.C_LEGBAS]
    : undefined
  if (!admin) warnings.push(`No administrative entity row for ${row.FSCSKEY}`)

  const timezone = territory?.timezone ?? stateInfo?.timezone
  if (!timezone) {
    warnings.push(`${stateInfo!.name} spans time zones: timezone left empty`)
  }
  if (Number(row.GEOSCORE) < 90) {
    warnings.push(`Low geocode score ${row.GEOSCORE} (${row.GEOMTYPE})`)
  }

  const note = `IMLS Public Libraries Survey, ${SURVEY_YEAR}`
  const libraryStats: { value: string; label: string; note: string }[] = []
  const hours = reported(row.HOURS, row.F_HOURS)
  if (hours) {
    libraryStats.push({
      value: hours.toLocaleString("en-US"),
      label: "Public service hours a year",
      note,
    })
  }
  const sqFt = reported(row.SQ_FEET, row.F_SQ_FT)
  if (sqFt) {
    libraryStats.push({
      value: `${sqFt.toLocaleString("en-US")} sq ft`,
      label: "Floor area",
      note,
    })
  }

  const streetAddress = properCase(row.ADDRESS)
  const phone = formatPhone(row.PHONE)

  return {
    ok: true,
    outlet: {
      recordId,
      state,
      data: {
        name,
        slug: outletSlug(name, city, state),
        libraryType: row.C_OUT_TY === "BS" ? "Mobile" : "Public",
        operationalStatus,
        ...(operatorType ? { operatorType } : {}),
        ...(streetAddress ? { streetAddress } : {}),
        ...(city ? { city } : {}),
        ...(/^\d{5}$/.test(row.ZIP) ? { postalCode: row.ZIP } : {}),
        ...(phone ? { phone } : {}),
        location: { lat, lng },
        ...(timezone ? { timezone } : {}),
        ...(libraryStats.length > 0 ? { libraryStats } : {}),
        source: DATASET_KEY,
        sourceUrl: SURVEY_URL,
      },
      geo: territory
        ? territoryGeo(row, territory)
        : {
            regionName: stateInfo!.name,
            regionSlug: stateInfo!.regionSlug ?? slugify(stateInfo!.name),
            ...(stateInfo!.noAreas
              ? {}
              : areaOf(row, stateInfo!.countyLabel, state)),
          },
      warnings,
    },
  }
}
