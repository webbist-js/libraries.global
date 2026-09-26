import * as cheerio from "cheerio"

import type { CatalogueHttp } from "../http"
import {
  CatalogueError,
  type CatalogueBranch,
  type CatalogueConfig,
  type CatalogueConnector,
} from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Axiell Arena (Liferay + Wicket portlets). Ported from
 * LibrariesHacked/catalogues-library (connectors/arena.js).
 * Changes:
 * - the "loading" anti-bot page is never solved: upstream extracted its JS and
 *   ran it with Function() to mint a cookie. CatalogueHttp raises `bot_challenge`
 *   for that page and we let it propagate;
 * - Wicket `ajax-response` XML is read with cheerio's XML mode, and the
 *   component holding the data is found by content rather than by position;
 * - branch codes are kept (the organisation/branch option values);
 * - the ISBN index honours `isbnAlias` (upstream always used `number_index`);
 * - per-branch holdings requests are awaited in turn (upstream collected them
 *   in a forEach(async) that resolved after the response had been returned);
 * - the record URL is the item-detail link, which works without a session.
 */

const SEARCH_PATH =
  "search?p_p_id=searchResult_WAR_arenaportlet&p_p_lifecycle=1&p_p_state=normal&p_r_p_arena_urn:arena_facet_queries=&p_r_p_arena_urn:arena_search_type=solr&p_r_p_arena_urn:arena_search_query="
const ITEM_PATH =
  "results?p_p_id=crDetailWicket_WAR_arenaportlet&p_p_lifecycle=1&p_p_state=normal&p_r_p_arena_urn:arena_search_item_id=[ITEMID]&p_r_p_arena_urn:arena_facet_queries=&p_r_p_arena_urn:arena_agency_name=[ARENANAME]&p_r_p_arena_urn:arena_search_item_no=0&p_r_p_arena_urn:arena_search_type=solr"
const RESULTS_PATH = "results"

const ORGANISATION_RESOURCE =
  "/extendedSearch/?wicket:interface=:0:extendedSearchPanel:extendedSearchForm:organisationHierarchyPanel:organisationContainer:organisationChoice::IBehaviorListener:0:"
const HOLDINGS_PANEL_RESOURCE =
  "/crDetailWicket/?wicket:interface=:0:recordPanel:holdingsPanel::IBehaviorListener:0:"
const DEFAULT_RECORD_PANEL = "recordPanel:panel:holdingsPanel"

function wicketHeaders(focusedElementId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/xml",
    "Content-Type": "application/x-www-form-urlencoded",
    "Wicket-Ajax": "true",
  }
  if (focusedElementId) headers["Wicket-FocusedElementId"] = focusedElementId

  return headers
}

function resourceForm(
  portlet: string,
  resourceId: string,
  extra: Record<string, string> = {}
): string {
  return new URLSearchParams({
    p_p_id: portlet,
    p_p_lifecycle: "2",
    p_p_state: "normal",
    p_p_mode: "view",
    p_p_resource_id: resourceId,
    p_p_cacheability: "cacheLevelPage",
    ...extra,
  }).toString()
}

/** The HTML fragments inside a Wicket `<ajax-response>`, in document order. */
function ajaxComponents(xml: string): string[] {
  if (!xml.includes("<ajax-response")) return []
  const $ = cheerio.load(xml, { xml: true })

  return $("ajax-response > component")
    .toArray()
    .map((c) => $(c).text())
}

function optionBranches(
  $: cheerio.CheerioAPI,
  selector: string
): CatalogueBranch[] {
  return $(selector)
    .toArray()
    .map((o) => {
      const name = $(o).text().trim()
      const code = ($(o).attr("value") ?? "").trim()

      return code ? { name, code } : { name }
    })
}

function toInt(text: string | undefined): number {
  const n = Number.parseInt((text ?? "").replaceAll(/\D/g, ""), 10)

  return Number.isNaN(n) ? 0 : n
}

function addCounts(
  tally: HoldingsTally,
  branch: string,
  total: number,
  checkedOut: number
): void {
  const available = Math.max(total - checkedOut, 0)
  if (!branch.trim() || available + checkedOut === 0) return
  if (available > 0) tally.add(branch, true, available)
  if (checkedOut > 0) tally.add(branch, false, checkedOut)
}

