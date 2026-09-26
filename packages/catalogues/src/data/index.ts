import type {
  CatalogueConfig,
  CatalogueSettings,
  CatalogueSystem,
} from "../types"

import raw from "./librarieshacked-uk-services.json"

/**
 * UK public library services and their catalogues, from LibrariesHacked's
 * catalogues-library (MIT). See NOTICE. The JSON is kept verbatim so it can be
 * re-synced from upstream; this module maps it onto our CatalogueConfig.
 */

export interface LibraryServiceRecord {
  /** Library service (local authority) name, e.g. "Aberdeen City". */
  name: string
  /** ONS GSS code for the authority, e.g. "S12000033". Null outside ONS geography (NI, Crown dependencies). */
  gssCode: string | null
  /** ISO 3166-1 alpha-2: GB, or GG/JE for the Crown dependencies. */
  countryCode: string
  catalogue: CatalogueConfig
}

interface RawService {
  Name: string
  Code: string
  Type: string
  Url: string
  Version?: string
  [key: string]: unknown
}

const SYSTEM_BY_TYPE: Record<string, CatalogueSystem> = {
  arena: "arena",
  aspen: "aspen",
  durham: "durham",
  enterprise: "enterprise",
  iguana: "iguana",
  koha: "koha",
  luci: "luci",
  prism3: "prism",
  spydus: "spydus",
  webpac: "webpac",
}

const CROWN_DEPENDENCIES: Record<string, string> = {
  Guernsey: "GG",
  Jersey: "JE",
  "Isle of Man": "IM",
}

/** Upstream key → our settings key. Keys not listed are dropped. */
const SETTING_KEYS: Record<string, keyof CatalogueSettings> = {
  Available: "availableStatuses",
  OpacReference: "opacReference",
  CatalogueReference: "catalogueReference",
  AvailabilityUrl: "availabilityUrl",
  TitleDetailUrl: "titleDetailUrl",
  LibraryNameFilter: "libraryNameFilter",
  ArenaName: "arenaName",
  OrganisationId: "organisationId",
  OrganisationName: "organisationName",
  ArenaMemberId: "arenaMemberId",
  AdvancedUrl: "advancedUrl",
  SignupUrl: "signupUrl",
  SearchType: "searchType",
  ISBNAlias: "isbnAlias",
  Database: "database",
  Faceted: "faceted",
  Home: "home",
  LibsUrl: "libsUrl",
  MultiBranchLimit: "multiBranchLimit",
  RecordPanel: "recordPanel",
  HoldingsPanel: "holdingsPanel",
  Id: "id",
}

export function fromLibrariesHacked(
  s: RawService
): LibraryServiceRecord | null {
  const system = SYSTEM_BY_TYPE[s.Type]
  if (!system || !s.Url) return null

  const settings: CatalogueSettings = {}
  for (const [from, to] of Object.entries(SETTING_KEYS)) {
    if (s[from] !== undefined) settings[to] = s[from]
  }

  // Upstream's Arena connector falls back to the service name to pick the
  // organisation in shared records; make that explicit.
  if (system === "arena" && !settings.organisationName)
    settings.organisationName = s.Name

  return {
    name: s.Name,
    gssCode: s.Code || null,
    countryCode: CROWN_DEPENDENCIES[s.Name] ?? "GB",
    catalogue: {
      system,
      baseUrl: s.Url.endsWith("/") ? s.Url : `${s.Url}/`,
      ...(s.Version ? { version: s.Version.replace(/^v/, "") } : {}),
      settings,
    },
  }
}

export const ukLibraryServices: LibraryServiceRecord[] = (
  raw as { LibraryServices: RawService[] }
).LibraryServices.map(fromLibrariesHacked).filter(
  (s): s is LibraryServiceRecord => s !== null
)
