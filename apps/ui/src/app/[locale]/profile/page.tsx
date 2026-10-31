import type { Metadata } from "next"

import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
}

export default createProfileDrawerRoute("overview")
