import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { docsSectionForArticle } from "@/components/docs/docs.config"
import { hasCapability } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchDocsWikiArticles } from "@/lib/strapi-api/content/server"

import { DocsEditShell } from "./_components/DocsEditShell"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return {
    title: `Edit article: ${slug} / Knowledge`,
    robots: "noindex, nofollow",
  }
}

export default async function EditDocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const session = await getSessionSSR(await headers())

  if (!session?.user)
    redirect(`/auth/signin?callbackUrl=/contribute/knowledge/${slug}`)

  const articles = (await fetchDocsWikiArticles(locale as Locale))?.data ?? []
  const article = articles.find((a) => a.slug === slug)
  if (!article) notFound()

  const canDirectEdit = hasCapability(session.user, "docs.directEdit")

  return (
    <DocsEditShell
      article={{
        title: article.title ?? article.slug ?? "Untitled",
        slug: article.slug!,
        summary: article.summary ?? null,
        body: (article.body ?? []) as Record<string, unknown>[],
        sectionKey: docsSectionForArticle(article),
      }}
      canDirectEdit={canDirectEdit}
      locale={locale}
    />
  )
}
