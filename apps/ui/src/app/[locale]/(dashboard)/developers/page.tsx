import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import {
  ApiWorkspacePage,
  type ApiWorkspaceQuery,
} from "@/components/developers/ApiWorkspacePage"
import { withMessages } from "@/i18n/scoped-messages"
import { offerValues } from "@/lib/plans"
import { buildMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "developersWorkspace" })

  return buildMetadata({
    title: t("metaTitle"),
    description: t("metaDescription", offerValues(locale)),
    path: "developers",
    locale,
  })
}

async function DevelopersPage({
  searchParams,
}: {
  readonly searchParams: Promise<ApiWorkspaceQuery>
}) {
  return <ApiWorkspacePage section="overview" query={await searchParams} />
}

export default withMessages(
  DevelopersPage,
  "[locale]/(dashboard)/developers/page"
)
