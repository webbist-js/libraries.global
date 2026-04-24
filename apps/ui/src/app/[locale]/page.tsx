import { use } from "react"

import { LibraryHomePage } from "@/components/home/LibraryHomePage"
import { getSingleTypeMetadataFromStrapi } from "@/lib/metadata"
import type { Locale } from "@/lib/strapi-api/types"

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}) {
  const params = await props.params

  return getSingleTypeMetadataFromStrapi({
    locale: params.locale as Locale,
    uid: "api::homepage.homepage",
  })
}

export default function HomePage(props: {
  params: Promise<{ locale: string }>
}) {
  const params = use(props.params)

  return <LibraryHomePage locale={params.locale as Locale} />
}
