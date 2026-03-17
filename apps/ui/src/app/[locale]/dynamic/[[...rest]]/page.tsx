import type { Locale } from "next-intl"
import { use } from "react"

import StrapiPageView from "@/components/layouts/StrapiPageView"
import { getMetadataFromStrapi } from "@/lib/metadata"

// Force dynamic rendering (SSR) for this route
export const dynamic = "force-dynamic"

export async function generateMetadata(
  props: PageProps<"/[locale]/dynamic/[[...rest]]">
) {
  const params = await props.params
  const locale = params.locale as Locale

  const slug = (params.rest ?? []).join("/")

  return getMetadataFromStrapi({ slug, locale })
}

export default function DynamicStrapiPage(
  props: PageProps<"/[locale]/dynamic/[[...rest]]">
) {
  const params = use(props.params)
  // This is a dynamic page, so searchParams are available at runtime
  // and can be accessed here
  const searchParams = use(props.searchParams)

  return <StrapiPageView params={params} searchParams={searchParams} />
}
