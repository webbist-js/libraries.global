"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { auroraCtaSm } from "@/lib/styles"

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
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: T.accent.ok,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          border: `1px solid ${T.accent.ok}40`,
          borderRadius: "10px",
          padding: "8px 14px",
        }}
      >
        You manage this library
      </Link>
    )
  }

  if (!session?.user) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/claim?librarySlug=${librarySlug}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${libraryDocumentId}${refParam}`)}`}
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.40)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
        className="transition-colors hover:text-white"
      >
        Sign in to claim this library
      </Link>
    )
  }

  const claimUrl = `/contribute/claim?librarySlug=${encodeURIComponent(librarySlug)}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${encodeURIComponent(libraryDocumentId)}${refParam}`

  return (
    <Link href={claimUrl} className={auroraCtaSm}>
      Claim this library
    </Link>
  )
}
