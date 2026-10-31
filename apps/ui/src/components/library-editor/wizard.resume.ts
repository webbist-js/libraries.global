import { changedFieldKeys } from "./wizard.changes"
import { SUBMISSION_META_KEYS, type FormData } from "./wizard.types"

/** Keep fresh, untouched published values when resuming a saved proposal. */
export function resumeRecordDraft(
  current: FormData,
  draft: Record<string, unknown>,
  previous?: Record<string, unknown> | null
) {
  const {
    kind: _kind,
    previous: savedBaseline,
    staffCreation: _creation,
    ...saved
  } = draft
  const base =
    savedBaseline && typeof savedBaseline === "object"
      ? (savedBaseline as Partial<FormData>)
      : previous
  const original = { ...current, ...base } as FormData
  const proposed = { ...original, ...saved } as FormData
  const keys = savedBaseline
    ? changedFieldKeys(original, proposed)
    : previous
      ? (Object.keys(previous) as (keyof FormData)[])
      : changedFieldKeys(current, proposed)
  const form = { ...current }
  const baseline = { ...current }
  for (const key of keys) {
    Object.assign(form, { [key]: proposed[key] })
    Object.assign(baseline, { [key]: original[key] })
  }
  for (const key of SUBMISSION_META_KEYS)
    if (key in saved) Object.assign(form, { [key]: saved[key] })

  return { form, baseline }
}

export class PublishedRecordChangedError extends Error {
  constructor(readonly current: FormData) {
    super(
      "A published value you changed has been updated. Your draft is kept. Compare your proposal against the latest record before sending."
    )
    this.name = "PublishedRecordChangedError"
  }
}
