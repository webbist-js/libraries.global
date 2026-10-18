import { articleText } from "@repo/shared-data"

/**
 * Converts between an article body as Strapi stores it (a dynamic zone of
 * `content.*` components, rich text as the Strapi blocks AST) and the
 * TipTap document the editor works on.
 *
 * The editor keeps one flat document. On save, runs of ordinary nodes
 * (paragraphs, headings, lists) become one `content.rich-text` block, and
 * the site's richer components keep their own block type: images
 * (`content.image-block`), code (`content.code-block`), quotes with an
 * attribution (`content.quote-block`) and callouts (`content.callout`).
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type TiptapMark = { type: string; attrs?: Record<string, unknown> }
export type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}
export type TiptapDoc = { type: "doc"; content: TiptapNode[] }

type StrapiText = {
  type: "text"
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
}
type StrapiLink = { type: "link"; url: string; children: StrapiText[] }
type StrapiInline = StrapiText | StrapiLink
type StrapiList = {
  type: "list"
  format: "ordered" | "unordered"
  children: (StrapiList | { type: "list-item"; children: StrapiInline[] })[]
}

type StrapiBlock =
  | { type: "paragraph"; children: StrapiInline[] }
  | { type: "heading"; level: number; children: StrapiInline[] }
  | StrapiList
  | { type: "quote"; children: StrapiInline[] }
  | { type: "code"; children: StrapiText[] }
  | {
      type: "image"
      image: { url?: string; alternativeText?: string | null }
      children: StrapiText[]
    }

export type DynamicZoneBlock = Record<string, unknown> & { __component: string }

export const CALLOUT_KINDS = ["info", "warning", "tip", "note"] as const
export type CalloutKind = (typeof CALLOUT_KINDS)[number]

/** Every heading the editor offers; anything else is clamped into range. */
export const HEADING_LEVELS = [2, 3] as const

const clampLevel = (level: unknown): 2 | 3 => (Number(level) <= 2 ? 2 : 3)

// ── Strapi → TipTap ────────────────────────────────────────────────────────

type MarkFlag = "bold" | "italic" | "underline" | "strikethrough" | "code"

const MARK_FLAGS: [MarkFlag, string][] = [
  ["bold", "bold"],
  ["italic", "italic"],
  ["underline", "underline"],
  ["strikethrough", "strike"],
  ["code", "code"],
]

function textNode(node: StrapiText, link?: string): TiptapNode | null {
  if (typeof node.text !== "string" || node.text === "") return null
  const marks: TiptapMark[] = []
  for (const [flag, mark] of MARK_FLAGS)
    if (node[flag]) marks.push({ type: mark })
  if (link) marks.push({ type: "link", attrs: { href: link } })

  return marks.length > 0
    ? { type: "text", text: node.text, marks }
    : { type: "text", text: node.text }
}

function inlinesToTiptap(children: unknown): TiptapNode[] {
  if (!Array.isArray(children)) return []
  const out: TiptapNode[] = []
  for (const child of children as StrapiInline[]) {
    if (!child || typeof child !== "object") continue
    if (child.type === "link") {
      for (const inner of child.children ?? []) {
        const t = textNode(inner, child.url)
        if (t) out.push(t)
      }
    } else {
      const t = textNode(child as StrapiText)
      if (t) out.push(t)
    }
  }

  return out
}

function withContent(
  type: string,
  content: TiptapNode[],
  attrs?: Record<string, unknown>
) {
  const node: TiptapNode = { type }
  if (attrs) node.attrs = attrs
  if (content.length > 0) node.content = content

  return node
}

function paragraph(children: unknown): TiptapNode {
  return withContent("paragraph", inlinesToTiptap(children))
}

