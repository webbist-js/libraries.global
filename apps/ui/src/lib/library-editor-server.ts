import "server-only"

import { noticeLocalDate } from "@repo/shared-data"
import type { Locale } from "next-intl"

import { computeCompleteness } from "@/components/library/library-page.helpers"
import {
  resolveEditLocale,
  translationMode,
} from "@/components/library-editor/translation-mode"
import { prefillLibrary } from "@/components/library-editor/wizard.prefill"
import { wizardStepOf } from "@/components/library-editor/wizard.steps"
import type { LibraryEditorBootstrap } from "@/components/library-editor/wizard.types"
import type { Submission } from "@/hooks/useSubmissions"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { userHeaders } from "@/lib/bridge-user-headers"
import { languageName } from "@/lib/locale-fallback"
import { fetchMobileTimetable } from "@/lib/mobile/server"
import { routing } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import { fetchLibraryForEditing } from "@/lib/strapi-api/content/server"

async function loadSavedSubmission(
  requestedDraft: string,
  slug: string,
  user: Parameters<typeof userHeaders>[0],
  code: string,
  defaultCode: string
) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(requestedDraft)) return null
  const response = await fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/content-moderation/submissions/my?documentId=${encodeURIComponent(requestedDraft)}`,
    { headers: userHeaders(user), cache: "no-store" }
  )
  if (!response.ok)
    throw new Error("Your saved submission could not be loaded.")
  const row = (await response.json()).data?.[0] as Submission | undefined
  if (
    !row ||
    row.targetSlug !== slug ||
    !["draft", "needs_info"].includes(row.status) ||
    !["correction", "library_edit"].includes(row.submissionType) ||
    (row.locale ?? defaultCode) !== code
  )
    return null

  return row
}

/** One published baseline and locale policy for page and drawer presentations. */
export async function loadLibraryEditor(
  slug: string,
  user: {
    id: string
    email: string
    name?: string | null
    claimedLibraryIds?: unknown
    staffLibraries?: { id?: string }[]
  },
  requestedLocale?: string | string[],
  requestedStep?: string,
  requestedDraft?: string
): Promise<LibraryEditorBootstrap | null> {
  const locales = await fetchArticleLocales()
  const defaultCode =
    locales.find((locale) => locale.isDefault)?.code ?? routing.defaultLocale
  const code = resolveEditLocale(requestedLocale, locales, defaultCode)
  const res = await fetchLibraryForEditing(slug, code as Locale)
  const library = res?.data
  if (!library?.documentId) return null
  const mobile = library.libraryType === "Mobile"
  const initialStep = wizardStepOf(requestedStep, mobile)
  const translating = translationMode(code, defaultCode)
  const query = new URLSearchParams()
  if (translating) query.set("locale", code)
  if (initialStep) query.set("step", String(initialStep))
  const timetable = mobile
    ? await fetchMobileTimetable(library.documentId)
    : null
  const completeness = computeCompleteness(
    library as Parameters<typeof computeCompleteness>[0]
  )
  let resumeSubmission: Submission | undefined
  if (requestedDraft) {
    const row = await loadSavedSubmission(
      requestedDraft,
      slug,
      user,
      code,
      defaultCode
    )
    if (!row) return null
    resumeSubmission = row
  }

  return {
    resumeSubmission,
    initialData: prefillLibrary(library),
    initialStep,
    locale: {
      code,
      defaultCode,
      languageName: languageName(code, locales),
      missing: translating && !!res?.localeFallback,
    },
    target: {
      documentId: library.documentId,
      slug,
      name: library.name || slug,
      entityRef: library.entityRef ?? null,
      isClaimed:
        Array.isArray(user.claimedLibraryIds) &&
        user.claimedLibraryIds.includes(library.documentId),
      completeSections: completeness.sections
        .filter((section) => section.filled)
        .map((section) => section.key),
    },
    timetableContext: timetable
      ? {
          notices: timetable.notices,
          timezone: timetable.timezone,
          today: noticeLocalDate(new Date(), timetable.timezone),
        }
      : undefined,
    staffHref: user.staffLibraries?.some(
      (entry) => entry.id === library.documentId
    )
      ? staffLibraryHref(slug, `/edit${query.size ? `?${query}` : ""}`)
      : null,
  }
}
