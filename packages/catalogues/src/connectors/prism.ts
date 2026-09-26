import * as cheerio from "cheerio"

import type { CatalogueConnector } from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Capita/Softlink Prism 3. Ported from LibrariesHacked/catalogues-library
 * (connectors/prism3.js).
 * Changes:
 * - branch codes are returned (the `#locdd` option values);
 * - record keys are matched with `includes("/items/")`; upstream's
 *   `indexOf(...) > 0` skipped keys that began with the path;
 * - the record URL is the item page itself rather than a search link, and the
 *   record id falls back to the item URL's last segment;
 * - `settings.availableStatuses` (set in data.json but ignored upstream) also
 *   counts a copy as available when a status cell matches one exactly;
 * - no record, or only eBook records, returns `{ found: false }`.
 */

const AVAILABLE_SCHEMA = new Set([
  "http://schema.org/InStock",
  "http://schema.org/InStoreOnly",
  "https://schema.org/InStock",
  "https://schema.org/InStoreOnly",
])

const DC_FORMAT = "http://purl.org/dc/elements/1.1/format"
const DC_IDENTIFIER = "http://purl.org/dc/terms/identifier"

type RdfJson = Record<string, Record<string, { value?: unknown }[] | undefined>>

function values(record: RdfJson[string], key: string): string[] {
  return (record[key] ?? [])
    .map((v) => (typeof v.value === "string" ? v.value : ""))
    .filter(Boolean)
}

export const prism: CatalogueConnector = {
  system: "prism",

  async listBranches(config, http) {
    const res = await http.get(
      joinUrl(config.baseUrl, "advancedsearch?target=catalogue")
    )
    const $ = cheerio.load(res.text)

    return uniqueBranches(
      $("#locdd option")
        .toArray()
        .map((o) => {
          const name = $(o).text().trim()
          const code = $(o).attr("value")?.trim()

          return code ? { name, code } : { name }
        })
    )
  },

  async searchByIsbn(config, isbn, http) {
    const res = await http.get(
      joinUrl(config.baseUrl, `items.json?query=${encodeURIComponent(isbn)}`),
      { headers: { Accept: "application/json" } }
    )
    const body = res.json<RdfJson | unknown[]>()
    if (Array.isArray(body) || typeof body !== "object" || body === null)
      return { found: false, holdings: [] }

    let itemUrl: string | undefined
    let recordId: string | undefined
    for (const [key, record] of Object.entries(body)) {
      if (!key.includes("/items/") || !record) continue
      const formats = values(record, DC_FORMAT)
      // One record can hold several formats; skip it only if every one is an eBook.
      if (formats.length > 0 && formats.every((f) => f === "eBook")) continue
      itemUrl = new URL(key, config.baseUrl).toString()
      recordId =
        values(record, DC_IDENTIFIER)[0] ??
        itemUrl
          .replace(/[?#].*$/, "")
          .split("/")
          .findLast(Boolean)
      break
    }
    if (!itemUrl) return { found: false, holdings: [] }

    const itemRes = await http.get(itemUrl)
    const $ = cheerio.load(itemRes.text)
    const extra = new Set(
      (config.settings.availableStatuses ?? []).map((s) =>
        s.trim().toLowerCase()
      )
    )
    const tally = new HoldingsTally()
    $("#availability ul.options > li").each((_, li) => {
      const branch = $(li).find("h3 span span").first().text().trim()
      $(li)
        .find("div.jsHidden table tbody tr")
        .each((_, tr) => {
          const schema =
            $(tr).find("link[itemprop='availability']").attr("href") ?? ""
          const byText = $(tr)
            .find("td")
            .toArray()
            .some((td) => extra.has($(td).text().trim().toLowerCase()))
          tally.add(branch, AVAILABLE_SCHEMA.has(schema) || byText)
        })
    })

    return {
      found: true,
      recordId,
      recordUrl: itemUrl,
      holdings: tally.toArray(),
    }
  },
}
