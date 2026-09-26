import * as cheerio from "cheerio"

import type { CatalogueConfig, CatalogueConnector } from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Civica Spydus. Ported from LibrariesHacked/catalogues-library (connectors/spydus.js).
 * Changes: branch codes are kept (option values are "<code>*<name>"), and the
 * record URL is the stable ISBN search link rather than a session-scoped one.
 */

const COOKIE_CONSENT = { Cookie: "ALLOWCOOKIES_443=1" }

function opacPath(config: CatalogueConfig, path: string): string {
  let p = path
  if (config.settings.opacReference)
    p = p.replace("/WPAC/", `/${config.settings.opacReference}/`)
  if (config.settings.catalogueReference)
    p = p.replace("/COMB", `/${config.settings.catalogueReference}`)

  return joinUrl(config.baseUrl, p)
}

export const spydus: CatalogueConnector = {
  system: "spydus",

  async listBranches(config, http) {
    const res = await http.get(
      opacPath(config, "cgi-bin/spydus.exe/MSGTRN/WPAC/COMB"),
      { headers: COOKIE_CONSENT }
    )
    const $ = cheerio.load(res.text)

    return uniqueBranches(
      $("#LOC option")
        .toArray()
        .map((o) => {
          const name = $(o).text().trim()
          const value = $(o).attr("value") ?? ""
          const code = value.includes("*") ? value.split("*")[0] : undefined

          return code ? { name, code } : { name }
        })
    )
  },

  async searchByIsbn(config, isbn, http) {
    const searchUrl = opacPath(
      config,
      `cgi-bin/spydus.exe/ENQ/WPAC/BIBENQ?NRECS=1&ISBN=${isbn}`
    )
    const res = await http.get(searchUrl, { headers: COOKIE_CONSENT })
    let $ = cheerio.load(res.text)

    const first = $("#result-content-list .card.card-list").first()
    if (first.length === 0) return { found: false, holdings: [] }

    const recordId =
      first.find("a[name]").attr("name") ??
      first.find("input.form-check-input").attr("value")

    const holdingsHref = first
      .find(".card-text.availability a")
      .first()
      .attr("href")
    if (!holdingsHref)
      return { found: true, recordId, recordUrl: searchUrl, holdings: [] }

    const holdingsRes = await http.get(
      new URL(holdingsHref, res.url).toString(),
      {
        headers: COOKIE_CONSENT,
      }
    )
    $ = cheerio.load(holdingsRes.text)

    const tally = new HoldingsTally()
    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td")
      const branch = cells.eq(0).text().trim()
      const status = cells.eq(3).text().trim()
      tally.add(branch, /^available/i.test(status))
    })

    return {
      found: true,
      recordId,
      recordUrl: searchUrl,
      holdings: tally.toArray(),
    }
  },
}
