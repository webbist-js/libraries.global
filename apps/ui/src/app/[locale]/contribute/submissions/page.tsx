import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import { SubmissionsShell } from "./_components/SubmissionsShell"

export default async function MySubmissionsPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=/contribute/submissions")

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <SubmissionsShell />
    </div>
  )
}
