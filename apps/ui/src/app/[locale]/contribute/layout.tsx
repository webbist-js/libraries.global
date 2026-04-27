import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

import { ContributeBottomNav } from "./_components/ContributeBottomNav"

export default async function ContributeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const navbarResult = await fetchNavbar(locale as Locale)

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <div style={{ paddingBottom: "60px" }}>{children}</div>
      <ContributeBottomNav />
    </>
  )
}
