import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { loadLibraryEditor } from "@/lib/library-editor-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Improve a library record")

export default async function ImproveLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{
    locale?: string | string[]
    step?: string | string[]
    draft?: string
  }>
}) {
  const [{ slug }, query, session, t] = await Promise.all([
    params,
    searchParams,
    getSessionSSR(await headers()),
    getTranslations("ui"),
  ])
  if (!session?.user) {
    const qs = new URLSearchParams()
    if (typeof query.locale === "string") qs.set("locale", query.locale)
    if (typeof query.step === "string") qs.set("step", query.step)
    if (query.draft) qs.set("draft", query.draft)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/index/${slug}${qs.size ? `?${qs}` : ""}`)}`
    )
  }
  const bootstrap = await loadLibraryEditor(
    slug,
    session.user,
    query.locale,
    Array.isArray(query.step) ? query.step[0] : query.step,
    query.draft
  )
  if (!bootstrap) notFound()
  if (bootstrap.staffHref) redirect(bootstrap.staffHref)

  return (
    <div style={{ color: T.ink.base }}>
      <ContributeSectionHeader
        compact
        section={t("index_editor")}
        title={`${bootstrap.locale?.code !== bootstrap.locale?.defaultCode ? "Translate" : "Improve"} *${bootstrap.target!.name}.*`}
        lead="Change only what you can source. An editor checks each change against your source before it goes live, credited to you."
      />
      <IndexRecordWizard mode="improve" {...bootstrap} />
    </div>
  )
}
