"use client"

import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { useStaff } from "@/lib/access-client"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"

const LINK =
  "inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-[3px]"

/**
 * The empty Events card's action: this library's staff connect a feed in
 * the staff area; everyone else is sent to claim the library first, unless
 * their claim is already with a moderator. Nothing is decided until the
 * session is known: a same-height placeholder holds the line meanwhile.
 */
export function LibraryEventsEmptyAction({
  documentId,
  librarySlug,
  libraryName,
}: {
  readonly documentId: string
  readonly librarySlug: string
  readonly libraryName: string
}) {
  const staff = useStaff()
  const { data: session, isPending } = authClient.useSession()
  const signedIn = !!session?.user
  const isStaff = staff.ready && staff.can("edit", documentId)
  // Any affiliation row for this library (a pending claim included) means
  // the claim link has nothing to offer; null until the lookup answers.
  const [claimed, setClaimed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!signedIn || isStaff) {
      const id = setTimeout(() => setClaimed(false), 0)

      return () => clearTimeout(id)
    }
    let live = true
    fetch("/api/profile/me/affiliations")
      .then((r) => r.json())
      .then((json: { libraries?: { documentId: string | null }[] }) => {
        if (live)
          setClaimed(
            (json.libraries ?? []).some((l) => l.documentId === documentId)
          )
      })
      .catch(() => {
        if (live) setClaimed(false)
      })

    return () => {
      live = false
    }
  }, [signedIn, isStaff, documentId])

  if (!staff.ready || isPending || (signedIn && !isStaff && claimed === null))
    return (
      <span
        aria-hidden="true"
        className="block min-h-11 w-48 max-w-full rounded-full"
        style={{ background: T.bg.surface }}
      />
    )
  if (isStaff)
    return (
      <GlobalLink
        href={staffLibraryHref(librarySlug, "/events/connect")}
        className={LINK}
        style={{ color: T.accent.primary }}
      >
        Connect an event feed
      </GlobalLink>
    )
  if (claimed)
    return (
      <span className="block min-h-11 text-sm" style={{ color: T.ink.dim }}>
        Your claim is with a moderator. Once it’s approved you can connect the
        library’s events here.
      </span>
    )
  const claimUrl = `/contribute/claim?librarySlug=${encodeURIComponent(librarySlug)}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${encodeURIComponent(documentId)}`

  return (
    <GlobalLink
      href={
        signedIn
          ? claimUrl
          : `/auth/signin?callbackUrl=${encodeURIComponent(claimUrl)}`
      }
      className={LINK}
      style={{ color: T.accent.primary }}
    >
      Work here? Claim this library to add events
    </GlobalLink>
  )
}
