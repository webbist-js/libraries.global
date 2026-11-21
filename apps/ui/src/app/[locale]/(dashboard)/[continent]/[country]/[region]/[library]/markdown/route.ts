import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type LibrarySourceRecord,
} from "@repo/shared-data"

import { buildLibraryPath } from "@/lib/library-helpers"
import { renderLibraryMarkdown } from "@/lib/library-markdown"
import { localizedPath, publicCanonicalUrl } from "@/lib/seo/metadata"
import { fetchDataset } from "@/lib/strapi-api/content/datasets"
import { fetchPublishedLibrary } from "@/lib/strapi-api/content/server"

export const dynamic = "force-dynamic"

const headers = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, follow",
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      locale: string
      continent: string
      country: string
      region: string
      library: string
    }>
  }
) {
  const { locale, continent, country, region, library: slug } = await params
  if (!isSupportedLocale(locale))
    return new Response("Library not found\n", { status: 404, headers })

  try {
    const result = await fetchPublishedLibrary(slug, locale)
    const library = result?.data
    if (!library)
      return new Response("Library not found\n", { status: 404, headers })

    const requestedPath = `/${continent}/${country}/${region}/${slug}`
    const canonicalPath = buildLibraryPath(library) ?? requestedPath
    if (canonicalPath !== requestedPath)
      return new Response(null, {
        status: 308,
        headers: {
          ...headers,
          Location: new URL(
            `${localizedPath(canonicalPath, locale)}.md`,
            request.url
          ).href,
        },
      })

    const datasetKeys = [
      ...new Set(
        ((library.sourceRecords ?? []) as LibrarySourceRecord[]).flatMap(
          (record) => (record.dataset ? [record.dataset] : [])
        )
      ),
    ]
    const datasets = (
      await Promise.all(datasetKeys.map((key) => fetchDataset(key)))
    ).filter((dataset) => dataset !== null)
    const canonicalUrl = publicCanonicalUrl(
      localizedPath(canonicalPath, locale)
    )
    const language = result.localeFallback ? DEFAULT_LOCALE : locale

    return new Response(
      renderLibraryMarkdown(library, {
        canonicalUrl,
        locale: language,
        datasets,
      }),
      {
        headers: {
          ...headers,
          "Content-Language": language,
          Link: `<${canonicalUrl}>; rel="canonical", <${publicCanonicalUrl("/llms.txt")}>; rel="describedby"`,
        },
      }
    )
  } catch {
    console.error("[library-markdown] published record unavailable")

    return new Response("Library record temporarily unavailable\n", {
      status: 503,
      headers,
    })
  }
}
