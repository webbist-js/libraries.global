import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"

import { NewDocShell } from "./_components/NewDocShell"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Write a Knowledge article",
  robots: "noindex, nofollow",
}

export default async function NewDocPage() {
  const session = await getSessionSSR(await headers())

  if (!session?.user)
    redirect("/auth/signin?callbackUrl=/contribute/knowledge/new")

  return <NewDocShell />
}
