import type { Metadata } from "next"

import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export const metadata: Metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
}

export default createProfileDrawerRoute("settings")
