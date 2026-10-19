import "server-only"

import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { preferredContentLanguage } from "@/lib/content-language"
import { fetchContentLocales } from "@/lib/content-locales-server"

/** Resolve per request: profile preferences must never enter a shared page cache. */
export async function getPreferredContentLanguage(interfaceLocale: string) {
  const [session, locales] = await Promise.all([
    getSessionSSR(await headers()),
    fetchContentLocales(),
  ])

  return preferredContentLanguage(
    interfaceLocale,
    session?.user.compositionPreferences,
    locales?.map((locale) => locale.code)
  )
}
