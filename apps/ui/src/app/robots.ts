import type { MetadataRoute } from "next"

import { getEnvVar } from "@/lib/env-vars"
import { isProduction } from "@/lib/general-helpers"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getEnvVar("APP_PUBLIC_URL")

  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*/auth/",
          "/*/profile/*/settings",
          "/*/profile/onboarding",
          "/*/contribute/edit/",
          "/*/contribute/submissions",
          "/*/dev/",
          "/api/",
        ],
      },
    ],
    ...(baseUrl
      ? { sitemap: new URL("./sitemap.xml", baseUrl).toString() }
      : {}),
  }
}
