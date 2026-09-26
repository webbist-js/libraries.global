import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { EditLibrarySearch } from "./_components/EditLibrarySearch"

export const metadata = privateMetadata("Edit a library")

export default async function EditLibrarySearchPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/edit")

  return <EditLibrarySearch />
}