/** Strapi nests a list alongside the list-item it belongs to. */
function listToTiptap(list: StrapiList): TiptapNode {
  const items: TiptapNode[] = []
  for (const child of list.children ?? []) {
    if (child.type === "list-item") {
      items.push({ type: "listItem", content: [paragraph(child.children)] })
    } else if (child.type === "list") {
      if (items.length === 0)
        items.push({ type: "listItem", content: [{ type: "paragraph" }] })
      items.at(-1)!.content!.push(listToTiptap(child))
    }
  }

  return {
    type: list.format === "ordered" ? "orderedList" : "bulletList",
    content: items,
  }
}

function richTextToTiptap(blocks: unknown): TiptapNode[] {
  if (!Array.isArray(blocks)) return []
  const out: TiptapNode[] = []
  for (const block of blocks as StrapiBlock[]) {
    if (!block || typeof block !== "object") continue
    switch (block.type) {
      case "paragraph":
        out.push(paragraph(block.children))
        break
      case "heading":
        out.push(
          withContent("heading", inlinesToTiptap(block.children), {
            level: clampLevel(block.level),
          })
        )
        break
      case "list":
        out.push(listToTiptap(block))
        break
      case "quote":
        out.push({ type: "blockquote", content: [paragraph(block.children)] })
        break
      case "code": {
        const text = (block.children ?? []).map((c) => c.text ?? "").join("")
        out.push(withContent("codeBlock", text ? [{ type: "text", text }] : []))
        break
      }
      case "image":
        if (block.image?.url)
          out.push({
            type: "image",
            attrs: {
              src: block.image.url,
              alt: block.image.alternativeText ?? null,
              imageId: null,
              caption: null,
              fullWidth: false,
            },
          })
        break

      default:
        break
    }
  }

  return out
}

function textParagraphs(text: unknown): TiptapNode[] {
  const value = typeof text === "string" ? text : ""
  const parts = value.split(/\n{2,}/).filter((p) => p.trim())
  if (parts.length === 0) return [{ type: "paragraph" }]

  return parts.map((p) =>
    withContent("paragraph", [{ type: "text", text: p.replaceAll("\n", " ") }])
  )
}

/** The article body as a TipTap document. Unknown components are dropped. */
export function dynamicZoneToTiptap(
  body: unknown,
  resolveImageUrl: (url: string) => string = (u) => u
): TiptapDoc {
  const content: TiptapNode[] = []
  if (Array.isArray(body))
    for (const raw of body) {
      if (!raw || typeof raw !== "object") continue
      const block = raw as DynamicZoneBlock
      switch (block.__component) {
        case "content.rich-text":
          content.push(...richTextToTiptap(block.body))
          break
        case "content.image-block": {
          const image = block.image as
            | { id?: number; url?: string; alternativeText?: string | null }
            | number
            | null
            | undefined
          if (typeof image === "number" || image?.url)
            content.push({
              type: "image",
              attrs: {
                // Preserve unresolved historical references while media metadata reloads.
                src:
                  typeof image === "number" ? "" : resolveImageUrl(image.url!),
                alt:
                  typeof block.alternativeText === "string"
                    ? block.alternativeText
                    : ((typeof image === "number"
                        ? null
                        : image.alternativeText) ?? null),
                imageId: typeof image === "number" ? image : (image.id ?? null),
                caption:
                  typeof block.caption === "string" ? block.caption : null,
                fullWidth: block.fullWidth === true,
              },
            })
          break
        }
        case "content.code-block": {
          const code = typeof block.code === "string" ? block.code : ""
          content.push(
            withContent(
              "codeBlock",
              code ? [{ type: "text", text: code }] : [],
              {
                language:
                  typeof block.language === "string" ? block.language : null,
                filename:
                  typeof block.filename === "string" ? block.filename : null,
              }
            )
          )
          break
        }
        case "content.quote-block":
          content.push({
            type: "blockquote",
            attrs: {
              attribution:
                typeof block.attribution === "string"
                  ? block.attribution
                  : null,
              source: typeof block.source === "string" ? block.source : null,
            },
            content: textParagraphs(block.quote),
          })
          break
        case "content.callout":
          content.push({
            type: "callout",
            attrs: {
              kind: CALLOUT_KINDS.includes(block.type as CalloutKind)
                ? block.type
                : "note",
              title: typeof block.title === "string" ? block.title : null,
            },
            content: textParagraphs(block.body),
          })
          break

        default:
          break
      }
    }
  if (content.length === 0) content.push({ type: "paragraph" })

  return { type: "doc", content }
}

