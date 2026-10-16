import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DiscussionsBoard } from "@/components/discussions/DiscussionsBoard"
import { Container } from "@/components/elementary/Container"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"

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

export default async function DiscussionsPage() {
  const [t, languages] = await Promise.all([
    getTranslations("discussions"),
    fetchArticleLocales(),
  ])

  return (
    <>
      <CommunitySectionHeader
        section={t("threads")}
        title={t("title")}
        lead={t("lead")}
      />
      <Container className="py-10">
        <DiscussionsBoard languages={languages} />
      </Container>
    </>
  )
}
