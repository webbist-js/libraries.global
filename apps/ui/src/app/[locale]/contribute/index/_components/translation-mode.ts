import { LOCALIZED_LIBRARY_FIELDS } from "@repo/shared-data"

import { type FormData, SUBMISSION_META_KEYS } from "./wizard.types"

/**
 * The library fields that differ by language (Task 7's list, kept in step
 * with the Strapi schema). Everything else on a library — type,
 * coordinates, links, hours, relations — is shared by every locale.
 */
export { LOCALIZED_LIBRARY_FIELDS }

const LOCALIZED = new Set<string>(LOCALIZED_LIBRARY_FIELDS)
const META = new Set<string>(SUBMISSION_META_KEYS)

/** Editing a locale other than the default one is translating. */
export function translationMode(
  locale: string,
  defaultLocale: string
): boolean {
  return !!locale && locale !== defaultLocale
}

/**
 * The form keys a contributor may change. In translation mode that's the
 * localized library fields plus the submission's own fields (summary,
 * evidence, note), so a translation can still be sourced and sent.
 */
export function editableFields(
  mode: boolean,
  all: readonly string[]
): string[] {
  if (!mode) return [...all]

  return all.filter((k) => LOCALIZED.has(k) || META.has(k))
}

/**
 * The locale the Index editor loads and submits: `?locale=` when it names a
 * configured locale, else the default locale (never the route locale).
 */
export function resolveEditLocale(
  requested: string | string[] | undefined,
  configured: readonly { code: string }[],
  defaultLocale: string
): string {
  const value = Array.isArray(requested) ? requested[0] : requested
  if (value && configured.some((l) => l.code === value)) return value

  return defaultLocale
}

/**
 * The form with every non-editable field held at the record's value, so a
 * resumed draft or a stray setter can't slip a shared field into a
 * translation. `null` means everything is editable.
 */
export function restrictToEditable(
  initial: FormData,
  current: FormData,
  editable: ReadonlySet<string> | null
): FormData {
  if (!editable) return current
  const out = { ...current } as Record<string, unknown>
  for (const key of Object.keys(current)) {
    if (!editable.has(key))
      out[key] = (initial as unknown as Record<string, unknown>)[key]
  }

  return out as unknown as FormData
}

/** Adds `locale` to a submission body in translation mode only. */
export function withSubmissionLocale<T extends object>(
  body: T,
  translationLocale: string | null | undefined
): T & { locale?: string } {
  return translationLocale ? { ...body, locale: translationLocale } : body
}

/**
 * Whether a saved draft belongs to the locale being edited. Drafts saved
 * before translation mode carry no locale and belong to the default one.
 */
export function draftMatchesLocale(
  draft: { locale?: string | null },
  editLocale: string,
  defaultLocale: string
): boolean {
  return (draft.locale || defaultLocale) === editLocale
}
