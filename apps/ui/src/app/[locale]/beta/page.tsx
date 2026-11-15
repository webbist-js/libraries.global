import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { betaDestination } from "@/lib/beta/access"

/** Preserve old invitation links without requiring a code or creating a pass. */
export default async function RetiredBetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  const fallback = locale === "en" ? "/" : `/${locale}`
  redirect(betaDestination((await searchParams).next, fallback))
}
