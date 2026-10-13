import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { privateMetadata } from "@/lib/seo/metadata"

import { MagicLinkSentContent } from "./_components/MagicLinkSentContent"

export const metadata = privateMetadata("Check your email")

export default async function MagicLinkSentPage({
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
