import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

import { ContributeNavBar } from "./_components/ContributeNavBar"

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
      <div style={{ background: "#030511" }}>
        <ContributeNavBar />
        {children}
      </div>
    </>
  )
}
