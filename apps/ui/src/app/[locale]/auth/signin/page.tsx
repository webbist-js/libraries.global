import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { privateMetadata } from "@/lib/seo/metadata"

import { AuthLeftPanel } from "../_components/AuthLeftPanel"
import { AuthShell } from "../_components/AuthShell"
import { fetchJournalTeaser } from "../_components/fetch-journal-teaser"
import { SignInForm } from "./_components/SignInForm"

export const metadata = privateMetadata("Sign in")

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/auth/signin">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const journal = await fetchJournalTeaser(locale)

  return (
    <AuthShell
      locale={locale}
      aside={<AuthLeftPanel mode="signin" journal={journal} />}
      footnote="Library records stay free, signed in or not."
    >
      <SignInForm />
    </AuthShell>
  )
}