/** Holdings rendered straight into the item page (older installations). */
function inlineHoldings($: cheerio.CheerioAPI, tally: HoldingsTally): void {
  $(".arena-availability-viewbranch").each((_, el) => {
    const row = $(el)
    const spans = row.find(".arena-availability-info span")
    addCounts(
      tally,
      row.find(".arena-branch-name span").text(),
      toInt(spans.eq(0).text()),
      toInt(spans.eq(1).text())
    )
  })
}

/** Holdings panel that lists per-branch counts without further requests. */
function panelHoldings($: cheerio.CheerioAPI, tally: HoldingsTally): void {
  $(".arena-holding-child-container").each((_, el) => {
    const c = $(el)
    const value = (cls: string) => c.find(`${cls} span.arena-value`).text()
    const checkedOut = toInt(value(".arena-holding-nof-checked-out"))
    const totalText = value(".arena-holding-nof-total")
    const total = totalText
      ? toInt(totalText)
      : toInt(value(".arena-holding-nof-available-for-loan")) + checkedOut
    addCounts(
      tally,
      c.find("span.arena-holding-link").text(),
      total,
      checkedOut
    )
  })
}

/** The Wicket page id embedded in a holdings link's resource id. */
function interfaceIdFrom(href: string): string | undefined {
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : href
  const resourceId =
    new URLSearchParams(query.replaceAll("&amp;", "&")).get(
      "p_p_resource_id"
    ) ?? href

  return /wicket:interface=:(\d+):/.exec(resourceId)?.[1]
}

async function organisationHoldings(
  config: CatalogueConfig,
  $: cheerio.CheerioAPI,
  http: CatalogueHttp,
  tally: HoldingsTally
): Promise<void> {
  const links = $(
    ".arena-holding-hyper-container .arena-holding-container a span"
  ).toArray()
  if (links.length === 0) return

  const wanted = config.settings.organisationName
  let index = -1
  if (typeof wanted === "string" && wanted)
    index = links.findIndex(
      (s) => $(s).text().trim().toLowerCase() === wanted.trim().toLowerCase()
    )
  else if (links.length === 1) index = 0
  else
    throw new CatalogueError(
      "parse",
      "Arena lists several organisations; set settings.organisationName"
    )
  if (index === -1) return

  const link = $(links[index]).parent()
  const interfaceId = interfaceIdFrom(link.attr("href") ?? "")
  if (!interfaceId)
    throw new CatalogueError("parse", "Arena holdings link has no Wicket id")

  const recordPanel =
    typeof config.settings.recordPanel === "string"
      ? config.settings.recordPanel
      : DEFAULT_RECORD_PANEL
  // Upstream's quirk, kept: holdingsView rows are 1-based relative to the links.
  const viewPath = `/crDetailWicket/?wicket:interface=:${interfaceId}:${recordPanel}:content:holdingsView:${index + 1}`
  const url = joinUrl(config.baseUrl, RESULTS_PATH)

  const orgRes = await http.post(
    url,
    resourceForm(
      "crDetailWicket_WAR_arenaportlet",
      `${viewPath}:holdingContainer:togglableLink::IBehaviorListener:0:`
    ),
    { headers: wicketHeaders(link.attr("id")) }
  )
  const orgHtml = ajaxComponents(orgRes.text)[0]
  if (!orgHtml) return
  const $org = cheerio.load(orgHtml)

  const branches = $org(".arena-holding-container").toArray()
  for (const [i, cont] of branches.entries()) {
    const res = await http.post(
      url,
      resourceForm(
        "crDetailWicket_WAR_arenaportlet",
        `${viewPath}:childContainer:childView:${i}:holdingPanel:holdingContainer:togglableLink::IBehaviorListener:0:`
      ),
      { headers: wicketHeaders($org(cont).find("a").first().attr("id")) }
    )
    const parts = ajaxComponents(res.text).map((html) => cheerio.load(html))
    const counts = parts.find((p) => p(".arena-holding-nof-total").length > 0)
    if (!counts) continue
    const branch =
      $org(cont).find("span.arena-holding-link").first().text().trim() ||
      (parts[2]?.("span.arena-holding-link").first().text().trim() ?? "")
    addCounts(
      tally,
      branch,
      toInt(counts(".arena-holding-nof-total span.arena-value").first().text()),
      toInt(
        counts(".arena-holding-nof-checked-out span.arena-value").first().text()
      )
    )
  }
}

