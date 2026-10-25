import GlobalLink from "@/components/global/GlobalLink"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type BlockTextNode = {
  type: "text"
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
}

type BlockLinkNode = {
  type: "link"
  url: string
  children: BlockTextNode[]
}

type BlockInlineNode = BlockTextNode | BlockLinkNode

// Block content can come from moderated community edits — only render links
// with a known-safe scheme (or a relative path / in-page anchor).
const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i

type BlockListNode = {
  type: "list"
  format: "ordered" | "unordered"
  children: (
    | BlockListNode
    | { type: "list-item"; children: BlockInlineNode[] }
  )[]
}

type BlockNode =
  | { type: "paragraph"; children: BlockInlineNode[] }
  | {
      type: "heading"
      level: 1 | 2 | 3 | 4 | 5 | 6
      children: BlockInlineNode[]
    }
  | BlockListNode
  | { type: "quote"; children: BlockInlineNode[] }
  | { type: "code"; children: [{ type: "text"; text: string }] }
  | {
      type: "image"
      image: {
        url?: string
        alternativeText?: string | null
        width?: number
        height?: number
      }
    }

function renderInlineNode(node: BlockInlineNode, index: number) {
  if (node.type === "link") {
    const label = node.children.map(renderInlineNode)
    if (!SAFE_LINK.test(node.url)) return <span key={index}>{label}</span>

    return (
      <GlobalLink
        key={index}
        href={node.url}
        className="text-(--t-accent-primary) underline underline-offset-[3px] hover:text-(--t-accent-primary-hover)"
      >
        {label}
      </GlobalLink>
    )
  }

  let content: React.ReactNode = node.text

  if (node.bold) content = <strong key={index}>{content}</strong>
  if (node.italic) content = <em key={index}>{content}</em>
  if (node.underline) content = <u key={index}>{content}</u>
  if (node.strikethrough) content = <s key={index}>{content}</s>
  if (node.code)
    content = (
      <code
        key={index}
        className="rounded border border-(--t-border-line) bg-(--t-bg-surface) px-1.5 py-0.5 font-mono text-sm"
      >
        {content}
      </code>
    )

  return <span key={index}>{content}</span>
}

/** Group Strapi's sibling nested lists into their preceding HTML list item. */
function renderList(list: BlockListNode, key: number): React.ReactNode {
  const items: { children: BlockInlineNode[]; lists: BlockListNode[] }[] = []
  for (const child of list.children) {
    if (child.type === "list-item")
      items.push({ children: child.children, lists: [] })
    else {
      if (items.length === 0) items.push({ children: [], lists: [] })
      items.at(-1)!.lists.push(child)
    }
  }
  const Tag = list.format === "ordered" ? "ol" : "ul"

  return (
    <Tag
      key={key}
      className={cn(
        list.format === "ordered" ? "list-decimal" : "list-disc",
        "list-outside space-y-1.5 ps-[1.5em] text-(--t-ink-dim) [&_li>ol]:mt-2 [&_li>ul]:mt-2"
      )}
    >
      {items.map((item, index) => (
        <li key={index}>
          {item.children.map(renderInlineNode)}
          {item.lists.map(renderList)}
        </li>
      ))}
    </Tag>
  )
}

export function StrapiBlocksContent({
  blocks,
  className,
}: {
  readonly blocks?: BlockNode[] | null
  readonly className?: string
}) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-4", className)}>
      {blocks.map((block, blockIndex) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={blockIndex} className="leading-7 text-(--t-ink-dim)">
                {block.children.map(renderInlineNode)}
              </p>
            )

          case "heading": {
            const Tag = `h${block.level}` as
              | "h1"
              | "h2"
              | "h3"
              | "h4"
              | "h5"
              | "h6"
            const sizeClass = {
              1: "text-3xl font-semibold tracking-tight",
              2: "text-2xl font-semibold tracking-tight",
              3: "text-xl font-semibold",
              4: "text-lg font-semibold",
              5: "text-base font-semibold",
              6: "text-sm font-semibold",
            }[block.level]

            // Anchor id matching lib/article-helpers extractHeadings, so
            // tables of contents can deep-link into the prose.
            const headingText = block.children
              .map((child) => ("text" in child ? (child.text ?? "") : ""))
              .join("")
              .trim()
            const headingId = headingText
              ? "h-" +
                headingText
                  .toLowerCase()
                  .replaceAll(/[^a-z0-9\s-]/g, "")
                  .replaceAll(/\s+/g, "-")
                  .slice(0, 60)
              : undefined

            return (
              <Tag
                key={blockIndex}
                className={cn(sizeClass, "scroll-mt-24 text-(--t-ink-base)")}
                id={headingId}
              >
                {block.children.map(renderInlineNode)}
              </Tag>
            )
          }

          case "list":
            return renderList(block, blockIndex)

          case "image": {
            // Older editor uploads were saved inside rich text. Keep those
            // images visible as well as the dedicated media blocks.
            const src = formatStrapiMediaUrlForClient(
              typeof block.image?.url === "string" ? block.image.url : null
            )
            if (!src || !/^(https?:\/\/|\/(?!\/))/i.test(src)) return null

            return (
              // The URL can be a pasted image outside the Next image allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${src}:${block.image.alternativeText ?? ""}`}
                src={src}
                alt={block.image.alternativeText ?? ""}
                width={block.image.width}
                height={block.image.height}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-2xl"
              />
            )
          }

          case "quote":
            return (
              <blockquote
                key={blockIndex}
                className="border-l-2 border-(--t-border-hi) pl-4 text-(--t-ink-low) italic"
              >
                {block.children.map(renderInlineNode)}
              </blockquote>
            )

          case "code":
            return (
              <pre
                key={blockIndex}
                className="overflow-x-auto rounded-xl bg-(--t-bg-deep) p-4 font-mono text-sm text-(--t-ink-dim)"
              >
                <code>{block.children[0].text}</code>
              </pre>
            )

          default:
            return null
        }
      })}
    </div>
  )
}

export default StrapiBlocksContent
