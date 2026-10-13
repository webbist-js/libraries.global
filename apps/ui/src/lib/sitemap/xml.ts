import { MAX_SITEMAP_BYTES, MAX_SITEMAP_URLS } from "./files"

/** One `<url>` of a sitemap file. */
export type SitemapEntry = {
  url: string
  lastModified?: string
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never"
  priority?: number
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
}

export function escapeXml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (c) => XML_ESCAPES[c]!)
}

const HEAD = `<?xml version="1.0" encoding="UTF-8"?>\n`
const NS = `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`

export function urlsetXml(entries: SitemapEntry[]): string {
  if (entries.length > MAX_SITEMAP_URLS)
    throw new Error("Sitemap URL limit exceeded")
  const urls = entries.map((e) => {
    const parts = [`<loc>${escapeXml(e.url)}</loc>`]
    if (e.lastModified)
      parts.push(`<lastmod>${escapeXml(e.lastModified)}</lastmod>`)
    if (e.changeFrequency)
      parts.push(`<changefreq>${e.changeFrequency}</changefreq>`)
    if (e.priority !== undefined)
      parts.push(`<priority>${e.priority}</priority>`)

    return `<url>${parts.join("")}</url>`
  })

  return checkedXml(`${HEAD}<urlset ${NS}>\n${urls.join("\n")}\n</urlset>\n`)
}

export function sitemapIndexXml(locations: string[]): string {
  if (locations.length > MAX_SITEMAP_URLS)
    throw new Error("Sitemap index limit exceeded")
  const files = locations.map(
    (loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`
  )

  return checkedXml(
    `${HEAD}<sitemapindex ${NS}>\n${files.join("\n")}\n</sitemapindex>\n`
  )
}

function checkedXml(xml: string): string {
  if (Buffer.byteLength(xml, "utf8") > MAX_SITEMAP_BYTES)
    throw new Error("Sitemap byte limit exceeded")

  return xml
}
