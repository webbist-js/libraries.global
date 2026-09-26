import type { CatalogueHttp } from "./http"

/**
 * Library management systems (LMS) whose public catalogues (OPACs) we can talk to.
 * Names follow the product, not the vendor: "enterprise" is SirsiDynix Enterprise,
 * "prism" is Capita/Softlink Prism 3, "arena" is Axiell Arena, "luci" is Solus LUCI.
 */
export type CatalogueSystem =
  | "arena"
  | "aspen"
  | "durham"
  | "enterprise"
  | "iguana"
  | "koha"
  | "luci"
  | "prism"
  | "spydus"
  | "webpac"

export const CATALOGUE_SYSTEMS: readonly CatalogueSystem[] = [
  "arena",
  "aspen",
  "durham",
  "enterprise",
  "iguana",
  "koha",
  "luci",
  "prism",
  "spydus",
  "webpac",
]

/**
 * Per-installation knobs. Most catalogues need none; the rest need one or two.
 * Field names are camelCased versions of the keys in LibrariesHacked's data.json.
 */
export interface CatalogueSettings {
  /** Status strings that count as "on the shelf" (enterprise, prism). */
  availableStatuses?: string[]
  /** Spydus: replaces the "WPAC" path segment. */
  opacReference?: string
  /** Spydus: replaces the "COMB" catalogue segment. */
  catalogueReference?: string
  /** Enterprise: path template for the availability lookup; `[ITEMID]` is substituted. */
  availabilityUrl?: string
  /** Enterprise: path template for the title-detail fallback; `[ITEMID]` is substituted. */
  titleDetailUrl?: string
  /** Shared catalogues: only keep branches whose name contains this string. */
  libraryNameFilter?: string
  /** Arena: agency name, e.g. "AUK000022". */
  arenaName?: string
  /** Arena: organisation id within a shared installation, e.g. "AUKLIBSWEST|1". */
  organisationId?: string
  /** Arena: which organisation's holdings to read in a shared record. */
  organisationName?: string
  /** Arena: holdings portlet ids, for installations that differ from the default. */
  recordPanel?: string
  holdingsPanel?: string
  /** Arena: path of the extended search page relative to the base URL. */
  advancedUrl?: string
  /** Arena: some installations only list branches on the sign-up page. */
  signupUrl?: string
  /** Arena: "Keyword" searches free text instead of the number index. */
  searchType?: string
  /** Arena: alias of the ISBN index. */
  isbnAlias?: string
  /** Iguana: database id, e.g. "1" or "1_STOCK". */
  database?: string
  /** Iguana: whether the installation supports faceted search. */
  faceted?: boolean
  /** LUCI: the landing path used to discover the Next.js build id. */
  home?: string
  /** Koha: override for the branch-list page. */
  libsUrl?: string
  /** Koha: multibranchlimit group for shared installations. */
  multiBranchLimit?: string
  /** Anything else a connector needs; keep this rare. */
  [key: string]: unknown
}

/** Everything needed to talk to one library service's catalogue. */
export interface CatalogueConfig {
  system: CatalogueSystem
  /** Absolute base URL with a trailing slash. */
  baseUrl: string
  /** Major version where connectors differ, e.g. Koha "23" / "24". */
  version?: string
  settings: CatalogueSettings
}

/** A service point listed by a catalogue (branch, mobile library, etc.). */
export interface CatalogueBranch {
  name: string
  /** The catalogue's own code for the branch, when it exposes one. */
  code?: string
  /** One-line street address, when the catalogue publishes it (Koha API). */
  address?: string
  postcode?: string
}

export interface BranchHoldings {
  branch: string
  available: number
  unavailable: number
}

export interface AvailabilityResult {
  /** False when the catalogue has no record for the ISBN. */
  found: boolean
  /** The catalogue's record id. */
  recordId?: string
  /** A URL a person can open to see the record. */
  recordUrl?: string
  holdings: BranchHoldings[]
}

export interface CatalogueConnector {
  readonly system: CatalogueSystem
  listBranches: (
    config: CatalogueConfig,
    http: CatalogueHttp
  ) => Promise<CatalogueBranch[]>
  searchByIsbn: (
    config: CatalogueConfig,
    isbn: string,
    http: CatalogueHttp
  ) => Promise<AvailabilityResult>
}

export type CatalogueErrorCode =
  /** The site served an anti-bot challenge. We never try to solve these. */
  | "bot_challenge"
  /** The site refuses non-browser clients (e.g. a CDN access-denied page). */
  | "blocked"
  /** Non-2xx response or network failure. */
  | "http"
  | "timeout"
  /** The page loaded but didn't look like we expected (the site changed). */
  | "parse"
  /** The URL resolved to a private/loopback address or used a bad scheme. */
  | "unsafe_url"
  /** No connector, or this installation is known not to work. */
  | "unsupported"
  | "invalid_input"

export class CatalogueError extends Error {
  readonly code: CatalogueErrorCode

  constructor(code: CatalogueErrorCode, message: string) {
    super(message)
    this.name = "CatalogueError"
    this.code = code
  }
}

export type Outcome<T> =
  | { ok: true; value: T; durationMs: number }
  | {
      ok: false
      error: { code: CatalogueErrorCode; message: string }
      durationMs: number
    }
