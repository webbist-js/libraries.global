import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

export default async function ContributeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <div style={{ background: T.bg.void }}>{children}</div>
    </>
  )
}