export const arena: CatalogueConnector = {
  system: "arena",

  async listBranches(config, http) {
    const { signupUrl, advancedUrl, organisationId } = config.settings

    // Some installations only list branches on the self-registration page.
    if (typeof signupUrl === "string" && signupUrl) {
      const res = await http.get(new URL(signupUrl, config.baseUrl).toString())
      const $ = cheerio.load(res.text)
      const options = 'select[name="branches-div:choiceBranch"] option'
      if ($(options).length > 1)
        return uniqueBranches(optionBranches($, options))
    }

    const searchUrl = joinUrl(
      config.baseUrl,
      typeof advancedUrl === "string" && advancedUrl
        ? advancedUrl
        : "extended-search"
    )
    const res = await http.get(searchUrl)
    const $ = cheerio.load(res.text)
    const branchOptions = ".arena-extended-search-branch-choice option"
    if ($(branchOptions).length > 1)
      return uniqueBranches(optionBranches($, branchOptions))

    // Otherwise the branch list arrives when an organisation is chosen.
    const orgSelect = $(".arena-extended-search-organisation-choice")
    if (orgSelect.length === 0)
      throw new CatalogueError("parse", "No Arena extended search form found")

    const xml = await http.post(
      searchUrl,
      resourceForm("extendedSearch_WAR_arenaportlet", ORGANISATION_RESOURCE, {
        "organisationHierarchyPanel:organisationContainer:organisationChoice":
          typeof organisationId === "string" ? organisationId : "",
      }),
      { headers: wicketHeaders(orgSelect.attr("id")) }
    )
    const components = ajaxComponents(xml.text)
    if (components.length === 0)
      throw new CatalogueError("parse", "Arena returned no branch list")
    const html =
      components.find((c) =>
        c.includes("arena-extended-search-branch-choice")
      ) ?? components[0]!
    const $branches = cheerio.load(html)

    return uniqueBranches(optionBranches($branches, "option"))
  },

  async searchByIsbn(config, isbn, http) {
    const { searchType, isbnAlias, organisationId, arenaName, holdingsPanel } =
      config.settings

    const index =
      typeof isbnAlias === "string" && isbnAlias ? isbnAlias : "number"
    let query = searchType === "Keyword" ? isbn : `${index}_index:${isbn}`
    if (typeof organisationId === "string" && organisationId)
      query = `organisationId_index:${encodeURIComponent(organisationId)}+AND+${query}`

    // A challenge page here raises CatalogueError("bot_challenge") in CatalogueHttp.
    const searchRes = await http.get(
      joinUrl(config.baseUrl, SEARCH_PATH + query)
    )
    const resultsText = searchRes.text
      .replaceAll(String.raw`\x3d`, "=")
      .replaceAll(String.raw`\x26`, "&")
    const ids = [...resultsText.matchAll(/search_item_id=([^&"'\s<>]+)/g)]
    const recordId = ids.at(-1)?.[1]
    if (!recordId) return { found: false, holdings: [] }

    const recordUrl = joinUrl(
      config.baseUrl,
      ITEM_PATH.replace("[ITEMID]", encodeURIComponent(recordId)).replace(
        "[ARENANAME]",
        encodeURIComponent(typeof arenaName === "string" ? arenaName : "")
      )
    )
    const itemRes = await http.get(recordUrl)
    const tally = new HoldingsTally()
    let $ = cheerio.load(itemRes.text)

    if ($(".arena-availability-viewbranch").length > 0) {
      inlineHoldings($, tally)

      return { found: true, recordId, recordUrl, holdings: tally.toArray() }
    }

    const panelRes = await http.post(
      joinUrl(config.baseUrl, RESULTS_PATH),
      resourceForm(
        "crDetailWicket_WAR_arenaportlet",
        typeof holdingsPanel === "string" && holdingsPanel
          ? holdingsPanel
          : HOLDINGS_PANEL_RESOURCE
      ),
      { headers: wicketHeaders() }
    )
    const panelHtml = ajaxComponents(panelRes.text)[0]
    if (!panelHtml) return { found: true, recordId, recordUrl, holdings: [] }
    $ = cheerio.load(panelHtml)

    if (
      $(
        ".arena-holding-nof-total, .arena-holding-nof-checked-out, .arena-holding-nof-available-for-loan"
      ).length > 0
    )
      panelHoldings($, tally)
    else await organisationHoldings(config, $, http, tally)

    return { found: true, recordId, recordUrl, holdings: tally.toArray() }
  },
}
