import * as cheerio from "cheerio"

import { CatalogueError, type CatalogueConnector } from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Aspen Discovery. Ported from LibrariesHacked/catalogues-library (connectors/aspen.js).
 * Changes:
 * - branches come from the "Library Hours & Locations" modal, which lists every
 *   location with its id (returned as `code`); the advanced-search "Library"
 *   facet that upstream reads is truncated to a handful of entries ("More
 *   options..."), so it is only used as a fallback;
 * - copy rows are keyed "<branch> - <collection> - <shelf>"; we tally by the
 *   branch part so the names line up with `listBranches`;
 * - the copy-details format comes from the result's own `showCopyDetails(...)`
 *   call instead of being hardcoded to "Book";
 * - no results returns `{ found: false }` instead of throwing.
 */

const ADVANCED_SEARCH_PATH =
  "Union/Search?view=list&lookfor=&searchIndex=advanced&searchSource=local"
const HOURS_PATH = "AJAX/JSON?method=getHoursAndLocations"

function searchPath(isbn: string): string {
  return `Union/Search?view=list&lookfor=${encodeURIComponent(isbn)}&searchIndex=Keyword&searchSource=local`
}

/** Aspen's AJAX endpoints return either bare HTML or `{ modalBody: html }`. */
function modalHtml(text: string): string {
  const t = text.trimStart()
  if (!t.startsWith("{")) return text
  try {
    const body = JSON.parse(t) as { modalBody?: unknown; body?: unknown }
    const html = body.modalBody ?? body.body

    return typeof html === "string" ? html : ""
  } catch {
    throw new CatalogueError("parse", "Unexpected Aspen AJAX response")
  }
}

export const aspen: CatalogueConnector = {
  system: "aspen",

  async listBranches(config, http) {
    const hours = await http.get(joinUrl(config.baseUrl, HOURS_PATH), {
      allowStatus: [404],
    })
    if (hours.status === 200) {
      const $ = cheerio.load(modalHtml(hours.text))
      const branches = uniqueBranches(
        $("#selectLibraryHours option")
          .toArray()
          .map((o) => {
            const name = $(o).text().trim()
            const code = $(o).attr("value")?.trim()

            return code ? { name, code } : { name }
          })
      )
      if (branches.length > 0) return branches
    }

    // Fallback: the "Library" facet on the advanced search page (may be truncated).
    const res = await http.get(joinUrl(config.baseUrl, ADVANCED_SEARCH_PATH))
    const $ = cheerio.load(res.text)

    return uniqueBranches(
      $("option")
        .toArray()
        .filter((o) => ($(o).attr("value") ?? "").includes("owning_location:"))
        .map((o) => ({ name: $(o).text().trim() }))
    )
  },

  async searchByIsbn(config, isbn, http) {
    const res = await http.get(joinUrl(config.baseUrl, searchPath(isbn)))
    const $ = cheerio.load(res.text)

    const first = $(".resultsList").first()
    const recordId = first.find("a[id^='record']").first().attr("id")?.slice(6)
    if (!recordId) return { found: false, holdings: [] }

    const recordUrl = joinUrl(config.baseUrl, `GroupedWork/${recordId}/Home`)

    // e.g. showCopyDetails('<id>', 'Book', '<id>') — first manifestation of the first result.
    const call =
      /showCopyDetails\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/.exec(
        $.html(first)
      )
    const format = call?.[2] ?? "Book"
    const copyRecordId = call?.[3] ?? recordId

    const copies = await http.get(
      joinUrl(
        config.baseUrl,
        `GroupedWork/${recordId}/AJAX?method=getCopyDetails&format=${encodeURIComponent(format)}&recordId=${encodeURIComponent(copyRecordId)}`
      ),
      { headers: { Accept: "application/json" } }
    )
    const c$ = cheerio.load(modalHtml(copies.text))

    const tally = new HoldingsTally()
    c$("table tbody tr").each((_, tr) => {
      const cells = c$(tr).find("td")
      const counts = /(\d+)\s+of\s+(\d+)/.exec(cells.eq(0).text())
      if (!counts) return
      const available = Number(counts[1])
      const total = Number(counts[2])
      const branch = cells.eq(1).text().trim().split(" - ")[0] ?? ""
      if (available > 0) tally.add(branch, true, available)
      if (total > available) tally.add(branch, false, total - available)
    })

    return { found: true, recordId, recordUrl, holdings: tally.toArray() }
  },
}
