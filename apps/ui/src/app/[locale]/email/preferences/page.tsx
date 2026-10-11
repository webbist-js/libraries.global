import type { Metadata } from "next"

import { UtilityPage } from "@/components/utility/UtilityPage"

import { EmailPreferences } from "./preferences"

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <UtilityPage>
      <EmailPreferences token={token ?? ""} />
    </UtilityPage>
  )
}
