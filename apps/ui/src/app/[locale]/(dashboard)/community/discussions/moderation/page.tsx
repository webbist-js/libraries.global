import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { withMessages } from "@/i18n/scoped-messages"
import { redirect } from "@/lib/navigation"

/** Direct discussion review links into the standalone moderation workspace. */
async function DiscussionModerationRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect({
    href: "/moderation?tab=discussions",
    locale: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
  })
}

export default withMessages(
  DiscussionModerationRedirect,
  "[locale]/(dashboard)/community/discussions/moderation/page"
)
