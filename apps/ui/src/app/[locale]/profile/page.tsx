import type { Metadata } from "next"

import { withMessages } from "@/i18n/scoped-messages"
import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
}

export default withMessages(
  createProfileDrawerRoute("overview"),
  "[locale]/profile/page"
)
