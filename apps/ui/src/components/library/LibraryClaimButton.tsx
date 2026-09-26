"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

interface LibraryClaimButtonProps {
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryEntityRef?: string
}

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

  if (sessionPending || isClaimed === null) return null

  if (isClaimed) {
    return (
      <Link
        href={`/contribute/edit/${librarySlug}`}
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--tint-public-fg)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          border: `1px solid var(--tint-public-fg)`,
          borderRadius: "999px",
          padding: "8px 14px",
          background: "var(--tint-public-bg)",
        }}
      >
        ✓ You manage this library
      </Link>
    )
  }

  const claimUrl = `/contribute/claim?librarySlug=${encodeURIComponent(librarySlug)}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${encodeURIComponent(libraryDocumentId)}${refParam}`

  return (
    <Link
      href={
        session?.user
          ? claimUrl
          : `/auth/signin?callbackUrl=${encodeURIComponent(claimUrl)}`
      }
      style={{
        fontSize: "15px",
        fontWeight: 600,
        color: T.accent.primary,
        textUnderlineOffset: "3px",
      }}
    >
      Work here? Request stewardship
    </Link>
  )
}
