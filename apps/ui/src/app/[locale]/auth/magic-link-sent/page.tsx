import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { withMessages } from "@/i18n/scoped-messages"
import { privateMetadata } from "@/lib/seo/metadata"

import { MagicLinkSentContent } from "./_components/MagicLinkSentContent"

export const metadata = privateMetadata("Check your email")

async function MagicLinkSentPage({
  params,
}: PageProps<"/[locale]/auth/magic-link-sent">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <UtilityPage>
      <MagicLinkSentContent />
    </UtilityPage>
  )
}

export default withMessages(
  MagicLinkSentPage,
  "[locale]/auth/magic-link-sent/page"
)
