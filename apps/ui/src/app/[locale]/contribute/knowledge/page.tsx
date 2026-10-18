import { canDirectEdit } from "@repo/access"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import {
  type ArticleKind,
  isArticleKind,
} from "@/components/contribute/article-editor/article.types"
import { sessionCapabilities } from "@/lib/access-server"
import { fetchArticleBrowse } from "@/lib/article-discovery"
import { getSessionSSR } from "@/lib/auth-server"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
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
  const p = await getUiTranslations("publishing")

  const [{ locale }, { type }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/knowledge")
  const caps = sessionCapabilities(session.user)
  const creatableKinds: ArticleKind[] = [
    "journal",
    ...(caps.set.has("docs.directEdit") ? ["knowledge" as const] : []),
  ]
  const kinds: ArticleKind[] = ["journal", "knowledge"]
  const initialKind: ArticleKind = isArticleKind(type) ? type : "journal"
  const [wiki, blog, drafts] = await Promise.all([
    fetchArticleBrowse(
      "wiki",
      `preferredLocale=${encodeURIComponent(locale)}&pageSize=24`
    ).catch(() => null),
    fetchArticleBrowse(
      "blog",
      `preferredLocale=${encodeURIComponent(locale)}&collection=all&pageSize=24`
    ).catch(() => null),
    fetchArticleDrafts(session.user),
  ])
  const articles: EditableArticle[] = await Promise.all(
    [
      ...(wiki?.items ?? []).map((a) => ({ ...a, kind: "knowledge" as const })),
      ...(blog?.items ?? []).map((a) => ({ ...a, kind: "journal" as const })),
    ].map(async (a) => ({
      kind: a.kind,
      documentId: a.documentId,
      slug: a.slug,
      title: a.title,
      sections: a.facets.sections?.map((section) => section.label) ?? [],
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      locale: a.locale,
      publicPath:
        a.kind === "journal"
          ? `/journal/${a.section?.slug ?? "general"}/${a.slug}`
          : `/knowledge/${a.sectionSlugs[0] ?? a.section?.slug ?? "general"}/${a.slug}`,
      canEdit:
        canDirectEdit(
          caps,
          a.kind === "journal" ? "journal" : "docs",
          a.locale
        ) ||
        (a.kind === "journal" &&
          (await ownsJournalArticle(session.user, a.slug))),
    }))
  )

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section={p("newWriting")}
        title={p("newWriting")}
        lead={p("writingLead")}
      />
      <KnowledgeEditorLanding
        articles={articles}
        drafts={drafts}
        initialKind={initialKind}
        kinds={kinds}
        creatableKinds={creatableKinds}
      />
    </div>
  )
}
