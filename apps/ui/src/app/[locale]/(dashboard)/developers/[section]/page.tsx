import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import type { ApiSection } from "@/components/developers/ApiWorkspace"
import { ApiWorkspacePage } from "@/components/developers/ApiWorkspacePage"
import { withMessages } from "@/i18n/scoped-messages"

const sections = new Set(["keys", "usage", "reference", "playground"])

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ section: string }>
}): Promise<Metadata> {
  const { section } = await params
  if (!sections.has(section)) notFound()
  const t = await getTranslations("developersWorkspace")

  return {
    title: `${t(`sections.${section as ApiSection}.label`)} · API`,
    ...(["keys", "usage"].includes(section)
      ? { robots: { index: false, follow: false } }
      : {}),
  }
}

async function ApiSectionPage({
  params,
}: {
  readonly params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!sections.has(section)) notFound()

  return <ApiWorkspacePage section={section as ApiSection} />
}

export default withMessages(
  ApiSectionPage,
  "[locale]/(dashboard)/developers/[section]/page"
)
