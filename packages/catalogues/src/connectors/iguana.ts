import * as cheerio from "cheerio"
import type { CheerioAPI } from "cheerio"

import type { CatalogueHttp } from "../http"
import {
  CatalogueError,
  type CatalogueBranch,
  type CatalogueConfig,
  type CatalogueConnector,
} from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Infor Iguana (Vubis). Ported from LibrariesHacked/catalogues-library
 * (connectors/iguana.js).
 * Changes:
 * - branches come from the Location facet that the search response already
 *   carries (full list with codes) instead of the shelfmarks of the first ten
 *   "harry" hits; the separate faceted request is only a fallback when
 *   `faceted` is set, and shelfmarks are the last resort;
 * - branch names use LocationWording when present;
 * - `{ found: false }` when there is no record or only a "best match" guess;
 * - recordUrl is a deep link into the Iguana UI (hash route, so unverified
 *   server-side).
 */

const HOME = "www.main.cls"
const PROXY = "Proxy.SearchRequest.cls"

function searchBody(database: string, query: string, sid: string): string {
  return new URLSearchParams({
    fu: "BibSearch",
    RequestType: "ResultSet_DisplayList",
    NumberToRetrieve: "10",
    StartValue: "1",
    SearchTechnique: "Find",
    Language: "eng",
    Profile: "Iguana",
    ExportByTemplate: "Brief",
    TemplateId: "Iguana_Brief",
    FacetedSearch: "Yes",
    MetaBorrower: "",
    Cluster: "0",
    Namespace: "0",
    BestMatch: "99",
    ASRProfile: "",
    Sort: "Relevancy",
    SortDirection: "1",
    WithoutRestrictions: "Yes",
    Associations: "Also",
    Application: "Bib",
    Database: database,
    Index: "Keywords",
    Request: query,
    SessionCMS: "",
    CspSessionId: sid,
    SearchMode: "simple",
    SIDTKN: sid,
  }).toString()
}

function database(config: CatalogueConfig): string {
  return config.settings.database ?? "1"
}

/** Opens a session. The SID is characters 12–22 of the CSP session cookie. */
async function openSession(
  config: CatalogueConfig,
  http: CatalogueHttp
): Promise<string> {
  const res = await http.get(joinUrl(config.baseUrl, HOME))
  // Read from the jar so a cookie set during a redirect still counts.
  const value = http.getCookie(new URL(res.url).host, /iguana-$/) ?? ""
  const sid = value.slice(12, 22)
  if (!sid)
    throw new CatalogueError("parse", "Iguana did not issue a session cookie")

  return sid
}

async function proxy(
  config: CatalogueConfig,
  http: CatalogueHttp,
  body: string
): Promise<CheerioAPI> {
  const res = await http.post(joinUrl(config.baseUrl, PROXY), body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: joinUrl(config.baseUrl, HOME),
    },
  })

  return cheerio.load(res.text, { xml: true })
}

function locationFacet($: CheerioAPI): CatalogueBranch[] {
  const facet = $("Facet")
    .toArray()
    .find((f) => $(f).children("FacetType").text().trim() === "Location")
  if (!facet) return []

  return $(facet)
    .children("FacetEntry")
    .toArray()
    .map((e) => {
      const name = $(e)
        .children("Display")
        .text()
        .replace(/\s*\(\d+\)\s*$/, "")
        .trim()
      const code = $(e).children("SearchTerm").text().trim()

      return code ? { name, code } : { name }
    })
}

/** Structural stand-in for a Cheerio selection, to avoid depending on domhandler types. */
interface XmlNode {
  children: (selector: string) => { text: () => string }
}

function shelfmarkBranch(s: XmlNode): CatalogueBranch {
  const name =
    s.children("LocationWording").text().trim() ||
    (s.children("Shelfmark").text().split(" : ")[0] ?? "").trim()
  const code = s.children("Scope").text().trim()

  return code ? { name, code } : { name }
}

export const iguana: CatalogueConnector = {
  system: "iguana",

  async listBranches(config, http) {
    const sid = await openSession(config, http)
    const $ = await proxy(
      config,
      http,
      searchBody(database(config), "harry", sid)
    )

    let branches = locationFacet($)

    if (branches.length === 0 && config.settings.faceted) {
      const resultId = $("searchRetrieveResponse > resultSetId").text().trim()
      const facets = await proxy(
        config,
        http,
        new URLSearchParams({
          FacetedSearch: resultId,
          FacetsFound: "",
          fu: "BibSearch",
          SIDTKN: sid,
        }).toString()
      )
      branches = locationFacet(facets)
    }

    if (branches.length === 0)
      branches = $("HoldingsSummary > ShelfmarkData")
        .toArray()
        .map((el) => shelfmarkBranch($(el)))

    return uniqueBranches(branches)
  },

  async searchByIsbn(config, isbn, http) {
    const sid = await openSession(config, http)
    const db = database(config)
    const $ = await proxy(config, http, searchBody(db, isbn, sid))

    const response = $("searchRetrieveResponse").first()
    if (response.children("bestMatch").length > 0)
      return { found: false, holdings: [] }

    const record = response.find("records > record").first()
    const doc = record.find("recordData > BibDocument").first()
    if (doc.length === 0) return { found: false, holdings: [] }

    const recordId = doc.children("Id").text().trim() || undefined

    const tally = new HoldingsTally()
    doc.find("HoldingsSummary > ShelfmarkData").each((_, el) => {
      const available = $(el).children("Available")
      if (available.length === 0) return
      const { name } = shelfmarkBranch($(el))
      const copies = Number.parseInt(available.text().trim(), 10) || 0
      // The summary gives a count of copies on the shelf but not a total, so a
      // branch with none available counts as one unavailable copy.
      if (copies > 0) tally.add(name, true, copies)
      else tally.add(name, false, 1)
    })

    return {
      found: true,
      ...(recordId
        ? {
            recordId,
            recordUrl: `${joinUrl(config.baseUrl, HOME)}?surl=search&p=*#RecordId=${encodeURIComponent(recordId)}&srchDb=${encodeURIComponent(db)}`,
          }
        : {}),
      holdings: tally.toArray(),
    }
  },
}
