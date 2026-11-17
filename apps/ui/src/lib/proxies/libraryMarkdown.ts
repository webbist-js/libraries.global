import {
  CONTINENTS,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from "@repo/shared-data"
import { type NextRequest, NextResponse } from "next/server"

const LIBRARY_MARKDOWN = new RegExp(
  String.raw`^/(?:(?<locale>${SUPPORTED_LOCALES.join("|")})/)?(?<continent>${CONTINENTS.map((continent) => continent.slug).join("|")})/(?<country>[^/]+)/(?<region>[^/]+)/(?<library>[^/]+)\.md$`
)

/** Route a library's text variant without changing its HTML page URL. */
export function libraryMarkdownRewrite(req: NextRequest): NextResponse | null {
  const match = LIBRARY_MARKDOWN.exec(req.nextUrl.pathname)?.groups
  if (!match) return null
  const url = req.nextUrl.clone()
  url.pathname = `/${match.locale ?? DEFAULT_LOCALE}/${match.continent}/${match.country}/${match.region}/${match.library}/markdown`

  return NextResponse.rewrite(url)
}
