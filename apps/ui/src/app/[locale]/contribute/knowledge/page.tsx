import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import {
  type ArticleKind,
  isArticleKind,
} from "@/components/contribute/article-editor/article.types"
import {
  DOCS_SECTIONS,
  docsSectionForArticle,
  docsSectionsOf,
} from "@/components/docs/docs.config"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"
import {
  fetchDocsWikiArticles,
  fetchRecentBlogArticles,
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
async function fetchArticleDrafts(
  baUserId: string
): Promise<ArticleDraftSummary[]> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return []
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": secret,
        "X-Ba-User-Id": baUserId,
        "X-Ba-User-Email": "",
      },
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
  const [{ locale }, { type }, session] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
  ])
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/knowledge")

  const capabilities = ((session.user as { capabilities?: unknown })
    .capabilities ?? []) as string[]
  const canWriteJournal = capabilities.includes("journal.directEdit")
  const initialKind: ArticleKind = isArticleKind(type)
    ? type
    : canWriteJournal && !capabilities.includes("docs.directEdit")
      ? "journal"
      : "knowledge"

  const [wiki, blog, drafts] = await Promise.all([
    fetchDocsWikiArticles(locale as Locale),
    fetchRecentBlogArticles(locale as Locale),
    fetchArticleDrafts(session.user.id),
  ])

  const sectionTitle = (key: string) =>
    DOCS_SECTIONS.find((s) => s.key === key)?.title ?? key
  const articles: EditableArticle[] = [
    ...(wiki?.data ?? []).map((a) => {
      const tagged = docsSectionsOf(a)
      const keys = tagged.length > 0 ? tagged : [docsSectionForArticle(a)]

      return {
        kind: "knowledge" as const,
        documentId: a.documentId,
        slug: a.slug ?? "",
        title: a.title ?? a.slug ?? "Untitled",
        sections: keys.map(sectionTitle),
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
        section="Knowledge editor"
        title="Write for *the knowledge base.*"
        lead="Add or improve Knowledge articles and Journal stories, or translate them. Tag them to sections so readers can find them."
      />
      <KnowledgeEditorLanding
        articles={articles}
        drafts={drafts}
        initialKind={initialKind}
        canWriteJournal={canWriteJournal}
      />
    </div>
  )
}
