import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { DiscussionModeration } from "@/components/discussions/DiscussionModeration"
import { Container } from "@/components/elementary/Container"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationAccessUnavailable } from "../_components/ModerationAccessUnavailable"
import { ModerationHero } from "../_components/ModerationHero"
import { requireModerator } from "../_components/moderator"

export const metadata = privateMetadata("Discussion moderation")

export default async function DiscussionModerationPage() {
  const { scopes, accessUnknown } = await requireModerator(
    "/contribute/moderation/discussions"
  )
  const t = await getTranslations("discussions")
  if (accessUnknown)
    return (
      <ModerationAccessUnavailable
        title={t("moderation")}
        leaf={t("threads")}
        path="/contribute/moderation/discussions"
      />
    )
  if (
    !scopes.some(
      (scope) => scope.queue === "all" || scope.queue === "discussions"
    )
  )
    notFound()

  return (
    <>
      <ModerationHero
        title={t("moderation")}
        leaf={t("threads")}
        lead={t("moderationLead")}
      />
      <Container className="max-w-[1100px] py-10">
        <DiscussionModeration />
      </Container>
    </>
  )
}
