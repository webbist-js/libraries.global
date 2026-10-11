import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { editingLocaleFrom } from "@/components/contribute/article-editor/article.types"
import { ArticleEditorShell } from "@/components/contribute/article-editor/ArticleEditorShell"
import {
  fetchArticleLocales,
  loadArticleForEditor,
} from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { requireEditorOrApply } from "@/lib/editor-gate"
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
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ locale?: string | string[] }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale, slug }, { locale: requested }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/knowledge/journal/${slug}`)}`
    )
  requireEditorOrApply(session.user, "journal")

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
        section={tUi("knowledge_editor")}
        title={`Improve *${article.title}.*`}
        lead="Edit the story, or add a translation. Journal editors review every change before it’s published, and each contributor is credited."
      />
      <ArticleEditorShell
        kind="journal"
        mode="edit"
        article={article}
        locales={locales}
        uiLocale={locale}
        initialLocale={editingLocaleFrom(requested, locales)}
      />
    </div>
  )
}
