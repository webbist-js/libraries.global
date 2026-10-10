import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import {
  resolveEditLocale,
  translationMode,
} from "@/components/library-editor/translation-mode"
import { prefillLibrary } from "@/components/library-editor/wizard.prefill"
import { wizardStepOf } from "@/components/library-editor/wizard.steps"
import type { StaffNoticesData } from "@/components/staff/StaffNotices"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { languageName } from "@/lib/locale-fallback"
import { routing } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"
import { fetchStaff } from "@/lib/staff-proxy"
import { fetchLibraryForEditing } from "@/lib/strapi-api/content/server"

export const metadata = privateMetadata("Edit your library")

export default async function StaffEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    locale?: string | string[]
    step?: string | string[]
  }>
}) {
  const [{ slug }, query, locales] = await Promise.all([
    params,
    searchParams,
    fetchArticleLocales(),
  ])
  const { overview, documentId, user } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const defaultCode =
      locales.find((l) => l.isDefault)?.code ?? routing.defaultLocale,
    code = resolveEditLocale(query.locale, locales, defaultCode)
  const response = await fetchLibraryForEditing(
    overview.library.slug,
    code as Locale
  )
  const library = response?.data
  if (!library || library.documentId !== documentId) notFound()
  const notices =
    library.libraryType === "Mobile"
      ? await fetchStaff<StaffNoticesData>(
          user,
          `libraries/${documentId}/notices`
        )
      : null
  if (notices && !notices.body)
    throw new Error("Service notices could not be loaded")
  // `?step=3` or `?step=hours` opens the wizard on that step (the
  // Overview's quick actions and the health rows).
  const stepParam = Array.isArray(query.step) ? query.step[0] : query.step
  const initialStep = wizardStepOf(stepParam, library.libraryType === "Mobile")

  return (
    <IndexRecordWizard
      mode="staff"
      initialStep={initialStep}
      initialData={prefillLibrary(library)}
      timetableContext={
        notices?.body
          ? {
              notices: notices.body.data,
              timezone: notices.body.timezone,
              today: notices.body.today,
              staff: {
                documentId,
                slug: overview.library.slug,
                stops: notices.body.stops,
                cycleWeeks: notices.body.cycleWeeks,
              },
            }
          : undefined
      }
      target={{
        documentId,
        slug: overview.library.slug,
        name: overview.library.name,
        entityRef: library.entityRef ?? null,
        isClaimed: true,
        completeSections: [],
      }}
      locale={{
        code,
        defaultCode,
        languageName: languageName(code, locales),
        missing:
          translationMode(code, defaultCode) && !!response.localeFallback,
      }}
      publicPath={overview.library.path}
    />
  )
}
