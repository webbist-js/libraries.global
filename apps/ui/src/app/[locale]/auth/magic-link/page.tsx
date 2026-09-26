import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { MagicLinkVerifyContent } from "./_components/MagicLinkVerifyContent"

export const metadata = privateMetadata("Signing you in")

export default function MagicLinkPage({
  params,
}: PageProps<"/[locale]/auth/magic-link">) {
  const { locale } = use(params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6 py-16"
      style={{ background: T.bg.space }}
    >
      <MagicLinkVerifyContent />
    </div>
  )
}
