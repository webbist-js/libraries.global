import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { isArticleKind } from "@/components/contribute/article-editor/article.types"
import { ArticleEditorShell } from "@/components/contribute/article-editor/ArticleEditorShell"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { requireEditorOrApply } from "@/lib/editor-gate"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Write an article")
export const dynamic = "force-dynamic"

export default async function NewArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string; draft?: string; section?: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, query, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  const kind = isArticleKind(query.type) ? query.type : "knowledge"
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/knowledge/new?type=${kind}`)}`
    )
  requireEditorOrApply(session.user, kind)
  const locales = await fetchArticleLocales()
  const resumeDraftId =
    query.draft && isDocumentIdParam(query.draft) ? query.draft : undefined

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
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
      />
    </div>
  )
}
