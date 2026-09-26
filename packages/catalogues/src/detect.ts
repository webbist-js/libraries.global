import type { CatalogueHttp } from "./http"
import type { CatalogueConfig, CatalogueSystem } from "./types"

/**
 * Works out which catalogue system a URL belongs to.
 *
 * `detectFromUrl` is pure and handles hosted platforms with recognisable URLs.
 * `detectCatalogue` falls back to fetching the page and fingerprinting the HTML,
 * which is needed for self-hosted systems on council domains (Aspen, LUCI, Koha).
 *
 * Detection gives a best-effort config. Some systems (Arena especially) need
 * per-installation settings that can't be inferred, so treat the result as a
 * candidate to verify with `listBranches` before relying on it.
 */

export interface DetectedCatalogue extends CatalogueConfig {
  /** How the system was identified. */
  via: "url" | "html"
  /** Settings a human still needs to fill in before this catalogue works. */
  missingSettings: string[]
}

function detected(
  system: CatalogueSystem,
  baseUrl: string,
  via: DetectedCatalogue["via"],
  extra: Partial<Omit<DetectedCatalogue, "system" | "baseUrl" | "via">> = {}
): DetectedCatalogue {
  return {
    system,
    baseUrl,
    via,
    settings: extra.settings ?? {},
    missingSettings: extra.missingSettings ?? [],
    ...(extra.version ? { version: extra.version } : {}),
  }
}

export const ENTERPRISE_DEFAULT_AVAILABILITY_URL =
  "search/detailnonmodal.detail.detailavailabilityaccordions:lookuptitleinfo/ent:[ITEMID]/ILS/0/true/true"

/** Statuses seen across UK Enterprise installations that mean "on the shelf". */
export const ENTERPRISE_DEFAULT_AVAILABLE = [
  "Available",
  "AVAILABLE",
  "In stock",
  "On Shelf",
  "On the shelf",
  "SHELVES",
]

export function detectFromUrl(raw: string): DetectedCatalogue | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const origin = `${url.protocol}//${url.host}/`
  const host = url.hostname.toLowerCase()
  const path = url.pathname

  // Spydus: hosted on *.spydus.co.uk or anywhere under /cgi-bin/spydus.exe
  if (/\.spydus\.(co\.uk|com)$/.test(host) || path.includes("/spydus.exe")) {
    const seg = /\/spydus\.exe\/[^/]+\/([^/]+)\//i.exec(path)?.[1]
    const settings =
      seg && seg.toUpperCase() !== "WPAC" ? { opacReference: seg } : {}

    return detected("spydus", origin, "url", { settings })
  }

  // SirsiDynix Enterprise: /client/<locale>/<profile>/
  const ent = /^\/client\/([a-z]{2}_[A-Z]{2})\/([^/]+)\//.exec(path)
  if (ent || host.endsWith(".sirsidynix.net.uk")) {
    const base = ent ? `${origin}client/${ent[1]}/${ent[2]}/` : origin

    return detected("enterprise", base, "url", {
      settings: {
        availabilityUrl: ENTERPRISE_DEFAULT_AVAILABILITY_URL,
        availableStatuses: ENTERPRISE_DEFAULT_AVAILABLE,
      },
      missingSettings: ent
        ? []
        : ["baseUrl profile (/client/en_GB/<profile>/)"],
    })
  }

  // Prism 3: hosted on librarymanagementcloud / capitadiscovery, one path per service
  if (
    host === "prism.librarymanagementcloud.co.uk" ||
    host.endsWith(".capitadiscovery.co.uk")
  ) {
    const first = path.split("/").find(Boolean)
    const base =
      host === "prism.librarymanagementcloud.co.uk" && first
        ? `${origin}${first}/`
        : origin

    return detected("prism", base, "url", {
      settings: { availableStatuses: ["Available"] },
    })
  }

  // Koha OPAC
  if (path.includes("/cgi-bin/koha/")) return detected("koha", origin, "url")

  // Iguana (Infor/Vubis)
  if (/^\/iguana\//i.test(path))
    return detected("iguana", `${origin}iguana/`, "url", {
      settings: { database: "1" },
    })

  // Axiell Arena (Liferay): /web/<site>/
  const arena = /^\/web\/([^/]+)\//.exec(path)
  if (arena && (host.includes("arena") || arena[1] === "arena"))
    return detected("arena", `${origin}web/${arena[1]}/`, "url", {
      settings: { advancedUrl: "extended-search" },
      missingSettings: ["arenaName", "organisationId"],
    })

  // Aspen Discovery URL shapes
  if (/^\/(Union\/Search|GroupedWork\/)/.test(path))
    return detected("aspen", origin, "url")

  return null
}

/** Fingerprints a catalogue homepage when the URL alone isn't conclusive. */
export function detectFromHtml(
  html: string,
  pageUrl: string
): DetectedCatalogue | null {
  const url = new URL(pageUrl)
  const origin = `${url.protocol}//${url.host}/`

  const koha = /<meta name="generator" content="Koha ([\d.]+)/i.exec(html)
  if (koha || html.includes("/cgi-bin/koha/opac-"))
    return detected("koha", origin, "html", {
      ...(koha ? { version: koha[1]!.split(".")[0] } : {}),
    })

  if (/Aspen Discovery/i.test(html) || html.includes("/Union/Search"))
    return detected("aspen", origin, "html")

  if (html.includes("spydus.exe")) return detected("spydus", origin, "html")

  if (html.includes("arenaportlet") || html.includes("arena_portlet")) {
    const site = /\/web\/([^/"']+)\//.exec(html)?.[1] ?? "arena"

    return detected("arena", `${origin}web/${site}/`, "html", {
      settings: { advancedUrl: "extended-search" },
      missingSettings: ["arenaName", "organisationId"],
    })
  }

  // LUCI is a Next.js app; its build manifest plus Solus/LUCI branding
  if (html.includes("/_next/static/") && /\b(LUCI|Solus)\b/.test(html))
    return detected("luci", origin, "html", {
      settings: { home: "home" },
    })

  if (/\/iguana\/www\./i.test(html))
    return detected("iguana", `${origin}iguana/`, "html", {
      settings: { database: "1" },
    })

  return null
}

export async function detectCatalogue(
  url: string,
  http: CatalogueHttp
): Promise<DetectedCatalogue | null> {
  const fromUrl = detectFromUrl(url)
  if (fromUrl) return fromUrl

  const page = await http.get(url)

  return (
    detectFromUrl(page.url) ??
    page.redirects.map(detectFromUrl).find(Boolean) ??
    detectFromHtml(page.text, page.url)
  )
}
