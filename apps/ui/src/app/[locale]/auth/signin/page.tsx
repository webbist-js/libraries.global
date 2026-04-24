import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { getEnvVar } from "@/lib/env-vars"

import { SignInForm } from "./_components/SignInForm"

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/auth/signin">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return <SignInForm strapiUrl={getEnvVar("STRAPI_URL")} />
}
