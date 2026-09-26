import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { privateMetadata } from "@/lib/seo/metadata"

import { RegisterForm } from "./_components/RegisterForm"

export const metadata = privateMetadata("Create an account")

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/auth/register">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <>
      <span data-hide-footer="true" hidden />
      <RegisterForm />
    </>
  )
}
