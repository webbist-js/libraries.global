import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfileSnippet } from "@/lib/own-profile-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { SubmissionsShell } from "./_components/SubmissionsShell"

export const metadata = privateMetadata("My submissions")

export default async function MySubmissionsPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=/contribute/submissions")

  // For the link to the public record on the profile.
  const profile = await fetchOwnProfileSnippet(session.user)

  return <SubmissionsShell username={profile?.username ?? null} />
}
