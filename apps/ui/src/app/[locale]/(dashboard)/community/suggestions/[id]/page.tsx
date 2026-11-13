import { isSupportedLocale } from "@repo/shared-data"
import { notFound } from "next/navigation"

import { withMessages } from "@/i18n/scoped-messages"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { suggestionHref } from "@/lib/community/suggestions"
import { redirect } from "@/lib/navigation"

/** Preserve old shared links while conversations now live on their board cards. */
async function SuggestionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!isDocumentIdParam(id) || !isSupportedLocale(locale)) notFound()
  redirect({ href: suggestionHref(id), locale })
}

export default withMessages(
  SuggestionPage,
  "[locale]/(dashboard)/community/suggestions/[id]/page"
)
