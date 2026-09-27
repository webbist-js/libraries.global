import GlobalLink from "@/components/global/GlobalLink"
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

type BlockNode =
  | { type: "paragraph"; children: BlockInlineNode[] }
  | {
      type: "heading"
      level: 1 | 2 | 3 | 4 | 5 | 6
      children: BlockInlineNode[]
    }
  | {
      type: "list"
      format: "ordered" | "unordered"
      children: { type: "list-item"; children: BlockInlineNode[] }[]
    }
  | { type: "quote"; children: BlockInlineNode[] }
  | { type: "code"; children: [{ type: "text"; text: string }] }

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
            return block.format === "ordered" ? (
              <ol
                key={blockIndex}
                className="list-decimal space-y-1.5 pl-5 text-(--t-ink-dim)"
              >
                {block.children.map((item, i) => (
                  <li key={i}>{item.children.map(renderInlineNode)}</li>
                ))}
              </ol>
            ) : (
              <ul
                key={blockIndex}
                className="list-disc space-y-1.5 pl-5 text-(--t-ink-dim)"
              >
                {block.children.map((item, i) => (
                  <li key={i}>{item.children.map(renderInlineNode)}</li>
                ))}
              </ul>
            )

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
