import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { withMessages } from "@/i18n/scoped-messages"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfileSnippet } from "@/lib/own-profile-server"
import { privateMetadata } from "@/lib/seo/metadata"

import { SubmissionsShell } from "./_components/SubmissionsShell"

export const metadata = privateMetadata("My submissions")

async function MySubmissionsPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=/contribute/submissions")

  // For the link to the public record on the profile.
  const profile = await fetchOwnProfileSnippet(session.user)

  return <SubmissionsShell username={profile?.username ?? null} />
}

export default withMessages(
  MySubmissionsPage,
  "[locale]/(dashboard)/contribute/submissions/page"
)
