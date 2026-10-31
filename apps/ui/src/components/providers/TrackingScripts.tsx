import Script from "next/script"

import { GoogleAnalytics } from "@/components/providers/GoogleAnalytics"
import { isDevelopment } from "@/lib/general-helpers"
import { productionAnalyticsEnabled } from "@/lib/google-analytics"

export function TrackingScriptWrapper({
  id,
  scriptContent,
  scriptOptions,
  ignoreInDevelopment = true,
}: {
  scriptContent: string
  id: string
  scriptOptions: Exclude<
    React.ComponentProps<typeof Script>,
    "id" | "dangerouslySetInnerHTML"
  >
  ignoreInDevelopment?: boolean
}) {
  if (ignoreInDevelopment && isDevelopment()) {
    return null
  }

  return (
    <Script
      id={id}
      dangerouslySetInnerHTML={{ __html: scriptContent }}
      {...scriptOptions}
    />
  )
}

function TrackingScripts({
  nonce,
  locale = "en",
}: {
  readonly nonce?: string
  readonly locale?: string
}) {
  if (!productionAnalyticsEnabled()) return null

  return (
    <GoogleAnalytics
      nonce={nonce}
      locale={locale}
      checkoutEnabled={process.env.CHECKOUT_ANALYTICS_ENABLED === "true"}
    />
  )
}

export default TrackingScripts
