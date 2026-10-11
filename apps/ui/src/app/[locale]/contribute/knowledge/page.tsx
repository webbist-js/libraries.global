import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import {
  type ArticleKind,
  isArticleKind,
} from "@/components/contribute/article-editor/article.types"
import {
  docsSectionSlugsOf,
  toDocsSections,
} from "@/components/docs/docs.config"
import { sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { T } from "@/lib/design-tokens"
import { editableKinds, requireEditorOrApply } from "@/lib/editor-gate"
import { privateMetadata } from "@/lib/seo/metadata"
import {
  fetchDocsWikiArticles,
  fetchRecentBlogArticles,
  fetchWikiSections,
} from "@/lib/strapi-api/content/server"

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
        draftData?: { title?: unknown; proposedTitle?: unknown } | null
        updatedAt?: string
      }[]
    }

    return (json.data ?? [])
      .filter(
        (s) =>
          s.status === "draft" &&
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
  const tUi = await getUiTranslations("ui")

  const [{ locale }, { type }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/knowledge")
  // Editors only; `?type=` asks for that kind's editor role.
  requireEditorOrApply(session.user, isArticleKind(type) ? type : undefined)

  const caps = sessionCapabilities(session.user)
  const kinds = editableKinds((cap) => caps.set.has(cap))
  const initialKind: ArticleKind =
    isArticleKind(type) && kinds.includes(type) ? type : kinds[0]!

  const [wiki, wikiSections, blog, drafts] = await Promise.all([
    kinds.includes("knowledge")
      ? fetchDocsWikiArticles(locale as Locale)
      : Promise.resolve(null),
    kinds.includes("knowledge")
      ? fetchWikiSections(locale as Locale)
      : Promise.resolve(null),
    kinds.includes("journal")
      ? fetchRecentBlogArticles(locale as Locale)
      : Promise.resolve(null),
    fetchArticleDrafts(session.user).then((list) =>
      list.filter((d) => kinds.includes(d.kind))
    ),
  ])

  const docsSections = toDocsSections(wikiSections?.data)
  const sectionTitle = (slug: string) =>
    docsSections.find((s) => s.slug === slug)?.title ?? slug
  const articles: EditableArticle[] = [
    ...(wiki?.data ?? []).map((a) => {
      return {
        kind: "knowledge" as const,
        documentId: a.documentId,
        slug: a.slug ?? "",
        title: a.title ?? a.slug ?? "Untitled",
        sections: docsSectionSlugsOf(a).map(sectionTitle),
        publishedAt: a.publishedAt ?? null,
        updatedAt: a.updatedAt ?? null,
        contributorCount: 0,
      }
    }),
    ...(blog?.data ?? []).map((a) => ({
      kind: "journal" as const,
      documentId: a.documentId,
      slug: a.slug ?? "",
      title: a.title ?? a.slug ?? "Untitled",
      sections: a.section?.name ? [a.section.name] : [],
      publishedAt: a.publishedAt ?? null,
      updatedAt: a.updatedAt ?? null,
      contributorCount: 0,
    })),
  ]
    .filter((a) => a.slug)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section={tUi("knowledge_editor")}
        title="Write for *the knowledge base.*"
        lead="Add or improve Knowledge articles and Journal stories, or translate them. Tag them to sections so readers can find them."
      />
      <KnowledgeEditorLanding
        articles={articles}
        drafts={drafts}
        initialKind={initialKind}
        kinds={kinds}
      />
    </div>
  )
}
