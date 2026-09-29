import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"
import { IndexRecordWizard } from "../_components/IndexRecordWizard"

export const metadata = privateMetadata("Add a library")

export default async function AddLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/index/new")
  const { name } = await searchParams

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Index editor"
        title="Add a library *to the index.*"
        lead="Fill in what you know. Your draft saves as you go, and an editor reviews it before it goes live."
      />
      <IndexRecordWizard
        mode="new"
        initialData={
          name?.trim() ? { name: name.trim().slice(0, 200) } : undefined
        }
      />
    </div>
  )
}
