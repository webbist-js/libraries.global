import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchLibrary } from "@/lib/strapi-api/content/server"

import { EditLibraryDiff } from "./_components/EditLibraryDiff"

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

  // Serialize safe fields for the client
  const safeLibrary = {
    documentId: library.documentId ?? "",
    slug: library.slug ?? slug,
    name: library.name ?? "",
    entityRef: (library.entityRef as string | null | undefined) ?? "",
    city: ((library as Record<string, unknown>).city as string) ?? "",
    libraryType:
      ((library as Record<string, unknown>).libraryType as string) ?? "",
    catalogueUrl:
      ((library as Record<string, unknown>).catalogueUrl as string) ?? "",
    website: ((library as Record<string, unknown>).website as string) ?? "",
    foundedYear:
      ((library as Record<string, unknown>).foundedYear as string) ?? "",
    architect: ((library as Record<string, unknown>).architect as string) ?? "",
    description: "",
    lat: "",
    lng: "",
  }

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <EditLibraryDiff library={safeLibrary} />
    </div>
  )
}