// ── TipTap → Strapi ────────────────────────────────────────────────────────

function markFlags(
  marks: TiptapMark[] | undefined
): Partial<Record<MarkFlag, boolean>> {
  const flags: Partial<Record<MarkFlag, boolean>> = {}
  for (const mark of marks ?? []) {
    for (const [flag, name] of MARK_FLAGS)
      if (mark.type === name) flags[flag] = true
  }

  return flags
}

function linkOf(node: TiptapNode): string | null {
  const mark = node.marks?.find((m) => m.type === "link")
  const href = mark?.attrs?.href

  return typeof href === "string" && href ? href : null
}

/** Inline content → Strapi inline nodes; adjacent texts sharing a link merge into one link node. */
function inlinesToStrapi(content: TiptapNode[] | undefined): StrapiInline[] {
  const out: StrapiInline[] = []
  for (const node of content ?? []) {
    let text: StrapiText | null = null
    if (node.type === "text" && typeof node.text === "string")
      text = { type: "text", text: node.text, ...markFlags(node.marks) }
    else if (node.type === "hardBreak") text = { type: "text", text: "\n" }
    if (!text) continue
    const href = node.type === "text" ? linkOf(node) : null
    if (href) {
      const last = out.at(-1)
      if (last && last.type === "link" && last.url === href)
        last.children.push(text)
      else out.push({ type: "link", url: href, children: [text] })
    } else out.push(text)
  }

  return out.length > 0 ? out : [{ type: "text", text: "" }]
}

/** All inline content under a node, paragraphs joined with a space. */
function flattenInlines(node: TiptapNode): StrapiInline[] {
  const paragraphs = (node.content ?? []).filter((n) => n.type === "paragraph")
  if (paragraphs.length === 0) return inlinesToStrapi(node.content)
  const out: StrapiInline[] = []
  paragraphs.forEach((p, i) => {
    if (i > 0) out.push({ type: "text", text: " " })
    out.push(...inlinesToStrapi(p.content))
  })

  return out
}

function plainText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? ""
  if (node.type === "hardBreak") return "\n"

  return (node.content ?? []).map(plainText).join("")
}

function paragraphsText(node: TiptapNode): string {
  return (node.content ?? [])
    .map(plainText)
    .filter((t) => t.trim())
    .join("\n\n")
}

function listToStrapi(node: TiptapNode): StrapiList {
  const children: StrapiList["children"] = []
  for (const item of node.content ?? []) {
    children.push({ type: "list-item", children: flattenInlines(item) })
    for (const child of item.content ?? [])
      if (child.type === "bulletList" || child.type === "orderedList")
        children.push(listToStrapi(child))
  }

  return {
    type: "list",
    format: node.type === "orderedList" ? "ordered" : "unordered",
    children,
  }
}

function richNode(node: TiptapNode): StrapiBlock | null {
  switch (node.type) {
    case "paragraph":
      return { type: "paragraph", children: inlinesToStrapi(node.content) }
    case "heading":
      return {
        type: "heading",
        level: clampLevel(node.attrs?.level),
        children: inlinesToStrapi(node.content),
      }
    case "bulletList":
    case "orderedList":
      return listToStrapi(node)
    case "blockquote":
      return { type: "quote", children: flattenInlines(node) }
    case "image": {
      const src = node.attrs?.src
      if (typeof src !== "string" || !src) return null

      return {
        type: "image",
        image: {
          url: src,
          alternativeText:
            typeof node.attrs?.alt === "string" ? node.attrs.alt : null,
        },
        children: [{ type: "text", text: "" }],
      }
    }

    default:
      return null
  }
}

