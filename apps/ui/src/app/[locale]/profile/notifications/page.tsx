import type { Metadata } from "next"

import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
}

export default createProfileDrawerRoute("notifications")
