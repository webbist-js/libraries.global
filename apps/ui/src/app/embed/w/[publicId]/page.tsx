import { headers } from "next/headers"

import { WidgetAutoHeight } from "@/components/widgets/WidgetAutoHeight"
import { WidgetView } from "@/components/widgets/WidgetView"
import { clientIp, createRateLimiter } from "@/lib/rate-limit"
import { getSiteUrl } from "@/lib/seo/metadata"
import { fetchPublicWidget } from "@/lib/widgets/public-server"

const limiter = createRateLimiter({
  name: "public-widget-load",
  max: 120,
  windowMs: 60000,
})

export const dynamic = "force-dynamic"
export default async function WidgetPage({
  params,
}: {
  readonly params: Promise<{ publicId: string }>
}) {
  const { publicId } = await params
  const requestHeaders = await headers()
  const limit = await limiter.check(
    `${publicId}:${clientIp(new Request("https://widgets.invalid", { headers: requestHeaders }))}`
  )
  const result = limit.ok
    ? await fetchPublicWidget(
        publicId,
        "data",
        !requestHeaders.has("next-router-prefetch")
      )
    : { status: 503, body: null }
  if (!result.body)
    return (
      <section className="rounded-2xl border border-(--t-border-line) bg-white p-6">
        <h1 className="type-page-compact">Library widget unavailable</h1>
        <p className="my-3">
          {result.status === 503
            ? "Library data is temporarily unavailable. Please try again later."
            : "This widget is not currently available."}
        </p>
        <a
          className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
          href={`${getSiteUrl()}/libraries`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Find libraries on Libraries Global
        </a>
      </section>
    )

  return (
    <>
      <WidgetView data={result.body} siteUrl={getSiteUrl()} />
      <WidgetAutoHeight publicId={publicId} origins={result.body.origins} />
    </>
  )
}
