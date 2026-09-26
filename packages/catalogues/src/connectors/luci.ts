import type { CatalogueHttp } from "../http"
import {
  CatalogueError,
  type CatalogueBranch,
  type CatalogueConfig,
  type CatalogueConnector,
} from "../types"
import { HoldingsTally, joinUrl, uniqueBranches } from "./common"

/**
 * Solus LUCI (a Next.js app). Ported from LibrariesHacked/catalogues-library
 * (connectors/luci.js).
 * Changes:
 * - LUCI sites moved to the Next.js App Router, so `_next/data/<buildId>/…json`
 *   no longer exists. Branches are read from the patron fields embedded in the
 *   registration page instead (RSC flight data, or `__NEXT_DATA__` on older
 *   Pages Router builds);
 * - search uses `api/results` (upstream's `api/manifestations/searchresult`
 *   now 404s) and the record response is read with or without its old `data`
 *   wrapper;
 * - branch codes are kept (`key` in the option list), holdings respect a
 *   copy's `count`, and the record URL is `manifestations/<id>?source=…`.
 */

interface LuciOption {
  key?: string
  value?: string
}

interface LuciRecord {
  recordID: string
  isbnList?: string[]
  isbn?: string
  eContent?: boolean
  source?: string
}

interface LuciCopy {
  location?: { locationName?: string; locationID?: string }
  available?: boolean
  count?: number
}

/** Text of the page's Next.js payload, with RSC string chunks decoded. */
function nextPayload(html: string): string {
  const chunks: string[] = []
  for (const m of html.matchAll(
    /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g
  )) {
    try {
      chunks.push(JSON.parse(m[1]!) as string)
    } catch {
      // A chunk we can't decode can't hold the field list either.
    }
  }
  const nextData = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(
    html
  )?.[1]
  if (nextData) chunks.push(nextData)

  return chunks.join("")
}

/** Returns the JSON array starting at `start` (which must be `[`). */
function sliceJsonArray(text: string, start: number): string | undefined {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === "\\") i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === "[") depth++
    else if (ch === "]" && --depth === 0) return text.slice(start, i + 1)
  }

  return undefined
}

/** Record ids look like "69DC…:57836"; colons are legal in paths and queries. */
function enc(value: string): string {
  return encodeURIComponent(value).replaceAll("%3A", ":")
}

function homeLocations(payload: string): LuciOption[] {
  const field = payload.indexOf('"patron_homeLocation"')
  if (field === -1) return []
  const list = payload.indexOf('"optionList":', field)
  if (list === -1) return []
  const json = sliceJsonArray(payload, payload.indexOf("[", list))
  if (!json) return []
  try {
    return JSON.parse(json) as LuciOption[]
  } catch {
    return []
  }
}

async function appId(
  config: CatalogueConfig,
  http: CatalogueHttp
): Promise<string> {
  const home =
    typeof config.settings.home === "string" ? config.settings.home : ""
  const res = await http.get(joinUrl(config.baseUrl, home))
  const id = /[?&](?:amp;)?appid=([a-f0-9-]+)/i.exec(res.text)?.[1]
  if (!id) throw new CatalogueError("parse", "No LUCI app id on the home page")

  return id
}

export const luci: CatalogueConnector = {
  system: "luci",

  async listBranches(config, http) {
    const res = await http.get(joinUrl(config.baseUrl, "user/register"))
    const options = homeLocations(nextPayload(res.text))
    if (options.length === 0)
      throw new CatalogueError("parse", "No LUCI home-location list found")

    return uniqueBranches(
      options.map((o): CatalogueBranch => {
        const name = (o.value ?? "").trim()
        const code = (o.key ?? "").trim()

        return code ? { name, code } : { name }
      })
    )
  },

  async searchByIsbn(config, isbn, http) {
    const id = await appId(config, http)
    const headers = { "Content-Type": "application/json", "solus-app-id": id }

    const search = await http.post(
      joinUrl(config.baseUrl, "api/results"),
      JSON.stringify({
        searchTerm: isbn,
        searchTarget: "",
        searchField: "",
        sortField: "any",
        searchLimit: "",
        offset: 0,
        facets: [],
        count: 40,
      }),
      { headers }
    )
    const records = search.json<{ records?: LuciRecord[] }>().records ?? []
    // Keyword search: other titles come back too. E-content has no branch copies.
    const record = records.find(
      (r) => !r.eContent && (r.isbnList ?? [r.isbn]).includes(isbn)
    )
    if (!record) return { found: false, holdings: [] }

    const source = record.source ?? "ILSWS"
    const recordId = record.recordID
    const recordUrl = joinUrl(
      config.baseUrl,
      `manifestations/${enc(recordId)}?source=${enc(source)}`
    )

    const detail = await http.get(
      joinUrl(
        config.baseUrl,
        `api/record?id=${enc(recordId)}&source=${enc(source)}`
      ),
      { headers: { "solus-app-id": id } }
    )
    const body = detail.json<{
      copies?: LuciCopy[]
      data?: { copies?: LuciCopy[] }
    }>()
    const copies = body.copies ?? body.data?.copies ?? []

    const tally = new HoldingsTally()
    for (const copy of copies) {
      const count =
        typeof copy.count === "number" && copy.count > 0 ? copy.count : 1
      tally.add(
        copy.location?.locationName ?? "",
        copy.available === true,
        count
      )
    }

    return { found: true, recordId, recordUrl, holdings: tally.toArray() }
  },
}
