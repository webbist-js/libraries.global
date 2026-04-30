import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import { AddLibraryWizard } from "./_components/AddLibraryWizard"

export default async function AddLibraryPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/add")

  return (
    <div
      data-transparent-header=""
      className="-mt-14"
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <AddLibraryWizard
        sessionUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        }}
      />
    </div>
  )
}
