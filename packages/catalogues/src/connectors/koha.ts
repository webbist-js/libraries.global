import * as cheerio from "cheerio"
import type { CheerioAPI } from "cheerio"

import type { CatalogueHttp, HttpResponse } from "../http"
import type {
  CatalogueBranch,
  CatalogueConfig,
  CatalogueConnector,
} from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Koha. Ported from LibrariesHacked/catalogues-library (connectors/koha.v23.js
 * and koha.v24.js). The two upstream files are identical, so `config.version`
 * is accepted but does not change behaviour.
 * Changes:
 * - branches come from Koha's public REST API (`api/v1/public/libraries`), which
 *   is not behind the Anubis/Cloudflare challenges most UK OPACs now serve, and
 *   carry `code` (library_id), `address` and `postcode`. The OPAC facet scrape is
 *   the fallback when the API is disabled (401/403/404) or not JSON, and is used
 *   directly when `multiBranchLimit` is set, since the API cannot filter by group;
 * - OPAC-scraped branches also carry codes (`branch:` option values, facet links);
 * - the `libsUrl` setting is honoured for the OPAC scrape (upstream data.json
 *   sets it but the connectors ignored it);
 * - ISBN → biblionumber still needs the OPAC RSS search, but holdings then come
 *   from `api/v1/public/biblios/{id}/items` when it returns items, falling back
 *   to parsing opac-detail.pl;
 * - only the first RSS item is used (upstream concatenated every `<guid>`,
 *   producing a broken URL when more than one record matched);
 * - a single-hit redirect straight to opac-detail.pl is followed;
 * - an item counts as available when Koha marks it so (schema.org InStock or the
 *   `available` status class), not only when the text is exactly "Available".
 *   Via the API, a copy is available when it is not checked out, not-for-loan,
 *   lost or withdrawn (in-transit is not exposed there).
 */

const LIBS_PATH =
  "cgi-bin/koha/opac-search.pl?[MULTIBRANCH]do=Search&expand=holdingbranch"

function libsPath(multiBranchLimit: string | undefined): string {
  return LIBS_PATH.replace(
    "[MULTIBRANCH]",
    multiBranchLimit
      ? `multibranchlimit=${encodeURIComponent(multiBranchLimit)}&`
      : ""
  )
}

interface KohaLibrary {
  library_id?: string
  name?: string
  address1?: string | null
  address2?: string | null
  address3?: string | null
  city?: string | null
  postal_code?: string | null
}

interface KohaItem {
  holding_library_id?: string | null
  checked_out_date?: string | null
  not_for_loan_status?: number | null
  effective_not_for_loan_status?: number | null
  lost_status?: number | null
  withdrawn?: number | null
}

const API_PER_PAGE = 100
const API_MAX_PAGES = 20
/** Statuses meaning "the public API is switched off here", not "the site is down". */
const API_OFF = [401, 403, 404]

function isJson(res: HttpResponse): boolean {
  return /json/i.test(res.headers.get("content-type") ?? "")
}

/**
 * GETs every page of a public API list endpoint. Returns null when the API is
 * unavailable (disabled, missing, or not JSON) so callers can fall back.
 */
async function apiList<T>(
  config: CatalogueConfig,
  http: CatalogueHttp,
  path: string
): Promise<T[] | null> {
  const all: T[] = []
  for (let page = 1; page <= API_MAX_PAGES; page++) {
    const sep = path.includes("?") ? "&" : "?"
    const res = await http.get(
      joinUrl(
        config.baseUrl,
        `${path}${sep}_per_page=${API_PER_PAGE}&_page=${page}`
      ),
      { headers: { Accept: "application/json" }, allowStatus: API_OFF }
    )
    if (res.status !== 200 || !isJson(res)) return null
    let rows: unknown
    try {
      rows = JSON.parse(res.text)
    } catch {
      return null
    }
    if (!Array.isArray(rows)) return null
    all.push(...(rows as T[]))
    if (rows.length < API_PER_PAGE) break
  }

  return all
}

