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
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { requireEditorOrApply } from "@/lib/editor-gate"
import { ownsJournalArticle } from "@/lib/journal-ownership-server"
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
  searchParams: Promise<{
    locale?: string | string[]
    draft?: string
    sourceLocale?: string | string[]
  }>
}) {
  const tUi = await getUiTranslations("ui")
  const w = await getUiTranslations("writeWorkspace")

  const [
    { locale, slug },
    { locale: requested, draft: requestedDraft, sourceLocale: requestedSource },
    session,
  ] = await Promise.all([params, searchParams, getSessionSSR(await headers())])
  const resumeQuery = new URLSearchParams()
  if (typeof requested === "string") resumeQuery.set("locale", requested)
  if (typeof requestedSource === "string")
    resumeQuery.set("sourceLocale", requestedSource)
  if (requestedDraft && isDocumentIdParam(requestedDraft))
    resumeQuery.set("draft", requestedDraft)
  const callbackPath = `/contribute/knowledge/journal/${encodeURIComponent(slug)}${resumeQuery.size ? `?${resumeQuery}` : ""}`
  if (!session?.user)
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`)
  const canOwnEdit = await ownsJournalArticle(session.user, slug)
  if (!canOwnEdit) requireEditorOrApply(session.user, "journal")

  const locales = await fetchArticleLocales()
  const article = await loadArticleForEditor(
    "journal",
    slug,
    locale as Locale,
    {
      targetLocale: editingLocaleFrom(requested, locales),
      sourceLocale: editingLocaleFrom(requestedSource, locales),
    }
  )
  if (!article) notFound()

  return (
    <div style={{ color: T.ink.base }}>
      <ContributeSectionHeader
        compact
        section={tUi("knowledge_editor")}
        title={w(
          typeof requested === "string" && requested !== article.locale
            ? "translateTitle"
            : "editTitle"
        )}
        lead={w(
          typeof requested === "string" && requested !== article.locale
            ? "translateLead"
            : "editLead"
        )}
      />
      <ArticleEditorShell
        key={`${article.documentId}:${article.locale}:${requestedDraft ?? "fresh"}`}
        kind="journal"
        mode="edit"
        canOwnEdit={canOwnEdit}
        article={article}
        locales={locales}
        uiLocale={locale}
        initialLocale={editingLocaleFrom(requested, locales)}
        resumeDraftId={
          requestedDraft && isDocumentIdParam(requestedDraft)
            ? requestedDraft
            : undefined
        }
      />
    </div>
  )
}
