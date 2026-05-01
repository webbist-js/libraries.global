import Image from "next/image"

import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import type { ArticleBodyBlock } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

const calloutStyles = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/8",
    bar: "bg-blue-400",
    label: "text-blue-600 dark:text-blue-300",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/8",
    bar: "bg-amber-400",
    label: "text-amber-700 dark:text-amber-300",
  },
  tip: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/8",
    bar: "bg-emerald-400",
    label: "text-emerald-700 dark:text-emerald-300",
  },
  note: {
    border: "border-(--t-border-hi)",
    bg: "bg-(--t-bg-deep)",
    bar: "bg-(--t-ink-dim)",
    label: "text-(--t-ink-low)",
  },
}

export function ArticleBodyBlocks({
  blocks,
}: {
  readonly blocks?: ArticleBodyBlock[] | null
}) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null

  return (
    <div className="space-y-8">
      {blocks.map((block) => {
        switch (block.__component) {
          case "content.rich-text":
            return (
              <StrapiBlocksContent
                key={block.id}
                blocks={
                  block.body as Parameters<
                    typeof StrapiBlocksContent
                  >[0]["blocks"]
                }
                className="text-base leading-7 text-(--t-ink-dim)"
              />
            )

          case "content.image-block": {
            if (!block.image?.url) return null
            const rawUrl = formatStrapiMediaUrl(block.image.url)
            if (!rawUrl) return null
            const imgUrl = rawUrl

            return (
              <figure
                key={block.id}
                className={cn(
                  "overflow-hidden rounded-2xl",
                  block.fullWidth ? "-mx-6 sm:-mx-10" : ""
                )}
              >
                <div className="relative aspect-video w-full">
                  <Image
                    src={imgUrl}
                    alt={block.image.alternativeText ?? block.caption ?? ""}
                    fill
                    className="object-cover"
                  />
                </div>
                {block.caption ? (
                  <figcaption className="mt-3 text-center text-xs text-(--t-ink-faint)">
                    {block.caption}
                  </figcaption>
                ) : null}
              </figure>
            )
          }

          case "content.code-block":
            return (
              <div
                key={block.id}
                className="overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep)"
              >
                {block.filename || block.language ? (
                  <div className="flex items-center gap-3 border-b border-(--t-border-line) px-5 py-3">
                    {block.filename ? (
                      <span className="text-xs text-(--t-ink-low)">
                        {block.filename}
                      </span>
                    ) : null}
                    {block.language && block.language !== "plaintext" ? (
                      <span className="ml-auto rounded-full border border-(--t-border-line) bg-(--t-bg-surface) px-2 py-0.5 text-[10px] font-medium tracking-wide text-(--t-ink-faint) uppercase">
                        {block.language}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <pre className="overflow-x-auto p-5 font-mono text-sm leading-6 text-(--t-ink-dim)">
                  <code>{block.code}</code>
                </pre>
              </div>
            )

          case "content.quote-block":
            return (
              <blockquote
                key={block.id}
                className="relative border-l-2 border-(--t-accent-aurora) py-1 pl-6"
              >
                <p className="text-lg leading-8 text-(--t-ink-dim) italic">
                  {block.quote}
                </p>
                {block.attribution || block.source ? (
                  <footer className="mt-3 text-sm text-(--t-ink-faint)">
                    {block.attribution ? (
                      <span className="font-medium text-(--t-ink-low)">
                        {block.attribution}
                      </span>
                    ) : null}
                    {block.source ? (
                      <span className="ml-2">{block.source}</span>
                    ) : null}
                  </footer>
                ) : null}
              </blockquote>
            )

          case "content.callout": {
            const styles = calloutStyles[block.type] ?? calloutStyles.note

            return (
              <div
                key={block.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-5",
                  styles.border,
                  styles.bg
                )}
              >
                <div
                  className={cn(
                    "absolute top-0 left-0 h-full w-0.5",
                    styles.bar
                  )}
                />
                <div className="pl-2">
                  {block.title ? (
                    <p
                      className={cn(
                        "mb-1.5 text-xs font-semibold tracking-[0.12em] uppercase",
                        styles.label
                      )}
                    >
                      {block.title}
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "mb-1.5 text-xs font-semibold tracking-[0.12em] uppercase",
                        styles.label
                      )}
                    >
                      {block.type}
                    </p>
                  )}
                  <p className="text-sm leading-6 text-(--t-ink-dim)">
                    {block.body}
                  </p>
                </div>
              </div>
            )
          }

          default:
            return null
        }
      })}
    </div>
  )
}

export default ArticleBodyBlocks
