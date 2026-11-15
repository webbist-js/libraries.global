import type { Metadata } from "next"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { withMessages } from "@/i18n/scoped-messages"

import { EmailPreferences } from "./preferences"

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}
async function Page({
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

export default withMessages(Page, "[locale]/email/preferences/page")
