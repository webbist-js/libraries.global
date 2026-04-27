import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import { EditLibrarySearch } from "./_components/EditLibrarySearch"

export default async function EditLibrarySearchPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/edit")

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <EditLibrarySearch />
    </div>
  )
}
