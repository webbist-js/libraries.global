import { publicSourceUrl, type LibrarySourceRecord } from "@repo/shared-data"

import {
  DAY_LABELS,
  DAY_ORDER,
  formatCoordinates,
  formatDayTimes,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { escapeMarkdown } from "@/lib/knowledge-markdown"
import { plainMetadataText } from "@/lib/seo/metadata"
import type { DatasetRecord } from "@/lib/strapi-api/content/datasets"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

const safeText = (value: unknown): string =>
  typeof value === "string"
    ? escapeMarkdown(plainMetadataText(value) ?? "")
    : ""

const safeLink = (value: unknown): string | null => {
  const url = publicSourceUrl(value)

  return url ? `<${url.replaceAll("<", "%3C").replaceAll(">", "%3E")}>` : null
}

const field = (label: string, value: unknown): string | null => {
  const text = safeText(value)

  return text ? `- ${label}: ${text}` : null
}

function names(items: readonly { name?: string | null }[] | null | undefined) {
  return (
    items?.flatMap((item) => (item.name ? [safeText(item.name)] : [])) ?? []
  )
}

export function renderLibraryMarkdown(
  library: PopulatedLibraryData,
  options: {
    canonicalUrl: string
    locale: string
    datasets: readonly DatasetRecord[]
  }
): string {
  const { canonicalUrl, locale, datasets } = options
  const datasetByKey = new Map(
    datasets.map((item) => [item.key.toLowerCase(), item])
  )
  const records = (library.sourceRecords ?? []) as LibrarySourceRecord[]
  const place = [
    library.streetAddress,
    library.city,
    library.region?.name,
    library.postalCode,
    library.country?.name,
  ]
    .map(safeText)
    .filter(Boolean)
    .join(", ")
  const coordinates = formatCoordinates(
    library.location as { lat?: unknown; lng?: unknown } | null
  )
  const hours = library.openingTimes as OpeningTimesValue | null
  const weeklyHours = Array.isArray(hours?.days)
    ? DAY_ORDER.flatMap((day) => {
        const entry = hours.days.find((item) => item.day === day)

        return entry ? [`- ${DAY_LABELS[day]}: ${formatDayTimes(entry)}`] : []
      })
    : []
  const sourceLines = records.map((record) => {
    const dataset = record.dataset
      ? datasetByKey.get(record.dataset.toLowerCase())
      : undefined
    const source = safeLink(record.url) ?? safeLink(dataset?.sourceUrl)
    const title =
      safeText(record.label ?? dataset?.name ?? record.dataset) ||
      "Source reference"
    const details = [
      record.role ? `role: ${safeText(record.role)}` : null,
      record.recordId ? `record ID: ${safeText(record.recordId)}` : null,
      record.retrievedAt ? `retrieved: ${safeText(record.retrievedAt)}` : null,
      dataset?.publisher ? `publisher: ${safeText(dataset.publisher)}` : null,
      dataset?.attribution
        ? `attribution: ${safeText(dataset.attribution)}`
        : null,
      dataset?.licence ? `licence: ${safeText(dataset.licence)}` : null,
      dataset?.licenceUrl
        ? `licence URL: ${safeLink(dataset.licenceUrl) ?? safeText(dataset.licenceUrl)}`
        : null,
      dataset?.redistribution
        ? `redistribution: ${safeText(dataset.redistribution)}`
        : null,
      record.dataset && !dataset
        ? "dataset terms unavailable here; check the original source before reuse"
        : null,
    ].filter(Boolean)

    return `- ${source ? `[${title}](${source})` : title}${details.length ? ` — ${details.join("; ")}` : ""}`
  })
  const links = [
    ["Website", library.website],
    ["Catalogue", library.catalogueUrl],
    ["Plan a visit", library.planVisitUrl],
  ].flatMap(([label, url]) => {
    const safe = safeLink(url)

    return safe ? [`- [${label}](${safe})`] : []
  })

  return (
    [
      `# ${safeText(library.name ?? library.slug ?? "Library")}`,
      library.summary ? safeText(library.summary) : null,
      `Source: [Libraries Global](<${canonicalUrl}>)\nLanguage: ${locale}`,
      library.updatedAt
        ? `Record updated: ${safeText(library.updatedAt)}`
        : null,
      library.lastVerifiedAt
        ? `Last verified: ${safeText(library.lastVerifiedAt)}`
        : null,
      "An update date is not a verification date. Missing information does not establish that a service is unavailable. Check the library's own site before visiting.",
      "## Record",
      [
        field("Type", library.libraryType),
        field("Operational status", library.operationalStatus),
        place ? `- Address: ${place}` : null,
        coordinates ? `- Coordinates: ${coordinates}` : null,
        field("Time zone", library.timezone),
        field("Phone", library.phone),
        field("Email", library.email),
      ]
        .filter(Boolean)
        .join("\n") || "No record details published.",
      weeklyHours.length
        ? `## Regular opening hours\n\n${weeklyHours.join("\n")}\n\nExceptions, seasonal hours and current notices may change this schedule. Check the HTML page and the library before visiting.`
        : null,
      names(library.services).length
        ? `## Services\n\n${names(library.services)
            .map((name) => `- ${name}`)
            .join("\n")}`
        : null,
      names(library.amenities).length
        ? `## Amenities\n\n${names(library.amenities)
            .map((name) => `- ${name}`)
            .join("\n")}`
        : null,
      names(library.accessibility).length
        ? `## Accessibility\n\n${names(library.accessibility)
            .map((name) => `- ${name}`)
            .join("\n")}`
        : null,
      links.length ? `## Links\n\n${links.join("\n")}` : null,
      `## Sources\n\n${sourceLines.length ? sourceLines.join("\n") : "No source references are recorded for this library."}`,
    ]
      .filter(Boolean)
      .join("\n\n") + "\n"
  )
}
