// apps/ui/src/components/events/EventJsonLd.tsx
// Server Component — safe to inject structured data via script tag.
// All values come from the Strapi API (server-fetched), never from user input.
// JSON.stringify with a replacer removes undefined values — no clone needed.

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

  // JSON.stringify with a replacer drops undefined values, producing clean JSON-LD.
  // Safe: server-serialised structured data, not user-supplied HTML.
  const jsonLdString = JSON.stringify(schema, (_key, value: unknown) =>
    value === undefined ? undefined : value
  )

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  )
}
