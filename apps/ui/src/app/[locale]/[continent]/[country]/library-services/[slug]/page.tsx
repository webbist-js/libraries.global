import { networkHref } from "@repo/shared-data"
import { notFound, permanentRedirect } from "next/navigation"

import { publicNetworkDetail } from "@/lib/networks/server"

export default async function NetworkCountryAlias({
  params,
}: {
  readonly params: Promise<{
    locale: string
    continent: string
    country: string
    slug: string
  }>
}) {
  const { locale, continent, country, slug } = await params,
    data = await publicNetworkDetail(slug)
  if (
    !data ||
    !data.network.countries.some(
      (row) => row.slug === country && row.continentSlug === continent
    )
  )
    notFound()
  permanentRedirect(
    `${locale === "en" ? "" : `/${locale}`}${networkHref(data.network.slug)}`
  )
}
