import { sitemapEnabled, sitemapEntries } from "@/lib/sitemap/entries"
import { parseSitemapFileName } from "@/lib/sitemap/files"
import { notFound, unavailable, xmlResponse } from "@/lib/sitemap/response"
import { urlsetXml } from "@/lib/sitemap/xml"

export const dynamic = "force-dynamic"

/** One sitemap file, e.g. /sitemaps/libraries-en-3.xml. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
): Promise<Response> {
  if (!sitemapEnabled()) return notFound()
  const file = parseSitemapFileName((await params).file)
  if (!file) return notFound()

  try {
    const entries = await sitemapEntries(file)

    return entries ? xmlResponse(urlsetXml(entries)) : notFound()
  } catch {
    return unavailable()
  }
}
