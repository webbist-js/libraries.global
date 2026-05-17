import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"

import { CorrectLibraryForm } from "./_components/CorrectLibraryForm"

export default async function CorrectLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ libraryName?: string }>
}) {
  const session = await getSessionSSR(await headers())
  const { slug } = await params
  const { libraryName } = await searchParams

  if (!session?.user) {
    const callbackUrl = `/contribute/correct/${slug}${libraryName ? `?libraryName=${encodeURIComponent(libraryName)}` : ""}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return (
    <CorrectLibraryForm
      slug={slug}
      libraryName={libraryName ?? slug}
      sessionUser={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      }}
    />
  )
}
