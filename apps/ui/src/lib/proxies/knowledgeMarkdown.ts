import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@repo/shared-data"
import { type NextRequest, NextResponse } from "next/server"

const ARTICLE_MARKDOWN = new RegExp(
  String.raw`^/(?:(?<locale>${SUPPORTED_LOCALES.join("|")})/)?knowledge/(?<section>[^/]+)/(?<slug>[^/]+)\.md$`
)

/** Called after the access gates; keep .md out of the HTML article route. */
export function knowledgeMarkdownRewrite(
  req: NextRequest
): NextResponse | null {
  const match = ARTICLE_MARKDOWN.exec(req.nextUrl.pathname)?.groups
  if (!match) return null
  const url = req.nextUrl.clone()
  url.pathname = `/${match.locale ?? DEFAULT_LOCALE}/knowledge/${match.section}/${match.slug}/markdown`

  return NextResponse.rewrite(url)
}
