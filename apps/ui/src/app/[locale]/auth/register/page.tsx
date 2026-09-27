import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { privateMetadata } from "@/lib/seo/metadata"

import { AuthLeftPanel } from "../_components/AuthLeftPanel"
import { AuthShell } from "../_components/AuthShell"
import { RegisterForm } from "./_components/RegisterForm"

export const metadata = privateMetadata("Create an account")

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/auth/register">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <AuthShell
      locale={locale}
      aside={<AuthLeftPanel mode="register" />}
      footnote="We never share your email."
    >
      <RegisterForm />
    </AuthShell>
  )
}
