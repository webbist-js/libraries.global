import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

import StrapiStructuredData from "@/components/page-builder/components/seo-utilities/StrapiStructuredData"
import { fetchPage } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

interface Props {
  params: {
    locale: string
    rest?: string[]
  }
  searchParams?: Record<string, string | string[] | undefined>
}

export default function StrapiPageView({ params, searchParams }: Props) {
  const locale = params.locale as Locale

  setRequestLocale(locale)

  const slug = (params.rest ?? []).join("/")
  const response = use(fetchPage(slug, locale))

  const data = response?.data

  if (data == null) {
    notFound()
  }

  return (
    <>
      <StrapiStructuredData structuredData={data?.seo?.structuredData} />

      <main className={cn("flex w-full flex-col overflow-hidden")} />
    </>
  )
}
