"use client"

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
}: {
  readonly kind: ArticleKind
  readonly title: string
  readonly summary: string
  readonly doc: TiptapDoc
}) {
  const blocks = tiptapToDynamicZone(doc, { preview: true }).map(
    (block, i) => ({ id: i, ...block })
  ) as unknown as ArticleBodyBlock[]

  return (
    <article aria-label="Preview" className="px-6 py-8 sm:px-10">
      <p
        className="m-0 mb-3 text-[13px] font-semibold tracking-wide uppercase"
        style={{ color: T.ink.dim }}
      >
        {kind === "journal" ? "Journal" : "Knowledge"} · preview
      </p>
      <h1
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(34px,4vw,48px)",
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: title ? T.ink.base : T.ink.faint,
        }}
      >
        {title || "Untitled"}
      </h1>
      {summary ? (
        <p
          className="mt-4 mb-0 text-[19px] leading-[1.55]"
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
          Nothing written yet.
        </p>
      )}
    </article>
  )
}
