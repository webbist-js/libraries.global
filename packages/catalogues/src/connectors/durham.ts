import * as cheerio from "cheerio"
import type { CheerioAPI } from "cheerio"

import type { CatalogueHttp } from "../http"
import type { CatalogueConfig, CatalogueConnector } from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Durham County Council's bespoke ASP.NET catalogue. Ported from
 * LibrariesHacked/catalogues-library (connectors/durham.js).
 * Changes:
 * - no random uuid as the record id: the site exposes no stable id or record
 *   URL (results live under a per-session KEY), so both are omitted;
 * - branch codes are kept (BRA_CODE from each library link);
 * - forms are posted with every hidden field they carry, and the no-JS
 *   "Select" button is used when present (the live site serves that variant
 *   to clients without JavaScript), falling back to upstream's link postback;
 * - the pgLogin.aspx JavaScript-check POST is skipped; the cookie-support
 *   redirect on the home page is enough to establish a session.
 *
 * Availability is approximate, as upstream: the location table only says
 * whether a branch has a waiting list, so "No" counts as available.
 */

const FORM = { "Content-Type": "application/x-www-form-urlencoded" }
const P = "ctl00$ctl00$cph1$cph2$"

function hiddenFields($: CheerioAPI): Record<string, string> {
  const fields: Record<string, string> = {}
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr("name")
    if (name) fields[name] = $(el).attr("value") ?? ""
  })

  return fields
}

async function postForm(
  http: CatalogueHttp,
  url: string,
  fields: Record<string, string>
) {
  const res = await http.post(url, new URLSearchParams(fields).toString(), {
    headers: FORM,
  })

  return { url: res.url, $: cheerio.load(res.text) }
}

async function openSession(config: CatalogueConfig, http: CatalogueHttp) {
  await http.get(config.baseUrl)
}

export const durham: CatalogueConnector = {
  system: "durham",

  async listBranches(config, http) {
    await openSession(config, http)
    const res = await http.get(joinUrl(config.baseUrl, "pgLib.aspx"))
    const $ = cheerio.load(res.text)

    return uniqueBranches(
      $("ol.list-unstyled li a")
        .toArray()
        .map((a) => {
          const name = $(a).text().trim()
          const code = /BRA_CODE=([^&#]+)/.exec($(a).attr("href") ?? "")?.[1]

          return code ? { name, code } : { name }
        })
    )
  },

  async searchByIsbn(config, isbn, http) {
    await openSession(config, http)
    const searchUrl = joinUrl(config.baseUrl, "pgCatKeywordSearch.aspx")
    const form = cheerio.load((await http.get(searchUrl)).text)

    const results = await postForm(http, searchUrl, {
      ...hiddenFields(form),
      [`${P}cbBooks`]: "on",
      [`${P}Keywords`]: isbn,
      [`${P}btSearch`]: "Search",
    })

    // Open the first result: a submit button without JS, a link postback with.
    const select = results.$("#cph1_cph2_lvResults_btnSelect_0")
    const link = results.$("#cph1_cph2_lvResults_lnkbtnTitle_0")
    if (select.length === 0 && link.length === 0)
      return { found: false, holdings: [] }

    const openFields: Record<string, string> = hiddenFields(results.$)
    if (select.length > 0)
      openFields[select.attr("name") ?? `${P}lvResults$ctrl0$btnSelect`] =
        select.attr("value") ?? "Select"
    else {
      openFields.__EVENTTARGET = `${P}lvResults$ctrl0$lnkbtnTitle`
      openFields.__EVENTARGUMENT = ""
    }
    const item = await postForm(http, results.url, openFields)

    const librariesButton = item.$('input[name$="btLibraryList"]').first()
    const buttonName = librariesButton.attr("name")
    if (!buttonName) return { found: true, holdings: [] }

    const availability = await postForm(http, item.url, {
      ...hiddenFields(item.$),
      [buttonName]: librariesButton.attr("value") ?? "Libraries",
    })
    const $ = availability.$

    const tally = new HoldingsTally()
    $('[id*="lvLocation"][id*="itemPlaceholderContainer"] table tr').each(
      (_, tr) => {
        const cells = $(tr).find("td")
        if (cells.length < 2) return
        const waitingList = cells.eq(1).text().trim()
        tally.add(cells.eq(0).text().trim(), !/^yes$/i.test(waitingList))
      }
    )

    return { found: true, holdings: tally.toArray() }
  },
}
