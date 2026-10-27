import type {
  ArticleBodyBlock,
  WikiArticleDetail,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

type Node = Record<string, unknown>
const record = (value: unknown): Node =>
  value && typeof value === "object" ? (value as Node) : {}
const children = (node: Node): unknown[] =>
  Array.isArray(node.children) ? node.children : []
const text = (value: unknown): string =>
  typeof value === "string" ? value : ""

export function escapeMarkdown(value: string): string {
  return value.replaceAll(/[\\`*_{}[\]<>#!|~]/g, String.raw`\$&`)
}

function fenceFor(value: string, minimum: number): string {
  const runs = value.match(/`+/g) ?? []

  return "`".repeat(Math.max(minimum, ...runs.map((run) => run.length + 1)))
}

function inlineCode(value: string): string {
  const fence = fenceFor(value, 1)
  const padding = /^[` ]|[` ]$/.test(value) ? " " : ""

  return `${fence}${padding}${value}${padding}${fence}`
}

function fencedCode(value: string, language = ""): string {
  const fence = fenceFor(value, 3)
  const info = /^[a-z0-9_+-]*$/i.test(language) ? language : ""

  return `${fence}${info}\n${value}${value.endsWith("\n") ? "" : "\n"}${fence}`
}

/** Keep public relative links usable without exposing the CMS media origin. */
function linkUrl(value: unknown, canonicalUrl: string, image = false) {
  const raw = image ? formatStrapiMediaUrlForClient(text(value)) : text(value)
  if (!raw || !/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(raw)) return null
  try {
    const url = new URL(raw, canonicalUrl)
    if (image && !["https:", "http:"].includes(url.protocol)) return null

    return url.href.replaceAll("<", "%3C").replaceAll(">", "%3E")
  } catch {
    return null
  }
}

function inlineNodes(nodes: unknown[], canonicalUrl: string): string {
  return nodes
    .map((raw) => {
      const node = record(raw)
      if (node.type === "hardBreak") return "  \n"
      if (node.type === "link") {
        const label = inlineNodes(children(node), canonicalUrl)
        const url = linkUrl(node.url, canonicalUrl)

        return url ? `[${label}](<${url}>)` : label
      }
      const value = text(node.text)
      if (node.code) return inlineCode(value)
      let result = escapeMarkdown(value)
      if (node.bold) result = `**${result}**`
      if (node.italic) result = `*${result}*`
      if (node.strikethrough) result = `~~${result}~~`

      return result
    })
    .join("")
}

const quote = (value: string) =>
  value
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n")

function imageMarkdown(image: Node, canonicalUrl: string, alt?: unknown) {
  const url = linkUrl(image.url, canonicalUrl, true)

  return url
    ? `![${escapeMarkdown(text(alt) || text(image.alternativeText))}](<${url}>)`
    : ""
}

/** Strapi stores nested lists as siblings of the preceding list item. */
function listMarkdown(node: Node, canonicalUrl: string): string {
  const lines: string[] = []
  let index = 0
  let indent = 2
  for (const raw of children(node)) {
    const child = record(raw)
    if (child.type === "list") {
      lines.push(
        listMarkdown(child, canonicalUrl)
          .split("\n")
          .map((line) => " ".repeat(indent) + line)
          .join("\n")
      )
      continue
    }
    const marker = node.format === "ordered" ? `${++index}. ` : "- "
    indent = marker.length
    const content = inlineNodes(children(child), canonicalUrl)
      .split("\n")
      .map((line, i) => (i ? " ".repeat(indent) : marker) + line)
      .join("\n")
    lines.push(content)
  }

  return lines.join("\n")
}

function richTextMarkdown(body: unknown, canonicalUrl: string): string {
  if (!Array.isArray(body)) return ""

  return body
    .map((raw) => {
      const node = record(raw)
      const content = inlineNodes(children(node), canonicalUrl)
      switch (node.type) {
        case "heading":
          return `${"#".repeat(Math.min(6, Math.max(1, Number(node.level) || 2)))} ${content}`
        case "list":
          return listMarkdown(node, canonicalUrl)
        case "quote":
          return quote(content)
        case "code":
          return fencedCode(
            children(node)
              .map((n) => text(record(n).text))
              .join("")
          )
        case "image":
          return imageMarkdown(record(node.image), canonicalUrl)

        default:
          return content
      }
    })
    .filter(Boolean)
    .join("\n\n")
}

function bodyBlockMarkdown(block: ArticleBodyBlock, canonicalUrl: string) {
  switch (block.__component) {
    case "content.rich-text":
      return richTextMarkdown(block.body, canonicalUrl)
    case "content.code-block":
      return [
        block.filename ? `File: ${inlineCode(block.filename)}` : "",
        fencedCode(block.code, block.language ?? ""),
      ]
        .filter(Boolean)
        .join("\n\n")
    case "content.image-block":
      return [
        imageMarkdown(
          record(block.image),
          canonicalUrl,
          block.alternativeText ?? block.caption
        ),
        block.caption ? escapeMarkdown(block.caption) : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    case "content.quote-block":
      return [
        quote(escapeMarkdown(block.quote)),
        [block.attribution, block.source]
          .filter(Boolean)
          .map((value) => escapeMarkdown(value!))
          .join(" — "),
      ]
        .filter(Boolean)
        .join("\n\n")
    case "content.callout":
      return quote(
        `**${escapeMarkdown(block.title || block.type)}**\n\n${escapeMarkdown(block.body)}`
      )

    default:
      throw new Error("Unsupported Knowledge article block")
  }
}

export function renderKnowledgeMarkdown(
  article: WikiArticleDetail,
  { canonicalUrl, locale }: { canonicalUrl: string; locale: string }
): string {
  return (
    [
      `# ${escapeMarkdown(article.title || article.slug || "Knowledge article")}`,
      article.summary ? escapeMarkdown(article.summary) : "",
      `Source: [Libraries Global](<${canonicalUrl}>)\nLanguage: ${locale}`,
      article.author ? `Author: ${escapeMarkdown(article.author)}` : "",
      article.updatedAt ? `Updated: ${article.updatedAt}` : "",
      article.articleStatus ? `Article status: ${article.articleStatus}` : "",
      article.heroImage
        ? imageMarkdown(record(article.heroImage), canonicalUrl)
        : "",
      ...(article.body ?? []).map((block) =>
        bodyBlockMarkdown(block, canonicalUrl)
      ),
    ]
      .filter(Boolean)
      .join("\n\n") + "\n"
  )
}
