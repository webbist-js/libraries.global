import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { IndexRecordWizard } from "@/app/[locale]/contribute/index/_components/IndexRecordWizard"
import {
  resolveEditLocale,
  translationMode,
} from "@/app/[locale]/contribute/index/_components/translation-mode"
import { prefillLibrary } from "@/app/[locale]/contribute/index/_components/wizard.prefill"
import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { languageName } from "@/lib/locale-fallback"
import { routing } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"
import { fetchLibraryForEditing } from "@/lib/strapi-api/content/server"

export const metadata = privateMetadata("Edit your library")

/**
 * `?step=` aliases (`edit?step=hours`): a step's name from `WIZARD_STEPS`,
 * or a field group it holds, maps to its number. Digits 1–7 still work.
 */
const STEP_ALIASES: Record<string, number> = {
  identity: 1,
  name: 1,
  type: 1,
  status: 1,
  location: 2,
  address: 2,
  coordinates: 2,
  visit: 3,
  hours: 3,
  links: 3,
  access: 3,
  accessibility: 3,
  facilities: 3,
  stops: 3,
  timetable: 3,
  collections: 4,
  history: 5,
  building: 5,
  photo: 6,
  image: 6,
  sources: 7,
}

/** The wizard step a `?step=` value names, or undefined for anything else. */
function wizardStepOf(value: string | undefined): number | undefined {
  if (!value) return undefined
  const key = value.trim().toLowerCase()
  if (/^[1-7]$/.test(key)) return Number(key)

  return STEP_ALIASES[key]
}

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
  const { overview, documentId } = await loadStaffPage(
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
  // `?step=3` or `?step=hours` opens the wizard on that step (the
  // Overview's quick actions and the health rows).
  const stepParam = Array.isArray(query.step) ? query.step[0] : query.step
  const initialStep = wizardStepOf(stepParam)

  return (
    <IndexRecordWizard
      mode="staff"
      initialStep={initialStep}
      initialData={prefillLibrary(library)}
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
