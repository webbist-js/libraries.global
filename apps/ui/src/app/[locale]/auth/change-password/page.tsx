import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { getSessionSSR, hasPasswordSignIn } from "@/lib/auth-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { AuthLeftPanel } from "../_components/AuthLeftPanel"
import { AuthShell } from "../_components/AuthShell"
import { ChangePasswordForm } from "./_components/ChangePasswordForm"

export const metadata = privateMetadata("Change password")

export default async function ChangePasswordPage({
  params,
}: PageProps<"/[locale]/auth/change-password">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  // authGuard sends signed-out visitors to sign-in first; this is the backstop.
  const requestHeaders = await headers()
  const session = await getSessionSSR(requestHeaders)
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent("/auth/change-password")}`
    )
  const hasPassword = await hasPasswordSignIn(requestHeaders)

  return (
    <AuthShell
      locale={locale}
      aside={<AuthLeftPanel mode="account" />}
      footnote="Passwords are stored hashed: nobody here can read yours."
      back={{ href: "/profile/settings", label: "Back to settings" }}
    >
      <ChangePasswordForm
        hasPassword={hasPassword}
        email={session.user.email}
      />
    </AuthShell>
  )
}
