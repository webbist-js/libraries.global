import type { Metadata } from "next"
import { headers } from "next/headers"

import { MainContent } from "@/components/ds/MainContent"
import { LiveInstall } from "@/components/mobile/live/LiveInstall"
import { T } from "@/lib/design-tokens"
import { mobileAppConfig, mobilePath } from "@/lib/mobile-app"

export const dynamic = "force-dynamic"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const mobile = (await headers()).get("x-mobile-app") === "true"

  return {
    ...(mobile ? { metadataBase: mobileAppConfig()!.mobile } : {}),
    title: "Live console",
    robots: { index: false, follow: false },
    manifest: mobile
      ? mobilePath("manifest.webmanifest", locale)
      : `/${locale}/live/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: "Libraries Live",
      statusBarStyle: "default",
    },
  }
}
export default async function LiveLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const mobile = (await headers()).get("x-mobile-app") === "true"

  return (
    <MainContent
      className="live-console mx-auto min-h-dvh w-full max-w-[480px] p-4 sm:border-x"
      style={{ background: T.bg.void, borderColor: T.border.line }}
    >
      <LiveInstall locale={locale} mobileApp={mobile} />
      {children}
    </MainContent>
  )
}
