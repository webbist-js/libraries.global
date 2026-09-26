// apps/ui/src/components/events/EventJsonLd.tsx
// Server Component — safe to inject structured data via script tag.
// Values come from third-party provider feeds — serialised via serializeJsonLd.

import { serializeJsonLd } from "@/components/seo/JsonLd"

interface EventJsonLdProps {
  title: string
  description?: string | null
  startTime: string
  endTime?: string | null
  url: string
  imageUrl?: string | null
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryName?: string | null
}

export function EventJsonLd({
  title,
  description,
  startTime,
  endTime,
  url,
  imageUrl,
  isFree,
  priceMin,
  priceMax,
  libraryName,
}: EventJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: title,
    startDate: startTime,
    endDate: endTime ?? undefined,
    url,
    description: description ?? undefined,
    image: imageUrl ?? undefined,
    organizer: libraryName
      ? { "@type": "Organization", name: libraryName }
      : undefined,
    // Google requires `location` for Event rich results; the host library is
    // the best we have until events carry a structured venue/address.
    location: libraryName ? { "@type": "Place", name: libraryName } : undefined,
    offers: {
      "@type": "Offer",
      price: isFree ? 0 : (priceMin ?? undefined),
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url,
      ...(priceMax ? { maxPrice: priceMax } : {}),
    },
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  }

  // JSON.stringify drops undefined values; serializeJsonLd escapes `<`/`>`/`&`
  // because titles/descriptions come from third-party provider feeds.
  const jsonLdString = serializeJsonLd(schema)

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  )
}
