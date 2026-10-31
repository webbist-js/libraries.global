"use client"

import type { ArticleSource } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { JournalSources } from "@/components/blog/JournalSources"
import { T } from "@/lib/design-tokens"
import type { ArticleBodyBlock } from "@/lib/strapi-api/content/server"

import type { ArticleKind } from "./article.types"
import { type TiptapDoc, tiptapToDynamicZone } from "./articleBlocks"

/** The draft as readers will see it, rendered with the site's own body renderer. */
export function ArticlePreview({
  kind,
  title,
  summary,
  doc,
  compact = false,
  sources,
}: {
  readonly kind: ArticleKind
  readonly title: string
  readonly summary: string
  readonly doc: TiptapDoc
  readonly compact?: boolean
  readonly sources?: readonly ArticleSource[]
}) {
  const tUi = useUiTranslations("ui")
  const Heading = compact ? "h3" : "h1"

  const blocks = tiptapToDynamicZone(doc, { preview: true }).map(
    (block, i) => ({ id: i, ...block })
  ) as unknown as ArticleBodyBlock[]

  return (
    <article
      aria-label={tUi("preview")}
      className={
        compact
          ? "px-5 py-6 [overflow-wrap:anywhere] sm:px-7 sm:py-7"
          : "px-6 py-8 [overflow-wrap:anywhere] sm:px-10"
      }
    >
      <p
        className="m-0 mb-3 text-sm font-semibold tracking-wide uppercase"
        style={{ color: T.ink.dim }}
      >
        {kind === "journal" ? tUi("journal") : tUi("knowledge")} ·{" "}
        {tUi("preview")}
      </p>
      <Heading
        className="type-panel-title m-0"
        style={{
          color: title ? T.ink.base : T.ink.faint,
        }}
      >
        {title || tUi("untitled")}
      </Heading>
      {summary ? (
        <p
          className={
            compact
              ? "mt-4 mb-0 text-base leading-relaxed"
              : "mt-4 mb-0 text-lg leading-[1.55]"
          }
          style={{ color: T.ink.dim }}
        >
          {summary}
        </p>
      ) : null}
      <hr
        className="my-8 border-0"
        style={{ height: 1, background: T.border.divider }}
      />
      {blocks.length > 0 ? (
        <ArticleBodyBlocks blocks={blocks} />
      ) : (
        <p className="m-0 text-base" style={{ color: T.ink.faint }}>
          {tUi("nothing_written_yet")}{" "}
        </p>
      )}
      {kind === "journal" ? <JournalSources sources={sources} /> : null}
    </article>
  )
}
