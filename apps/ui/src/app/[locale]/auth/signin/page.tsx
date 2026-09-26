import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { privateMetadata } from "@/lib/seo/metadata"

import { SignInForm } from "./_components/SignInForm"

export const metadata = privateMetadata("Sign in")

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/auth/signin">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <>
      <span data-hide-footer="true" hidden />
      <SignInForm />
    </>
  )
}
