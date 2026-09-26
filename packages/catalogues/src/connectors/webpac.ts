import * as cheerio from "cheerio"
import type { CheerioAPI } from "cheerio"

import type { CatalogueConfig, CatalogueConnector } from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Innovative (III) WebPAC Pro. Ported from LibrariesHacked/catalogues-library
 * (connectors/webpac.js).
 * Changes:
 * - branch codes are kept (the searchscope option value);
 * - `{ found: false }` for the "No matches found; nearby ISBNs" browse page
 *   (upstream threw reading the missing record link);
 * - a brief-citation hit list is followed to its first record;
 * - recordId is the bib number ("b1200817") and recordUrl the /record= permalink;
 * - `availableStatuses` can override the default "AVAILABLE" / "FOR LOAN".
 */

const DEFAULT_AVAILABLE = ["AVAILABLE", "FOR LOAN"]

function recordNumber($: CheerioAPI): string | undefined {
  const href = $("#recordnum").attr("href") ?? ""

  return /record=([a-z0-9]+)/i.exec(href)?.[1]
}

function isAvailable(config: CatalogueConfig, status: string): boolean {
  const statuses = (config.settings.availableStatuses ?? DEFAULT_AVAILABLE).map(
    (s) => s.toUpperCase()
  )

  return statuses.includes(status.trim().toUpperCase())
}

export const webpac: CatalogueConnector = {
  system: "webpac",

  async listBranches(config, http) {
    const res = await http.get(joinUrl(config.baseUrl, "search/X"))
    const $ = cheerio.load(res.text)

    return uniqueBranches(
      $('select[name="searchscope"] option')
        .toArray()
        .map((o) => {
          const name = $(o).text().trim()
          const code = $(o).attr("value")?.trim()

          return code ? { name, code } : { name }
        })
    )
  },

  async searchByIsbn(config, isbn, http) {
    const searchUrl = joinUrl(
      config.baseUrl,
      `search~S1/?searchtype=i&searcharg=${encodeURIComponent(isbn)}`
    )
    const res = await http.get(searchUrl)
    let $ = cheerio.load(res.text)
    let recordId = recordNumber($)

    if (!recordId) {
      // Several records share the ISBN: follow the first brief citation.
      const href = $(".briefcitTitle a").first().attr("href")
      if (!href) return { found: false, holdings: [] }
      const recordRes = await http.get(new URL(href, res.url).toString())
      $ = cheerio.load(recordRes.text)
      recordId = recordNumber($)
      if (!recordId) return { found: false, holdings: [] }
    }

    const tally = new HoldingsTally()
    $("table.bibItems tr.bibItemsEntry").each((_, tr) => {
      const cells = $(tr).find("td")
      tally.add(
        cells.eq(0).text().trim(),
        isAvailable(config, cells.eq(3).text())
      )
    })

    return {
      found: true,
      recordId,
      recordUrl: joinUrl(config.baseUrl, `record=${recordId}`),
      holdings: tally.toArray(),
    }
  },
}
