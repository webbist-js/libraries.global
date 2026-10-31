import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { createProfileDrawerRoute } from "@/lib/profile-route-redirect"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("membershipPage")

  return { title: t("title"), robots: { index: false, follow: false } }
}

export default createProfileDrawerRoute("membership")
