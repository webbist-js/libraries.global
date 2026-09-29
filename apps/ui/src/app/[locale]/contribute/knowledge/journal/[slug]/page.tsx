import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { ArticleEditorShell } from "@/components/contribute/article-editor/ArticleEditorShell"
import {
  fetchArticleLocales,
  loadArticleForEditor,
} from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../../_components/ContributeSectionHeader"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return privateMetadata(`Edit Journal article: ${slug}`)
}

export default async function EditJournalArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const [{ locale, slug }, session] = await Promise.all([
    params,
    getSessionSSR(await headers()),
  ])
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/knowledge/journal/${slug}`)}`
    )

  const [article, locales] = await Promise.all([
    loadArticleForEditor("journal", slug, locale as Locale),
    fetchArticleLocales(),
  ])
  if (!article) notFound()

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Knowledge editor"
        title={`Improve *${article.title}.*`}
        lead="Edit the story, or add a translation. Journal editors review every change before it’s published, and each contributor is credited."
      />
      <ArticleEditorShell
        kind="journal"
        mode="edit"
        article={article}
        locales={locales}
        uiLocale={locale}
      />
    </div>
  )
}
