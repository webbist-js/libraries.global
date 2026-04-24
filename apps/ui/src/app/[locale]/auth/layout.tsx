import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[locale]/auth">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <div className="relative isolate flex min-h-screen w-full bg-[#050816] text-white">
      {children}
    </div>
  )
}
