import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"
import { fetchLibrary } from "@/lib/strapi-api/content/server"

import { EditLibraryShell } from "./_components/EditLibraryShell"
import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Edit library record")

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function fetchOwnershipProfile(
  baUserId: string,
  entityRef: string
): Promise<{
  isVerifiedLibrarian: boolean
  claimedLibraryEntityRef: string | null
}> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return { isVerifiedLibrarian: false, claimedLibraryEntityRef: null }
  try {
    const res = await fetch(
      `${STRAPI}/api/auth-bridge/claim-status?baUserId=${encodeURIComponent(baUserId)}&entityRef=${encodeURIComponent(entityRef)}`,
      {
        cache: "no-store",
        headers: { "X-Service-Secret": secret },
      }
    )
    if (!res.ok)
      return { isVerifiedLibrarian: false, claimedLibraryEntityRef: null }
    const json = (await res.json()) as {
      isVerifiedLibrarian?: boolean
      claimedLibraryEntityRef?: string | null
    }

    return {
      isVerifiedLibrarian: json.isVerifiedLibrarian ?? false,
      claimedLibraryEntityRef: json.claimedLibraryEntityRef ?? null,
    }
  } catch {
    return { isVerifiedLibrarian: false, claimedLibraryEntityRef: null }
  }
}

export default async function EditLibraryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const [session, libraryRes] = await Promise.all([
    getSessionSSR(await headers()),
    fetchLibrary(slug, locale as Locale),
  ])

  if (!session?.user)
    redirect(`/auth/signin?callbackUrl=/contribute/edit/${slug}`)

  const library = libraryRes?.data
  if (!library) notFound()

  // Check ownership
  const libraryEntityRef = (library as Record<string, unknown>).entityRef as
    | string
    | null
    | undefined
  const ownerProfile = libraryEntityRef
    ? await fetchOwnershipProfile(session.user.id, libraryEntityRef)
    : { isVerifiedLibrarian: false, claimedLibraryEntityRef: null }
  const isOwner =
    ownerProfile.isVerifiedLibrarian && !!ownerProfile.claimedLibraryEntityRef

  if (!isOwner) {
    const refParam = libraryEntityRef
      ? `&libraryEntityRef=${encodeURIComponent(libraryEntityRef)}`
      : ""
    const nameParam = `&libraryName=${encodeURIComponent(((library as Record<string, unknown>).name as string) ?? slug)}`
    redirect(
      `/contribute/claim?librarySlug=${encodeURIComponent(slug)}&libraryDocumentId=${encodeURIComponent(library.documentId ?? "")}${nameParam}${refParam}`
    )
  }

  // Build initialData from all available library fields
  const lib = library as Record<string, unknown>
  const initialData = {
    name: (lib.name as string) ?? "",
    shortName: (lib.shortName as string) ?? "",
    officialName: (lib.officialName as string) ?? "",
    summary: (lib.summary as string) ?? "",
    libraryType: (lib.libraryType as string) ?? "",
    operatorType: (lib.operatorType as string) ?? "",
    operationalStatus: (lib.operationalStatus as string) ?? "",
    closureReason: (lib.closureReason as string) ?? "",
    streetAddress: (lib.streetAddress as string) ?? "",
    district: (lib.district as string) ?? "",
    city: (lib.city as string) ?? "",
    country: (lib.country as string) ?? "",
    postalCode: (lib.postalCode as string) ?? "",
    lat:
      (lib.location as Record<string, unknown> | null)?.lat?.toString() ?? "",
    lng:
      (lib.location as Record<string, unknown> | null)?.lng?.toString() ?? "",
    website: (lib.website as string) ?? "",
    planVisitUrl: (lib.planVisitUrl as string) ?? "",
    catalogueUrl: (lib.catalogueUrl as string) ?? "",
    membershipUrl: (lib.membershipUrl as string) ?? "",
    bookingUrl: (lib.bookingUrl as string) ?? "",
    virtualTourUrl: (lib.virtualTourUrl as string) ?? "",
    admissionInfo: (lib.admissionInfo as string) ?? "",
    accessibilityNotes: (lib.accessibilityNotes as string) ?? "",
    phone: (lib.phone as string) ?? "",
    email: (lib.email as string) ?? "",
    transitInfo: (lib.transitInfo as string) ?? "",
    languagesServed: (lib.languagesServed as string) ?? "",
    collectionSize: (lib.collectionSize as string) ?? "",
    collectionTypes: (lib.collectionTypes as string) ?? "",
    specialCollections: (lib.specialCollections as string) ?? "",
    classificationSystem: (lib.classificationSystem as string) ?? "",
    iiifEndpoint: (lib.iiifEndpoint as string) ?? "",
    foundedYear: (lib.foundedYear as string) ?? "",
    openedYear: (lib.openedYear as string) ?? "",
    closedYear: (lib.closedYear as string) ?? "",
    architect: (lib.architect as string) ?? "",
    architecturalStyle: (lib.architecturalStyle as string) ?? "",
    buildingInfo: (lib.buildingInfo as string) ?? "",
  }

  const sessionUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
  }

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Edit the index"
        title={`Edit *${initialData.name || slug}.*`}
        lead="You're editing a library you manage. Changes go to editorial review before they appear on the public record."
      />
      <EditLibraryShell
        sessionUser={sessionUser}
        initialData={initialData}
        targetDocumentId={library.documentId ?? ""}
        targetSlug={slug}
      />
    </div>
  )
}
