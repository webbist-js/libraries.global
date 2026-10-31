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
  sources?: unknown
  title?: unknown
  summary?: unknown
  body?: unknown
  updatedAt?: unknown
}): string {
  return JSON.stringify({
    title: article.title ?? "",
    summary: article.summary ?? "",
    body: normalizeArticleBody(article.body ?? []),
    ...(Array.isArray(article.sources) && article.sources.length
      ? { sources: normalizeArticleBody(article.sources) }
      : {}),
    updatedAt: article.updatedAt ?? null,
  })
}

export type ArticleSource = {
  title: string
  url?: string | null
  publisher?: string | null
  accessedAt?: string | null
  notes?: string | null
}

/** Canonical citation data; never preserve submitted component IDs or relations. */
export function parseArticleSources(value: unknown): ArticleSource[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 30)
    throw new Error("Use at most 30 article sources.")

  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Invalid article source.")
    const row = item as Record<string, unknown>
    const text = (key: string, max: number): string | null => {
      if (row[key] == null || row[key] === "") return null
      if (typeof row[key] !== "string" || row[key].length > max)
        throw new Error(`Invalid source ${key}.`)

      return row[key].trim() || null
    }
    const title = text("title", 180)
    if (!title) throw new Error("Every source needs a title.")
    let url = text("url", 2048)
    if (url) {
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        throw new Error("Source links must be public http or https URLs.")
      }
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error("Source links must be public http or https URLs.")
      url = parsed.href
    }
    const accessedAt = text("accessedAt", 10)
    if (
      accessedAt &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(accessedAt) ||
        !Number.isFinite(Date.parse(accessedAt)) ||
        new Date(accessedAt).toISOString().slice(0, 10) !== accessedAt)
    )
      throw new Error("Use a valid source access date.")

    return {
      title,
      url,
      publisher: text("publisher", 180),
      accessedAt,
      notes: text("notes", 1000),
    }
  })
}
