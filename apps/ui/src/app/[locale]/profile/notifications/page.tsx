import type { Metadata } from "next"

import { withMessages } from "@/i18n/scoped-messages"
import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
}

export default withMessages(
  createProfileDrawerRoute("notifications"),
  "[locale]/profile/notifications/page"
)
