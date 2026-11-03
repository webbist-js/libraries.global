import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { EmptyState } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { RoadmapView } from "@/components/roadmap/RoadmapView"
import { fetchRoadmap } from "@/lib/roadmap-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const [t, content] = await Promise.all([
    getTranslations({ locale, namespace: "roadmap" }),
    fetchRoadmap(locale),
  ])

  return buildMetadata({
    title: content?.title.replaceAll("*", "") ?? t("title"),
    description: content?.lead ?? t("lead"),
    path: "community/roadmap",
    locale,
  })
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const [t, content] = await Promise.all([
    getTranslations({ locale, namespace: "roadmap" }),
    fetchRoadmap(locale),
  ])

  return (
    <>
      <CommunitySectionHeader
        title={content?.title ?? t("title")}
        lead={content?.lead ?? t("lead")}
        leadPlacement="left"
        showEyebrow={false}
      />
      <Container className="py-8 sm:py-12">
        {content ? (
          <RoadmapView content={content} />
        ) : (
          <EmptyState
            icon="mdi:map-marker-path"
            message={t("unavailable")}
            lead={t("unavailableLead")}
          />
        )}
      </Container>
    </>
  )
}
