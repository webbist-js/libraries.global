import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { ClaimLibraryForm } from "./_components/ClaimLibraryForm"

export const metadata = privateMetadata("Claim a library")

export default async function ClaimLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    librarySlug?: string
    libraryName?: string
    libraryDocumentId?: string
    libraryEntityRef?: string
  }>
}) {
  const session = await getSessionSSR(await headers())
  const params = await searchParams

  if (!session?.user) {
    const callbackUrl = `/contribute/claim?librarySlug=${params.librarySlug ?? ""}&libraryName=${encodeURIComponent(params.libraryName ?? "")}&libraryDocumentId=${params.libraryDocumentId ?? ""}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const { librarySlug, libraryName, libraryDocumentId, libraryEntityRef } =
    params

  if (!libraryDocumentId || !librarySlug) {
    redirect("/contribute")
  }

  return (
    <ClaimLibraryForm
      libraryDocumentId={libraryDocumentId}
      librarySlug={librarySlug}
      libraryName={libraryName ?? librarySlug}
      libraryEntityRef={libraryEntityRef}
    />
  )
}
