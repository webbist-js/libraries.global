import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { computeCompleteness } from "@/components/library/library-page.helpers"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { routing } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import {
  fetchLibraryForEditing,
  type LibraryForEditing,
} from "@/lib/strapi-api/content/server"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"
import { IndexRecordWizard } from "../_components/IndexRecordWizard"
import {
  resolveEditLocale,
  translationMode,
} from "../_components/translation-mode"
import { blocksToPlainText } from "../_components/wizard.changes"
import type { FormData } from "../_components/wizard.types"

export const metadata = privateMetadata("Improve a library record")

const str = (v: unknown) => (typeof v === "string" ? v : "")

/** The record's current values in the wizard's shape. */
function prefill(lib: LibraryForEditing): Partial<FormData> {
  const location = lib.location as { lat?: unknown; lng?: unknown } | null
  const openingTimes = lib.openingTimes as { days?: unknown } | null
  const ids = (rel: unknown) =>
    Array.isArray(rel)
      ? rel
          .map((r) => (r as { documentId?: string })?.documentId)
          .filter((id): id is string => !!id)
      : []

  return {
    name: str(lib.name),
    shortName: str(lib.shortName),
    summary: str(lib.summary),
    libraryType: str(lib.libraryType),
    operatorType: str(lib.operatorType),
    operationalStatus: str(lib.operationalStatus),
    closureReason: str(lib.closureReason),
    streetAddress: str(lib.streetAddress),
    district: str(lib.district),
    city: str(lib.city),
    country: str(lib.country?.name),
    postalCode: str(lib.postalCode),
    lat: location?.lat != null ? String(location.lat) : "",
    lng: location?.lng != null ? String(location.lng) : "",
    continentDocumentId: lib.continent?.documentId ?? "",
    countryDocumentId: lib.country?.documentId ?? "",
    regionDocumentId: lib.region?.documentId ?? "",
    areaDocumentId: lib.area?.documentId ?? "",
    website: str(lib.website),
    planVisitUrl: str(lib.planVisitUrl),
    catalogueUrl: str(lib.catalogueUrl),
    membershipUrl: str(lib.membershipUrl),
    bookingUrl: str(lib.bookingUrl),
    virtualTourUrl: str(lib.virtualTourUrl),
    virtualTourEmbed: str(lib.virtualTourEmbed),
    donationUrl: str(lib.donationUrl),
    admissionInfo: str(lib.admissionInfo),
    visitNotes: blocksToPlainText(lib.visitNotes),
    accessibilityNotes: blocksToPlainText(lib.accessibilityNotes),
    phone: str(lib.phone),
    email: str(lib.email),
    transitInfo: str(lib.transitInfo),
    languagesServed: str(lib.languagesServed),
    ...(openingTimes && Array.isArray(openingTimes.days)
      ? { openingTimes: openingTimes as FormData["openingTimes"] }
      : {}),
    services: ids(lib.services),
    amenities: ids(lib.amenities),
    accessibility: ids(lib.accessibility),
    socialLinks: (lib.socialLinks ?? []).map((s) => ({
      platform: s.platform,
      url: s.url,
      label: s.label ?? "",
    })),
    classificationSystem: str(lib.classificationSystem),
    iiifEndpoint: str(lib.iiifEndpoint),
    foundedYear: str(lib.foundedYear),
    openedYear: str(lib.openedYear),
    closedYear: str(lib.closedYear),
    architect: str(lib.architect),
    buildingInfo: str(lib.buildingInfo),
    source: str(lib.source),
    sourceUrl: str(lib.sourceUrl),
  }
}

export default async function ImproveLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ locale?: string | string[] }>
}) {
  const [{ slug }, query, locales] = await Promise.all([
    params,
    searchParams,
    fetchArticleLocales(),
  ])
  // The edit's locale comes from `?locale=` only, never the route locale:
  // without it the editor loads and submits the default locale. A missing
  // translation prefills from the default locale (fetch fallback).
  const defaultLocale =
    locales.find((l) => l.isDefault)?.code ?? routing.defaultLocale
  const editLocale = resolveEditLocale(query.locale, locales, defaultLocale)
  const translating = translationMode(editLocale, defaultLocale)
  const [session, libraryRes] = await Promise.all([
    getSessionSSR(await headers()),
    fetchLibraryForEditing(slug, editLocale as Locale),
  ])
  if (!session?.user) {
    const back = translating
      ? `/contribute/index/${slug}?locale=${encodeURIComponent(editLocale)}`
      : `/contribute/index/${slug}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }

  const library = libraryRes?.data
  if (!library?.documentId) notFound()

  const claimed = ((session.user as { claimedLibraryIds?: unknown })
    .claimedLibraryIds ?? []) as string[]
  const isClaimed =
    Array.isArray(claimed) && claimed.includes(library.documentId)
  const completeness = computeCompleteness(
    library as Parameters<typeof computeCompleteness>[0]
  )
  const name = library.name || slug

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Index editor"
        title={translating ? `Translate *${name}.*` : `Improve *${name}.*`}
        lead={
          isClaimed
            ? "You look after this library. Changes go to editorial review before they appear on the public record."
            : "Change only what you can source. An editor checks each change against your source before it goes live, credited to you."
        }
      />
      <IndexRecordWizard
        mode="improve"
        locale={{
          code: editLocale,
          defaultCode: defaultLocale,
          languageName: languageName(editLocale, locales),
          missing: translating && !!libraryRes?.localeFallback,
        }}
        initialData={prefill(library)}
        target={{
          documentId: library.documentId,
          slug,
          name,
          entityRef: library.entityRef ?? null,
          isClaimed,
          completeSections: completeness.sections
            .filter((s) => s.filled)
            .map((s) => s.key),
        }}
      />
    </div>
  )
}
