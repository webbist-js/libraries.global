import { canDirectEdit } from "@repo/access"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import {
  type ArticleKind,
  isArticleKind,
} from "@/components/contribute/article-editor/article.types"
import { sessionCapabilities } from "@/lib/access-server"
import { fetchArticleBrowse } from "@/lib/article-discovery"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { preferredContentLanguage } from "@/lib/content-language"
import { T } from "@/lib/design-tokens"
import { ownsJournalArticle } from "@/lib/journal-ownership-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import {
  type ArticleDraftSummary,
  type EditableArticle,
  KnowledgeEditorLanding,
} from "./_components/KnowledgeEditorLanding"

export const metadata = privateMetadata("Knowledge editor")
export const dynamic = "force-dynamic"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** The signed-in user's unsent article drafts, via the moderation bridge. */
async function fetchArticleDrafts(user: {
  id: string
  email: string
  name?: string | null
}): Promise<ArticleDraftSummary[]> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return []
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: bridgeUserHeaders(user),
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        documentId: string
        submissionType?: string
        status?: string
        targetSlug?: string | null
        draftData?: {
          title?: unknown
          proposedTitle?: unknown
          locale?: string
          contentLocale?: string
          sourceLocale?: string
        } | null
        updatedAt?: string
      }[]
    }

    return (json.data ?? [])
      .filter(
        (s) =>
          ["draft", "needs_info", "pending"].includes(s.status ?? "") &&
          (s.submissionType === "wiki_edit" ||
            s.submissionType === "blog_submission") &&
          s.draftData
      )
      .slice(0, 6)
      .map((s) => ({
        kind: s.submissionType === "blog_submission" ? "journal" : "knowledge",
        documentId: s.documentId,
        title:
          typeof s.draftData?.title === "string"
            ? s.draftData.title
            : typeof s.draftData?.proposedTitle === "string"
              ? s.draftData.proposedTitle
              : "",
        targetSlug: s.targetSlug ?? null,
        locale: s.draftData?.contentLocale ?? s.draftData?.locale ?? null,
        status: s.status ?? "draft",
        sourceLocale: s.draftData?.sourceLocale ?? null,
        updatedAt: s.updatedAt ?? new Date(0).toISOString(),
      }))
  } catch {
    return []
  }
}

export default async function KnowledgeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const p = await getUiTranslations("writeWorkspace")

  const [{ locale }, { type }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  if (!session?.user)
    return (
      <FeatureAccessLanding
        feature="writing"
        returnTo={
          isArticleKind(type) ? `/contribute/knowledge?type=${type}` : undefined
        }
      />
    )
  const caps = sessionCapabilities(session.user)
  const creatableKinds: ArticleKind[] = [
    "journal",
    ...(caps.set.has("docs.directEdit") ? ["knowledge" as const] : []),
  ]
  const kinds: ArticleKind[] = ["journal", "knowledge"]
  const initialKind: ArticleKind = isArticleKind(type) ? type : "journal"
  const locales = await fetchArticleLocales()
  const preferredLocale = preferredContentLanguage(
    locale,
    session.user.compositionPreferences,
    locales.map((item) => item.code)
  )
  const [wiki, blog, drafts] = await Promise.all([
    fetchArticleBrowse(
      "wiki",
      `preferredLocale=${encodeURIComponent(preferredLocale)}&groupBy=document&pageSize=12`
    ).catch(() => null),
    fetchArticleBrowse(
      "blog",
      `preferredLocale=${encodeURIComponent(preferredLocale)}&groupBy=document&collection=all&pageSize=12`
    ).catch(() => null),
    fetchArticleDrafts(session.user),
  ])
  const articles: EditableArticle[] = await Promise.all(
    [
      ...(wiki?.items ?? []).map((a) => ({ ...a, kind: "knowledge" as const })),
      ...(blog?.items ?? []).map((a) => ({ ...a, kind: "journal" as const })),
    ].map(async (a) => {
      const owned =
        a.kind === "journal" && (await ownsJournalArticle(session.user, a.slug))

      return {
        kind: a.kind,
        documentId: a.documentId,
        slug: a.slug,
        title: a.title,
        sections: a.facets.sections?.map((section) => section.label) ?? [],
        publishedAt: a.publishedAt,
        updatedAt: a.updatedAt,
        locale: a.locale,
        translations: a.translations,
        publicPath:
          a.kind === "journal"
            ? `/journal/${a.section?.slug ?? "general"}/${a.slug}`
            : `/knowledge/${a.sectionSlugs[0] ?? a.section?.slug ?? "general"}/${a.slug}`,
        owned,
        canEdit:
          canDirectEdit(
            caps,
            a.kind === "journal" ? "journal" : "docs",
            a.locale
          ) || owned,
      }
    })
  )

  return (
    <div style={{ color: T.ink.base }}>
      <ContributeSectionHeader
        compact
        section={p("write")}
        title={p("title")}
        lead={p("lead")}
      />
      <KnowledgeEditorLanding
        articles={articles}
        locales={locales}
        initialLocale={preferredLocale}
        initialFilter={isArticleKind(type) ? type : undefined}
        initialTotal={
          type === "journal"
            ? (blog?.total ?? 0)
            : type === "knowledge"
              ? (wiki?.total ?? 0)
              : (wiki?.total ?? 0) + (blog?.total ?? 0)
        }
        initialPageCount={
          type === "journal"
            ? (blog?.pageCount ?? 1)
            : type === "knowledge"
              ? (wiki?.pageCount ?? 1)
              : Math.max(wiki?.pageCount ?? 1, blog?.pageCount ?? 1)
        }
        initialFailed={!wiki || !blog}
        drafts={drafts}
        initialKind={initialKind}
        kinds={kinds}
        creatableKinds={creatableKinds}
      />
    </div>
  )
}
