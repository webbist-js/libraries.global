/**
 * JSON-LD structured data builders for schema.org types.
 * Return values are rendered via the <JsonLd> component
 * (components/seo/JsonLd.tsx), which handles safe serialisation.
 */

import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { SITE_NAME } from "@/lib/seo/metadata"

type Maybe<T> = T | null | undefined

export function buildOrganizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    description:
      "A comprehensive global index of libraries — every significant public, national, academic, and cultural library in the world.",
  }
}

/** Homepage: WebSite + sitelinks SearchAction pointing at /index?q= */
export function buildWebSiteSchema(opts: {
  siteUrl: string
  searchUrlTemplate: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: opts.siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: opts.searchUrlTemplate,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function buildArticleSchema(opts: {
  type?: "Article" | "BlogPosting" | "TechArticle"
  title: string
  description?: Maybe<string>
  url: string
  imageUrl?: Maybe<string>
  authorName?: Maybe<string>
  publishedAt?: Maybe<string>
  updatedAt?: Maybe<string>
  sectionName?: Maybe<string>
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "Article",
    headline: opts.title.slice(0, 110),
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": opts.url },
    ...(opts.imageUrl ? { image: [opts.imageUrl] } : {}),
    author: opts.authorName
      ? { "@type": "Person", name: opts.authorName }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    ...(opts.publishedAt ? { datePublished: opts.publishedAt } : {}),
    ...((opts.updatedAt ?? opts.publishedAt)
      ? { dateModified: opts.updatedAt ?? opts.publishedAt }
      : {}),
    ...(opts.sectionName ? { articleSection: opts.sectionName } : {}),
  }
}

const SCHEMA_DAY: Record<string, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
}

const HHMM = /^\d{2}:\d{2}/

/** Structured weekly hours → OpeningHoursSpecification[] (skips bad data). */
export function buildOpeningHoursSpecification(
  openingTimes: Maybe<OpeningTimesValue>
) {
  const days = openingTimes?.days
  if (!Array.isArray(days)) return
  const specs = days.flatMap((d) =>
    d?.enabled && SCHEMA_DAY[d.day] && Array.isArray(d.timeframes)
      ? d.timeframes
          .filter((tf) => HHMM.test(tf?.startTime) && HHMM.test(tf?.endTime))
          .map((tf) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: SCHEMA_DAY[d.day],
            opens: tf.startTime.slice(0, 5),
            closes: tf.endTime.slice(0, 5),
          }))
      : []
  )

  return specs.length ? specs : undefined
}

export function buildLibrarySchema(opts: {
  name: string
  url: string
  description?: Maybe<string>
  alternateName?: Maybe<string>
  streetAddress?: Maybe<string>
  city?: Maybe<string>
  region?: Maybe<string>
  postalCode?: Maybe<string>
  countryCode?: Maybe<string>
  phone?: Maybe<string>
  email?: Maybe<string>
  website?: Maybe<string>
  wikidataId?: Maybe<string>
  latitude?: Maybe<number>
  longitude?: Maybe<number>
  imageUrl?: Maybe<string>
  foundingDate?: Maybe<string>
  openingTimes?: Maybe<OpeningTimesValue>
}) {
  const hasAddress = opts.streetAddress || opts.city || opts.postalCode
  const sameAs = [
    opts.website,
    opts.wikidataId ? `https://www.wikidata.org/wiki/${opts.wikidataId}` : null,
  ].filter((s): s is string => Boolean(s && /^https?:\/\//.test(s)))
  const openingHoursSpecification = buildOpeningHoursSpecification(
    opts.openingTimes
  )

  return {
    "@context": "https://schema.org",
    "@type": "Library",
    "@id": `${opts.url}#library`,
    name: opts.name,
    url: opts.url,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.alternateName ? { alternateName: opts.alternateName } : {}),
    ...(hasAddress
      ? {
          address: {
            "@type": "PostalAddress",
            ...(opts.streetAddress
              ? { streetAddress: opts.streetAddress }
              : {}),
            ...(opts.city ? { addressLocality: opts.city } : {}),
            ...(opts.region ? { addressRegion: opts.region } : {}),
            ...(opts.postalCode ? { postalCode: opts.postalCode } : {}),
            ...(opts.countryCode ? { addressCountry: opts.countryCode } : {}),
          },
        }
      : {}),
    ...(opts.latitude != null && opts.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: opts.latitude,
            longitude: opts.longitude,
          },
        }
      : {}),
    ...(opts.phone ? { telephone: opts.phone } : {}),
    ...(opts.email ? { email: opts.email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(opts.imageUrl ? { image: opts.imageUrl } : {}),
    ...(opts.foundingDate ? { foundingDate: opts.foundingDate } : {}),
    ...(openingHoursSpecification ? { openingHoursSpecification } : {}),
  }
}
