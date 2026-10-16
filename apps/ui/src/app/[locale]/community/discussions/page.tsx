import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DiscussionsBoard } from "@/components/discussions/DiscussionsBoard"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { buildMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations("discussions")

  return buildMetadata({
    title: t("title"),
    description: t("lead"),
    path: "community/discussions",
    locale,
    robots: "noindex-follow",
  })
}

export default async function DiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [query, languages] = await Promise.all([
    searchParams,
    fetchArticleLocales(),
  ])
  const initialSearch = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      typeof value === "string" &&
      ["subject", "lang", "view", "q"].includes(key)
        ? [[key, value]]
        : []
    )
  ).toString()

  return (
    <DiscussionsBoard languages={languages} initialSearch={initialSearch} />
  )
}
