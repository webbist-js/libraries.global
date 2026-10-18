/** Public article body and taxonomy rules shared by CMS and reader adapters. */
export type ArticlePlace = {
  documentId: string
  slug?: string
  name?: string
  iso2?: string
  continentDocumentId?: string
  countryDocumentId?: string
  regionDocumentId?: string
}
export type ArticleGeography = Record<
  "continents" | "countries" | "regions" | "areas",
  ArticlePlace[]
>

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** Human text only: media URLs, filenames and machine metadata never count. */
export function articleText(body: unknown): string {
  if (!Array.isArray(body)) return ""
  const text = (node: unknown): string => {
    const n = object(node)
    if (n.type === "text") return typeof n.text === "string" ? n.text : ""
    if (n.type === "hardBreak") return "\n"
    const separator = [
      "paragraph",
      "heading",
      "list-item",
      "text",
      "link",
    ].includes(String(n.type))
      ? ""
      : " "

    return [n.children, n.content]
      .filter(Array.isArray)
      .flatMap((items) => (items as unknown[]).map(text))
      .join(separator)
  }

  return body
    .map((raw) => {
      const block = object(raw)
      switch (block.__component) {
        case "content.rich-text":
          return Array.isArray(block.body) ? block.body.map(text).join(" ") : ""
        case "content.code-block":
          return typeof block.code === "string" ? block.code : ""
        case "content.quote-block":
          return typeof block.quote === "string" ? block.quote : ""
        case "content.callout":
          return [block.title, block.body]
            .filter((v) => typeof v === "string")
            .join(" ")
        case "content.image-block":
          return typeof block.caption === "string" ? block.caption : ""

        default:
          return text(block)
      }
    })
    .join(" ")
    .trim()
}

export function articleReadingMinutes(
  body: unknown,
  wordsPerMinute = 200
): number {
  const words = articleText(body).split(/\s+/u).filter(Boolean).length

  return Math.max(1, Math.ceil(words / Math.max(1, wordsPerMinute)))
}

export function articleSectionKeys(article: {
  section?: { slug?: string | null } | null
  docsSections?: unknown
}): string[] {
  const keys = [
    article.section?.slug,
    ...(Array.isArray(article.docsSections) ? article.docsSections : []),
  ]

  return [
    ...new Set(
      keys.filter(
        (key): key is string =>
          typeof key === "string" && /^[a-z0-9-]{1,255}$/.test(key)
      )
    ),
  ].slice(0, 6)
}

/** Stable body identity, independent of Strapi component IDs and populated media. */
export function normalizeArticleBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeArticleBody)
  if (!value || typeof value !== "object") return value
  const src = value as Record<string, unknown>

  return Object.fromEntries(
    Object.keys(src)
      .filter(
        (key) =>
          ![
            "id",
            "documentId",
            "createdAt",
            "updatedAt",
            "publishedAt",
          ].includes(key)
      )
      .sort()
      .map((key) => [
        key,
        ["image", "metaImage", "ogImage"].includes(key) &&
        src[key] &&
        typeof src[key] === "object"
          ? (object(src[key]).id ?? null)
          : ["library", "event"].includes(key) &&
              src[key] &&
              typeof src[key] === "object"
            ? (object(src[key]).documentId ?? null)
            : normalizeArticleBody(src[key]),
      ])
  )
}

/** Feed this string to SHA256 in server adapters for optimistic revision checks. */
export function articleContentVersion(article: {
  title?: unknown
  summary?: unknown
  body?: unknown
  updatedAt?: unknown
}): string {
  return JSON.stringify({
    title: article.title ?? "",
    summary: article.summary ?? "",
    body: normalizeArticleBody(article.body ?? []),
    updatedAt: article.updatedAt ?? null,
  })
}
