"use client"

import { useTranslations as useUiTranslations } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
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
}: {
  readonly kind: ArticleKind
  readonly title: string
  readonly summary: string
  readonly doc: TiptapDoc
  readonly compact?: boolean
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
        className="m-0 mb-3 text-[13px] font-semibold tracking-wide uppercase"
        style={{ color: T.ink.dim }}
      >
        {kind === "journal" ? tUi("journal") : tUi("knowledge")} ·{" "}
        {tUi("preview")}
      </p>
      <Heading
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: compact ? "clamp(28px,2.5vw,36px)" : "clamp(34px,4vw,48px)",
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: title ? T.ink.base : T.ink.faint,
        }}
      >
        {title || tUi("untitled")}
      </Heading>
      {summary ? (
        <p
          className={
            compact
              ? "mt-4 mb-0 text-[17px] leading-relaxed"
              : "mt-4 mb-0 text-[19px] leading-[1.55]"
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
        <p className="m-0 text-[16px]" style={{ color: T.ink.faint }}>
          {tUi("nothing_written_yet")}{" "}
        </p>
      )}
    </article>
  )
}
