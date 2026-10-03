import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { RoleApplicationForm } from "@/components/contribute/RoleApplicationForm"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { applicationRoleFrom, latestApplications } from "@/lib/role-application"
import {
  fetchAcceptedCount,
  fetchMySubmissions,
} from "@/lib/role-application-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Apply to be an editor")
export const dynamic = "force-dynamic"

export default async function ApplyForEditorRolePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>
}) {
  const [{ role }, session] = await Promise.all([
    searchParams,
    getSessionSSR(await headers()),
  ])
  const initialRole = applicationRoleFrom(role)
  if (!session?.user) {
    const back = `/contribute/knowledge/apply${initialRole ? `?role=${initialRole}` : ""}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }

  const [rows, acceptedCount, locales] = await Promise.all([
    fetchMySubmissions(session.user),
    fetchAcceptedCount(session.user),
    fetchArticleLocales(),
  ])

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Knowledge editor"
        title="Apply to be *an editor.*"
        lead="Knowledge and Journal editors publish their approved changes straight away. A moderator reads every application."
      />
      <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-20 sm:px-8">
        <RoleApplicationForm
          acceptedCount={acceptedCount}
          locales={locales}
          initialRole={initialRole}
          applications={latestApplications(rows)}
        />
      </main>
    </div>
  )
}
