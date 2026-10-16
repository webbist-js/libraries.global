import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { DiscussionThread } from "@/components/discussions/DiscussionThread"
import { Container } from "@/components/elementary/Container"
import { privateMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../../_components/CommunitySectionHeader"

export const metadata = privateMetadata("Discussion")
export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (
    !/^(?:[a-z0-9]{20,32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(
      id
    )
  )
    notFound()
  const t = await getTranslations("discussions")

  return (
    <>
      <CommunitySectionHeader
        section={t("threads")}
        title={t("title")}
        lead={t("reviewLead")}
      />
      <Container className="max-w-[1000px] py-10">
        <DiscussionThread id={id} />
      </Container>
    </>
  )
}
