"use client"

import { useLocale, useTranslations } from "next-intl"
import { memo } from "react"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { languageName } from "@/lib/locale-fallback"
import type { ArticleBodyBlock } from "@/lib/strapi-api/content/server"

import type { ArticleLocale, ExistingArticle } from "./article.types"
import { ArticleReadingPane } from "./ArticleReadingPane"

/** The same published source in the full-source view and beside a translation. */
export const ArticleSourcePanel = memo(function ArticleSourcePanel({
  article,
  locales,
}: {
  readonly article: ExistingArticle
  readonly locales: ArticleLocale[]
}) {
  const w = useTranslations("writeWorkspace")
  const locale = useLocale()
  const blocks = (Array.isArray(article.body) ? article.body : []).map(
    (block, index) => ({ id: index, ...(block as object) })
  ) as unknown as ArticleBodyBlock[]

  return (
    <ArticleReadingPane
      heading={w("sourceLabel", {
        language: languageName(article.locale, locales, locale),
      })}
      lang={article.locale}
    >
      <article className="px-5 py-6 [overflow-wrap:anywhere] sm:px-7 sm:py-7">
        <h3 className="type-h3 m-0">{article.title}</h3>
        {article.summary && (
          <p className="mt-4 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
            {article.summary}
          </p>
        )}
        <hr className="my-6 border-(--t-border-line)" />
        <ArticleBodyBlocks blocks={blocks} />
      </article>
    </ArticleReadingPane>
  )
})
