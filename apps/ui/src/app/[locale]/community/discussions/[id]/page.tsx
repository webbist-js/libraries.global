import { notFound } from "next/navigation"

import { DiscussionsSectionHeader } from "@/components/discussions/DiscussionsSectionHeader"
import { DiscussionThread } from "@/components/discussions/DiscussionThread"
import { Container } from "@/components/elementary/Container"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { privateMetadata } from "@/lib/seo/metadata"

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
  const languages = await fetchArticleLocales()

  return (
    <>
      <DiscussionsSectionHeader />
      <Container className="py-8 sm:py-10">
        <DiscussionThread id={id} languages={languages} />
      </Container>
    </>
  )
}
