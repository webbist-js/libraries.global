import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { POST_SIGNIN_PATH } from "@/lib/auth-redirects"
import { privateMetadata } from "@/lib/seo/metadata"

import { MagicLinkErrorContent } from "./_components/MagicLinkErrorContent"

export const metadata = privateMetadata("Sign-in link")

export default async function MagicLinkPage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/magic-link">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const { error } = await searchParams

  // Only a failed link comes here; without an error there's nothing to say,
  // and post-signin sends the visitor on (or to sign-in).
  if (typeof error !== "string" || !error) redirect(POST_SIGNIN_PATH)

  return (
    <UtilityPage>
      <MagicLinkErrorContent error={error} />
    </UtilityPage>
  )
}
