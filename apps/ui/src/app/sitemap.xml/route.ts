import { getSiteUrl } from "@/lib/seo/metadata"
import { sitemapEnabled, sitemapFiles } from "@/lib/sitemap/entries"
import { sitemapFileName } from "@/lib/sitemap/files"
import { notFound, unavailable, xmlResponse } from "@/lib/sitemap/response"
import { sitemapIndexXml } from "@/lib/sitemap/xml"

export const dynamic = "force-dynamic"

/** The sitemap index: one entry per file under /sitemaps (see lib/sitemap/files). */
export async function GET(): Promise<Response> {
  if (!sitemapEnabled()) return notFound()

  try {
    const files = await sitemapFiles()

    return xmlResponse(
      sitemapIndexXml(
        files.map((f) => `${getSiteUrl()}/sitemaps/${sitemapFileName(f)}`)
      )
    )
  } catch {
    return unavailable()
  }
}
