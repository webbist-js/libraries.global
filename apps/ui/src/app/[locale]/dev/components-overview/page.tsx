import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import ComponentsList from "@/app/[locale]/dev/components-overview/components/ComponentsList"
import Typography from "@/components/typography"

export const dynamic = "force-dynamic"

export default async function ComponentsOverviewPage({
  params,
}: PageProps<"/[locale]/dev/components-overview">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const components: string[] = []

  return (
    <>
      <Typography tag="h1">All Components ({components?.length})</Typography>
      <ComponentsList components={components} />
    </>
  )
}
