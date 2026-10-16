import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { redirect } from "@/lib/navigation"

/** Retain old bookmarks while moderation lives in the contribution workflow. */
export default async function DiscussionModerationRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect({
    href: "/contribute/moderation/discussions",
    locale: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
  })
}
