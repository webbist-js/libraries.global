import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import { AddLibraryWizard } from "./_components/AddLibraryWizard"

export const metadata = privateMetadata("Add a library")

export default async function AddLibraryPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/add")

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Add to the index"
        title="Add a library *to the index.*"
        lead="Check it isn't already listed, then fill in what you know. Your draft saves as you go, and an editor reviews it before it goes live."
      />
      <AddLibraryWizard
        sessionUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        }}
      />
    </div>
  )
}