/**
 * The TipTap document as a Strapi dynamic zone. Images uploaded through the
 * editor (with an `imageId`) become image blocks; pasted external images
 * stay inline in the rich text.
 */
export function tiptapToDynamicZone(
  doc: TiptapDoc | null | undefined,
  opts: {
    /** Emit image blocks with their URL (what the site renderer wants) instead of the media id. */
    preview?: boolean
  } = {}
): DynamicZoneBlock[] {
  const out: DynamicZoneBlock[] = []
  let run: StrapiBlock[] = []
  const flush = () => {
    if (run.length > 0)
      out.push({ __component: "content.rich-text", body: run })
    run = []
  }

  // TipTap keeps a trailing empty paragraph so the cursor can leave the last
  // block; readers shouldn't get a blank line for it.
  const nodes = [...(doc?.content ?? [])]
  while (
    nodes.length > 1 &&
    nodes.at(-1)?.type === "paragraph" &&
    !plainText(nodes.at(-1)!).trim()
  )
    nodes.pop()

  for (const node of nodes) {
    const hasAttribution =
      node.type === "blockquote" &&
      ((typeof node.attrs?.attribution === "string" &&
        node.attrs.attribution.trim()) ||
        (typeof node.attrs?.source === "string" && node.attrs.source.trim()))
    if (node.type === "image" && typeof node.attrs?.imageId === "number") {
      flush()
      out.push({
        __component: "content.image-block",
        image: opts.preview
          ? {
              id: node.attrs.imageId,
              url: node.attrs.src,
              alternativeText:
                typeof node.attrs.alt === "string" ? node.attrs.alt : null,
            }
          : node.attrs.imageId,
        alternativeText:
          typeof node.attrs.alt === "string" ? node.attrs.alt : null,
        caption:
          typeof node.attrs.caption === "string" ? node.attrs.caption : null,
        fullWidth: node.attrs.fullWidth === true,
      })
    } else if (node.type === "codeBlock") {
      flush()
      out.push({
        __component: "content.code-block",
        code: plainText(node),
        language:
          typeof node.attrs?.language === "string" && node.attrs.language
            ? node.attrs.language
            : null,
        filename:
          typeof node.attrs?.filename === "string" && node.attrs.filename
            ? node.attrs.filename
            : null,
      })
    } else if (hasAttribution) {
      flush()
      out.push({
        __component: "content.quote-block",
        quote: paragraphsText(node),
        attribution:
          typeof node.attrs?.attribution === "string"
            ? node.attrs.attribution
            : null,
        source:
          typeof node.attrs?.source === "string" ? node.attrs.source : null,
      })
    } else if (node.type === "callout") {
      flush()
      out.push({
        __component: "content.callout",
        type: CALLOUT_KINDS.includes(node.attrs?.kind as CalloutKind)
          ? node.attrs?.kind
          : "note",
        title:
          typeof node.attrs?.title === "string" && node.attrs.title.trim()
            ? node.attrs.title
            : null,
        body: paragraphsText(node),
      })
    } else if (node.type === "horizontalRule") {
      // Strapi blocks have no rule; drop it.
    } else {
      const rich = richNode(node)
      if (rich) run.push(rich)
    }
  }
  flush()

  return out
}

// ── Measures ───────────────────────────────────────────────────────────────

/** The document's words, for the footer count and reading time. */
export function wordCount(doc: TiptapDoc | null | undefined): number {
  return articleText(tiptapToDynamicZone(doc)).split(/\s+/u).filter(Boolean)
    .length
}

export function isEmptyDoc(doc: TiptapDoc | null | undefined): boolean {
  return (
    wordCount(doc) === 0 &&
    !(doc?.content ?? []).some((n) => n.type === "image")
  )
}
