import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { OrganisationPicker } from "@/components/event-feeds/OrganisationPicker"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Choose an organisation")

export default async function EventbriteOrganisationPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=/contribute/events/${documentId}/organisation`
    )
  const caps = (session.user as { capabilities?: string[] }).capabilities ?? []
  if (!caps.includes("events.feed")) notFound()

  const result = await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
    session.user
  )
  const libraries = result.body?.data?.libraries ?? []

  let libraryDocumentId: string | undefined
  let organizations: { id: string; name: string }[] | undefined
  for (const entry of libraries) {
    const feed = entry.feeds.find(
      (f) => f.documentId === documentId && f.status === "draft"
    )
    if (!feed) continue
    const orgs = (feed.hints as Record<string, unknown>).organizations
    if (Array.isArray(orgs) && orgs.length > 0) {
      libraryDocumentId = entry.library.documentId
      organizations = orgs as { id: string; name: string }[]
    }
    break
  }
  if (!libraryDocumentId || !organizations) notFound()

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section="Choose an organisation"
        title="Choose an *Eventbrite organisation.*"
        back
      />
      <div className="mx-auto w-full max-w-[640px] px-4 pt-10 pb-20 sm:px-8">
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.dim,
            marginTop: 0,
          }}
        >
          Your Eventbrite account has more than one organisation. Choose the one
          whose events this library should show.
        </p>
        <OrganisationPicker
          documentId={documentId}
          libraryDocumentId={libraryDocumentId}
          organizations={organizations}
        />
      </div>
    </div>
  )
}
