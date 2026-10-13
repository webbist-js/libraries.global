import { noticeLocalDate } from "@repo/shared-data"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { computeCompleteness } from "@/components/library/library-page.helpers"
import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import {
  resolveEditLocale,
  translationMode,
} from "@/components/library-editor/translation-mode"
import { prefillLibrary } from "@/components/library-editor/wizard.prefill"
import { wizardStepOf } from "@/components/library-editor/wizard.steps"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { fetchMobileTimetable } from "@/lib/mobile/server"
import { routing } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { staffLibraryHref } from "@/lib/staff/paths"
import { fetchLibraryForEditing } from "@/lib/strapi-api/content/server"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Improve a library record")

export default async function ImproveLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{
    locale?: string | string[]
    step?: string | string[]
  }>
}) {
  const tUi = await getUiTranslations("ui")

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

  // Staff of this library edit it in the staff area, where their changes
  // publish at once (ADR-0006); the Index editor would file them for review.
  const staffLibraries = (
    session.user as { staffLibraries?: { id?: string }[] }
  ).staffLibraries
  if (
    Array.isArray(staffLibraries) &&
    staffLibraries.some((entry) => entry?.id === library.documentId)
  ) {
    const editQuery = new URLSearchParams()
    if (translating) editQuery.set("locale", editLocale)
    const stepParam = Array.isArray(query.step) ? query.step[0] : query.step
    if (wizardStepOf(stepParam, library.libraryType === "Mobile"))
      editQuery.set("step", stepParam!)
    redirect(
      staffLibraryHref(slug, `/edit${editQuery.size ? `?${editQuery}` : ""}`)
    )
  }

  const claimed = ((session.user as { claimedLibraryIds?: unknown })
    .claimedLibraryIds ?? []) as string[]
  const isClaimed =
    Array.isArray(claimed) && claimed.includes(library.documentId)
  const completeness = computeCompleteness(
    library as Parameters<typeof computeCompleteness>[0]
  )
  const name = library.name || slug
  const mobile =
    library.libraryType === "Mobile"
      ? await fetchMobileTimetable(library.documentId)
      : null
  const initialStep = wizardStepOf(
    Array.isArray(query.step) ? query.step[0] : query.step,
    library.libraryType === "Mobile"
  )

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section={tUi("index_editor")}
        title={translating ? `Translate *${name}.*` : `Improve *${name}.*`}
        lead={
          isClaimed
            ? "You look after this library. Changes go to editorial review before they appear on the public record."
            : "Change only what you can source. An editor checks each change against your source before it goes live, credited to you."
        }
      />
      <IndexRecordWizard
        mode="improve"
        initialStep={initialStep}
        timetableContext={
          mobile
            ? {
                notices: mobile.notices,
                timezone: mobile.timezone,
                today: noticeLocalDate(new Date(), mobile.timezone),
              }
            : undefined
        }
        locale={{
          code: editLocale,
          defaultCode: defaultLocale,
          languageName: languageName(editLocale, locales),
          missing: translating && !!libraryRes?.localeFallback,
        }}
        initialData={prefillLibrary(library)}
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