function toBranch(lib: KohaLibrary): CatalogueBranch | null {
  const name = lib.name?.trim()
  if (!name) return null
  const branch: CatalogueBranch = { name }
  if (lib.library_id) branch.code = lib.library_id
  const address = [lib.address1, lib.address2, lib.address3, lib.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")
  if (address) branch.address = address
  const postcode = lib.postal_code?.trim()
  if (postcode) branch.postcode = postcode

  return branch
}

async function apiBranches(
  config: CatalogueConfig,
  http: CatalogueHttp
): Promise<CatalogueBranch[] | null> {
  const libs = await apiList<KohaLibrary>(
    config,
    http,
    "api/v1/public/libraries"
  )
  if (!libs || libs.length === 0) return null

  return uniqueBranches(
    libs.map(toBranch).filter((b): b is CatalogueBranch => b !== null)
  )
}

async function opacBranches(
  config: CatalogueConfig,
  http: CatalogueHttp
): Promise<CatalogueBranch[]> {
  const path =
    config.settings.libsUrl ?? libsPath(config.settings.multiBranchLimit)
  const res = await http.get(joinUrl(config.baseUrl, path))
  const $ = cheerio.load(res.text)

  const branches: CatalogueBranch[] = []
  const push = (name: string, code: string | undefined): void => {
    branches.push(code ? { name, code } : { name })
  }

  $("#branchloop option, #select_library option").each((_, o) => {
    const value = $(o).attr("value") ?? ""
    if (value.startsWith("multibranchlimit")) return
    push($(o).text().trim(), branchCode(value))
  })
  $(
    "li#holdingbranch_id ul li span.facet-label, li#homebranch_id ul li span.facet-label"
  ).each((_, label) => {
    push($(label).text().trim(), branchCode($(label).find("a").attr("href")))
  })

  // Merge: the dropdown may lack a code the facets have, and vice versa.
  const unique = uniqueBranches(branches)
  for (const b of unique) {
    if (b.code) continue
    const withCode = branches.find(
      (o) =>
        o.code && o.name.trim().toLowerCase() === b.name.trim().toLowerCase()
    )
    if (withCode?.code) b.code = withCode.code
  }

  return unique
}

function itemAvailable(item: KohaItem): boolean {
  const notForLoan =
    item.effective_not_for_loan_status ?? item.not_for_loan_status ?? 0

  return (
    !item.checked_out_date &&
    !notForLoan &&
    !item.lost_status &&
    !item.withdrawn
  )
}

/** Holdings from the public items API, or null to fall back to the OPAC page. */
async function apiHoldings(
  config: CatalogueConfig,
  http: CatalogueHttp,
  biblionumber: string
): Promise<HoldingsTally | null> {
  const items = await apiList<KohaItem>(
    config,
    http,
    `api/v1/public/biblios/${encodeURIComponent(biblionumber)}/items`
  )
  if (!items || items.length === 0) return null
  // Only trust the API if it exposes both where a copy is and whether it's out.
  if (!items.every((i) => i.holding_library_id && "checked_out_date" in i))
    return null

  const libs = await apiList<KohaLibrary>(
    config,
    http,
    "api/v1/public/libraries"
  )
  const names = new Map<string, string>()
  for (const l of libs ?? [])
    if (l.library_id && l.name) names.set(l.library_id, l.name.trim())

  const tally = new HoldingsTally()
  for (const item of items) {
    const id = item.holding_library_id ?? ""
    tally.add(names.get(id) ?? id, itemAvailable(item))
  }

  return tally
}

/** "branch:CPL" / "holdingbranch:CPL" / "...&limit=holdingbranch%3ACPL" → "CPL". */
function branchCode(value: string | undefined): string | undefined {
  if (!value) return undefined
  const m = /(?:^|[=&?])(?:home|holding)?branch(?::|%3A)([^&"]+)/i.exec(value)

  return m?.[1] ? decodeURIComponent(m[1]) : undefined
}

function biblioUrl(baseUrl: string, biblionumber: string): string {
  return joinUrl(
    baseUrl,
    `cgi-bin/koha/opac-detail.pl?biblionumber=${encodeURIComponent(biblionumber)}`
  )
}

/** A cheerio selection of elements (avoids importing domhandler's types directly). */
type Selection = ReturnType<ReturnType<CheerioAPI["root"]>["find"]>

function locationName(cell: Selection): string {
  const candidates = [
    cell.find("a[href*='opac-library.pl']").first(),
    cell.find(".homebranch, .holdingbranch, .branchname").first(),
    cell.find("span span").first(),
    cell.find("span").first(),
  ]
  for (const c of candidates) {
    const text = c.text().trim()
    if (text) return text
  }

  return cell.text().trim().split("\n")[0]?.trim() ?? ""
}

function isAvailable(cell: Selection): boolean {
  const schema = cell
    .find("link[property='availability'], link[itemprop='availability']")
    .attr("href")
  if (schema) return /InStock|InStoreOnly/i.test(schema)
  if (cell.find(".item-status.available").length > 0) return true

  return /^available\b/i.test(cell.text().trim())
}

export const koha: CatalogueConnector = {
  system: "koha",

  async listBranches(config, http) {
    if (!config.settings.multiBranchLimit) {
      const fromApi = await apiBranches(config, http)
      if (fromApi) return fromApi
    }

    return opacBranches(config, http)
  },

  async searchByIsbn(config, isbn, http) {
    const searchUrl = joinUrl(
      config.baseUrl,
      `cgi-bin/koha/opac-search.pl?format=rss2&idx=nb&q=${encodeURIComponent(isbn)}`
    )
    const res = await http.get(searchUrl)

    let biblionumber: string | undefined

    // Some installations redirect a single hit straight to the record.
    const direct = /opac-detail\.pl\?(?:.*&)?biblionumber=(\d+)/.exec(res.url)
    if (direct) {
      biblionumber = direct[1]
    } else {
      const $ = cheerio.load(res.text, { xml: true })
      const guid =
        $("item").first().find("guid").first().text().trim() ||
        $("item").first().find("link").first().text().trim()
      biblionumber = /biblionumber=(\d+)/.exec(guid)?.[1]
    }
    if (!biblionumber) return { found: false, holdings: [] }

    const recordUrl = biblioUrl(config.baseUrl, biblionumber)
    const fromApi = await apiHoldings(config, http, biblionumber)
    if (fromApi)
      return {
        found: true,
        recordId: biblionumber,
        recordUrl,
        holdings: fromApi.toArray(),
      }

    const detail = await http.get(`${recordUrl}&viewallitems=1`)
    const $ = cheerio.load(detail.text)

    const tally = new HoldingsTally()
    $("#holdingst tbody tr, .holdingst tbody tr").each((_, tr) => {
      const row = $(tr)
      const branch = locationName(row.find("td.location").first())
      tally.add(branch, isAvailable(row.find("td.status").first()))
    })

    return {
      found: true,
      recordId: biblionumber,
      recordUrl,
      holdings: tally.toArray(),
    }
  },
}
