import type { Metadata } from "next"

import { withMessages } from "@/i18n/scoped-messages"
import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export const metadata: Metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
}

export default withMessages(
  createProfileDrawerRoute("settings"),
  "[locale]/profile/settings/page"
)
