import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { RegisterForm } from "./_components/RegisterForm"

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/auth/register">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return <RegisterForm />
}
