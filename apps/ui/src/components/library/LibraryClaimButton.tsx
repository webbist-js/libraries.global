"use client"

import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface LibraryClaimButtonProps {
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryEntityRef?: string
}

/**
 * The sidebar's "Work here?" line: a link to ask to look after the record
 * (through sign-in when needed). Hidden for someone who already does.
 */
export function LibraryClaimButton({
  libraryDocumentId,
  librarySlug,
  libraryName,
  libraryEntityRef,
}: LibraryClaimButtonProps) {
  const refParam = libraryEntityRef
    ? `&libraryEntityRef=${encodeURIComponent(libraryEntityRef)}`
    : ""
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [isClaimed, setIsClaimed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session?.user || !libraryEntityRef) {
      const id = setTimeout(() => setIsClaimed(false), 0)

      return () => clearTimeout(id)
    }
    fetch("/api/profile/me/affiliations")
      .then((r) => r.json())
      .then((json: { entityRefs?: string[] }) => {
        setIsClaimed((json.entityRefs ?? []).includes(libraryEntityRef))
      })
      .catch(() => setIsClaimed(false))
  }, [session?.user, libraryEntityRef])

  if (sessionPending || isClaimed === null || isClaimed) return null

  const claimUrl = `/contribute/claim?librarySlug=${encodeURIComponent(librarySlug)}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${encodeURIComponent(libraryDocumentId)}${refParam}`

  return (
    <p
      className="m-0 px-1 text-[13.5px] leading-normal"
      style={{ color: T.ink.dim }}
    >
      Work here?{" "}
      <Link
        href={
          session?.user
            ? claimUrl
            : `/auth/signin?callbackUrl=${encodeURIComponent(claimUrl)}`
        }
        className="font-semibold underline underline-offset-[3px]"
        style={{ color: T.accent.primary }}
      >
        Ask to look after this record
      </Link>
      . A reviewer checks with the library first. Claiming a record
      doesn&rsquo;t mean the library endorses Libraries Global.
    </p>
  )
}
