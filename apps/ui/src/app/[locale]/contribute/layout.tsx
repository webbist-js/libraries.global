import type { Metadata } from "next"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

// Default for every /contribute/* route: forms and auth-gated flows are not
// indexable. The hub (contribute/page.tsx) overrides this with index,follow.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
