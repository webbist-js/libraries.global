import * as cheerio from "cheerio"

import {
  ENTERPRISE_DEFAULT_AVAILABILITY_URL,
  ENTERPRISE_DEFAULT_AVAILABLE,
} from "../detect"
import type { CatalogueHttp } from "../http"
import type {
  AvailabilityResult,
  BranchHoldings,
  CatalogueConfig,
  CatalogueConnector,
} from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * SirsiDynix Enterprise. Ported from LibrariesHacked/catalogues-library
 * (connectors/enterprise.js).
 * Changes:
 * - status matching uses includes(); upstream's `indexOf(status) > 0` ignored
 *   the first configured status (e.g. Barking and Dagenham's only one, "On Shelf");
 * - `libraryNameFilter` also filters holdings, not just branches, so shared
 *   London/Essex catalogues only report the service's own branches;
 * - branch codes are kept (option values are "<n>:<code>");
 * - the CSRF token is sent on the title-detail fallback too;
 * - a multi-result page is walked for at most MAX_CANDIDATES records;
 * - recordId is the catalogue's own `ent://` id and recordUrl its detail page.
 */

const MAX_CANDIDATES = 5
const XHR = { "X-Requested-With": "XMLHttpRequest" }

interface ChildRecord {
  LIBRARY?: string
  SD_ITEM_STATUS?: string
}

interface AvailabilityJson {
  childRecords?: ChildRecord[]
  ids?: string[]
  strings?: string[]
}

/** "ent://SD_ILS/0/SD_ILS:57836" or "//SD_ILS/0/..." → "$002f$002fSD_ILS$002f0$002fSD_ILS:57836" */
function encodeEntId(id: string): string {
  return id.replace(/^ent:/, "").split("/").join("$002f")
}

function decodeEntId(encoded: string): string {
  return `ent:${encoded.split("$002f").join("/")}`
}

function entIdFromUrl(url: string): string | undefined {
  return /\/ent:([^/?]+)\/one/.exec(url)?.[1]
}

function isAvailable(config: CatalogueConfig, status: string): boolean {
  const statuses =
    config.settings.availableStatuses ?? ENTERPRISE_DEFAULT_AVAILABLE

  return statuses.includes(status.trim())
}

function parseJson(text: string): AvailabilityJson | null {
  try {
    const parsed = JSON.parse(text) as unknown

    return parsed && typeof parsed === "object"
      ? (parsed as AvailabilityJson)
      : null
  } catch {
    return null
  }
}

function tallyChildRecords(
  config: CatalogueConfig,
  records: ChildRecord[]
): BranchHoldings[] {
  const tally = new HoldingsTally()
  for (const c of records)
    tally.add(c.LIBRARY ?? "", isAvailable(config, c.SD_ITEM_STATUS ?? ""))

  return tally.toArray()
}

/** Older installations return barcode ids + status strings; branch names come from the page. */
function tallyIds(
  config: CatalogueConfig,
  page: string,
  json: AvailabilityJson
): BranchHoldings[] {
  const ids = json.ids ?? []
  const strings = json.strings ?? []
  const $ = cheerio.load(page)
  const tally = new HoldingsTally()
  $(".detailItemsTableRow").each((_, row) => {
    const $row = $(row)
    const barcode = (
      $row.find("td div[id^=availabilityDiv]").attr("id") ?? ""
    ).replace("availabilityDiv", "")
    const idx = barcode ? ids.indexOf(barcode) : -1
    if (idx === -1) return
    const name =
      $row.find("[id^=asyncFieldDefault][id*=LIBRARY]").first().text().trim() ||
      $row.find("td").eq(0).text().trim()
    tally.add(name, isAvailable(config, strings[idx] ?? ""))
  })

  return tally.toArray()
}

async function holdingsFromDetailPage(
  config: CatalogueConfig,
  http: CatalogueHttp,
  encodedId: string,
  page: string
): Promise<BranchHoldings[]> {
  const csrf = /__sdcsrf\s*=\s*"([^"]+)"/.exec(page)?.[1]
  const headers: Record<string, string> = csrf ? { ...XHR, sdcsrf: csrf } : XHR

  // Some installations inline the availability JSON in the page.
  let json: AvailabilityJson | null = null
  const inline = /parseDetailAvailabilityJSON\(([\s\S]*?)\)/.exec(page)?.[1]
  if (inline) json = parseJson(inline)

  if (!json?.childRecords && !json?.ids) {
    const template =
      config.settings.availabilityUrl ?? ENTERPRISE_DEFAULT_AVAILABILITY_URL
    const res = await http.post(
      joinUrl(config.baseUrl, template.replace("[ITEMID]", encodedId)),
      "",
      { headers }
    )
    json = parseJson(res.text)
  }

  if (json?.childRecords) return tallyChildRecords(config, json.childRecords)
  if (json?.ids) return tallyIds(config, page, json)

  if (config.settings.titleDetailUrl) {
    const res = await http.post(
      joinUrl(
        config.baseUrl,
        config.settings.titleDetailUrl.replace("[ITEMID]", encodedId)
      ),
      "",
      { headers }
    )
    const titles = parseJson(res.text)
    if (titles?.childRecords)
      return tallyChildRecords(config, titles.childRecords)
  }

  return []
}

function detailUrl(config: CatalogueConfig, encodedId: string): string {
  return joinUrl(config.baseUrl, `search/detailnonmodal/ent:${encodedId}/one`)
}

export const enterprise: CatalogueConnector = {
  system: "enterprise",

  async listBranches(config, http) {
    const res = await http.get(joinUrl(config.baseUrl, "search/advanced"))
    const $ = cheerio.load(res.text)
    const filter = config.settings.libraryNameFilter

    return uniqueBranches(
      $("#libraryDropDown option")
        .toArray()
        .map((o) => {
          const name = $(o).text().trim()
          const code = ($(o).attr("value") ?? "").replace(/^\d+:/, "")

          return code ? { name, code } : { name }
        })
        .filter((b) => !filter || b.name.includes(filter))
    )
  },

  async searchByIsbn(config, isbn, http) {
    const searchUrl = joinUrl(
      config.baseUrl,
      `search/results?qu=${encodeURIComponent(isbn)}`
    )
    const res = await http.get(searchUrl)

    // A single hit redirects straight to the detail page, whose URL holds the id.
    const directId = [res.url, ...res.redirects].map(entIdFromUrl).find(Boolean)

    const candidates: { encodedId: string; page?: string }[] = directId
      ? [{ encodedId: directId, page: res.text }]
      : cheerio
          .load(res.text)("input.results_chkbox.DISCOVERY_ALL")
          .toArray()
          .map((el) => el.attribs.value ?? "")
          .filter((v) => v.includes("ent:"))
          .slice(0, MAX_CANDIDATES)
          .map((v) => ({
            encodedId: encodeEntId(v.slice(v.lastIndexOf("ent:"))),
          }))

    if (candidates.length === 0) return { found: false, holdings: [] }

    const filter = config.settings.libraryNameFilter
    let first: AvailabilityResult | undefined
    for (const candidate of candidates) {
      const page =
        candidate.page ??
        (await http.get(detailUrl(config, candidate.encodedId))).text
      const holdings = (
        await holdingsFromDetailPage(config, http, candidate.encodedId, page)
      ).filter((h) => !filter || h.branch.includes(filter))
      const result: AvailabilityResult = {
        found: true,
        recordId: decodeEntId(candidate.encodedId),
        recordUrl: detailUrl(config, candidate.encodedId),
        holdings,
      }
      if (holdings.length > 0) return result
      first ??= result
    }

    return first!
  },
}
