import { headers } from "next/headers"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { DashboardShell } from "@/components/dashboard/DashboardShell"

export default async function DashboardLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale as Locale)

  if ((await headers()).get("x-beta-public-shell") === "true") return children

  return <DashboardShell locale={locale as Locale}>{children}</DashboardShell>
}
