import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { ARTICLE_KIND_META } from "@/components/contribute/article-editor/article.types"
import { ArticleEditorShell } from "@/components/contribute/article-editor/ArticleEditorShell"
import {
  fetchArticleLocales,
  loadArticleForEditor,
} from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { ReportProblemForm } from "./_components/ReportProblemForm"
import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return privateMetadata(`Edit article: ${slug}`)
}

export default async function EditKnowledgeArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const [{ locale, slug }, { mode }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/knowledge/${slug}`)}`
    )

  const [article, locales] = await Promise.all([
    loadArticleForEditor("knowledge", slug, locale as Locale),
    fetchArticleLocales(),
  ])
  if (!article) notFound()
  const report = mode === "report"

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Knowledge editor"
        title={
          report
            ? `Something wrong in *${article.title}?*`
            : `Improve *${article.title}.*`
        }
        lead={
          report
            ? "Describe the problem. A reviewer checks it against your source, and accepted changes are credited to you."
            : "Edit the article, or add a translation. Editors review every change before it’s published, and each contributor is credited."
        }
      />
      {report ? (
        <main className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
          <ReportProblemForm
            slug={slug}
            title={article.title}
            editHref={ARTICLE_KIND_META.knowledge.editPath(slug)}
          />
        </main>
      ) : (
        <ArticleEditorShell
          kind="knowledge"
          mode="edit"
          article={article}
          locales={locales}
          uiLocale={locale}
        />
      )}
    </div>
  )
}
