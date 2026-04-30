"use client"

import Link from "next/link"

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

  if (sessionPending) return null

  if (!session?.user) {
    return (
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(`/contribute/claim?librarySlug=${librarySlug}&libraryName=${encodeURIComponent(libraryName)}&libraryDocumentId=${libraryDocumentId}${refParam}`)}`}
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: T.ink.faint,
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
