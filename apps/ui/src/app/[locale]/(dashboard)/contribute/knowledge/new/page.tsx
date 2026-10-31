import { canDirectEdit } from "@repo/access"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { isArticleKind } from "@/components/contribute/article-editor/article.types"
import { ArticleEditorShell } from "@/components/contribute/article-editor/ArticleEditorShell"
import { sessionCapabilities } from "@/lib/access-server"
import {
  fetchArticleLocales,
  loadArticleWriteContext,
} from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { compositionLanguage } from "@/lib/composition-language"
import { T } from "@/lib/design-tokens"
import { editorApplyHref, requireEditorOrApply } from "@/lib/editor-gate"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Write an article")
export const dynamic = "force-dynamic"

export default async function NewArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    type?: string
    kind?: string
    draft?: string
    section?: string
    library?: string
    event?: string
    locale?: string
  }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, query, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  const requestedKind = query.type ?? query.kind
  const kind = isArticleKind(requestedKind) ? requestedKind : "knowledge"
  const callbackQuery = new URLSearchParams({ type: kind })
  for (const key of ["draft", "library", "event"] as const)
    if (query[key] && isDocumentIdParam(query[key]))
      callbackQuery.set(key, query[key])
  if (query.locale && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(query.locale))
    callbackQuery.set("locale", query.locale)
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/knowledge/new?${callbackQuery}`)}`
    )
  if (kind === "knowledge") requireEditorOrApply(session.user, kind)
  const [locales, context] = await Promise.all([
    fetchArticleLocales(),
    loadArticleWriteContext(query, locale),
  ])
  const resumeDraftId =
    query.draft && isDocumentIdParam(query.draft) ? query.draft : undefined
  const capabilities = sessionCapabilities(session.user)
  const writableLocales =
    kind === "journal"
      ? locales
      : locales.filter((item) => canDirectEdit(capabilities, "docs", item.code))
  if (!writableLocales.length) redirect(editorApplyHref(kind))
  const initialLocale = compositionLanguage({
    selected: query.locale,
    preferences: session.user.compositionPreferences,
    available: writableLocales.map((item) => item.code),
    fallback: locale,
    defaultLanguage: locales.find((item) => item.isDefault)?.code,
  })

  return (
    <div style={{ color: T.ink.base }}>
      <ContributeSectionHeader
        compact
        section={tUi("knowledge_editor")}
        title={
          kind === "journal"
            ? "Write for *the Journal.*"
            : "Write for *the knowledge base.*"
        }
        lead={
          kind === "journal"
            ? "A story, interview or piece of news from the library community. Editors review it before it’s published, and it’s credited to you."
            : "A guide or reference page. Editors review it before it’s published, and it’s credited to you."
        }
      />
      <ArticleEditorShell
        key={`${kind}:${resumeDraftId ?? "fresh"}`}
        kind={kind}
        mode="new"
        resumeDraftId={resumeDraftId}
        locales={locales}
        uiLocale={locale}
        initialLocale={initialLocale}
        initialTags={context.tags}
        initialEventMentions={context.eventMentions}
      />
    </div>
  )
}
