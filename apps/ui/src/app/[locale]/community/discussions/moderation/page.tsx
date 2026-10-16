import { getTranslations } from "next-intl/server"

import { DiscussionModeration } from "@/components/discussions/DiscussionModeration"
import { Container } from "@/components/elementary/Container"
import { privateMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../../_components/CommunitySectionHeader"

export const metadata = privateMetadata("Discussion moderation")
export default async function DiscussionModerationPage() {
  const t = await getTranslations("discussions")

  return (
    <>
      <CommunitySectionHeader
        section={t("moderation")}
        title={t("moderation")}
      />
      <Container className="py-10">
        <DiscussionModeration />
      </Container>
    </>
  )
}
