import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { redirect } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationAccessUnavailable } from "../_components/ModerationAccessUnavailable"
import { requireModerator } from "../_components/moderator"

export const metadata = privateMetadata("Discussion moderation")

/** Existing bookmarks retain their access check and open the shared workspace. */
export default async function DiscussionModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const destination = "/moderation?tab=discussions"
  const { scopes, accessUnknown } = await requireModerator(destination)
  if (accessUnknown) {
    const t = await getTranslations("discussions")

    return (
      <ModerationAccessUnavailable title={t("moderation")} path={destination} />
    )
  }
  if (
    !scopes.some(
      (scope) => scope.queue === "all" || scope.queue === "discussions"
    )
  )
    notFound()
  const { locale } = await params
  redirect({
    href: destination,
    locale: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
  })
}
