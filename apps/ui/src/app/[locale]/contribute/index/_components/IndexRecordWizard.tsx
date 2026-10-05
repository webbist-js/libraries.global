"use client"

import { Icon } from "@iconify/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Notice } from "@/components/ds/Notice"
import {
  useCreateSubmission,
  useFinalizeDraft,
  useResumeDraft,
  useSaveDraft,
} from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { primaryCtaSm } from "@/lib/styles"

import { ChangedFieldsContext } from "./ChangedFieldsContext"
import { DraftResumeBanner } from "./DraftResumeBanner"
import {
  draftMatchesLocale,
  editableFields,
  restrictToEditable,
  translationMode,
  withSubmissionLocale,
} from "./translation-mode"
import { TranslationBanner } from "./TranslationBanner"
import {
  changedFieldKeys,
  changedSteps,
  recordChangesPayload,
} from "./wizard.changes"
import { stepProgress } from "./wizard.progress"
import { tipFor } from "./wizard.tips"
import {
  EMPTY_FORM,
  type FormData,
  type IndexRecordWizardProps,
  SUBMISSION_META_KEYS,
} from "./wizard.types"
import {
  firstIncompleteStep,
  missingFields,
  type ValidationScope,
} from "./wizard.validation"
import { EditableFieldsContext, FieldErrorsContext } from "./WizardFields"
import { RecordProgress, WizardStepNav } from "./WizardStepNav"
import { STEP_COMPONENTS } from "./WizardSteps"

export type { FormData, SocialLink, UploadedImage } from "./wizard.types"
export { calcScore } from "./wizard.scoring"

export const INDEX_EDITOR_PATH = "/contribute/index"

const LAST_STEP = 7

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

function RailStatus({
  icon,
  color,
  children,
}: {
  icon: string
  color: string
  children: React.ReactNode
}) {
  return (
    <p
      role="status"
      style={{
        fontFamily: T.font.sans,
        fontSize: "15px",
        color,
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <Icon icon={icon} width={16} aria-hidden="true" />
      {children}
    </p>
  )
}

function splitForm(formData: FormData) {
  const meta: Record<string, unknown> = {}
  const libraryFields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(formData)) {
    if ((SUBMISSION_META_KEYS as readonly string[]).includes(k)) meta[k] = v
    else libraryFields[k] = v
  }

  return {
    libraryFields,
    editSummary: String(meta.editSummary ?? ""),
    evidenceType: String(meta.evidenceType ?? ""),
    evidenceUrl: String(meta.evidenceUrl ?? ""),
    note: String(meta.note ?? ""),
  }
}

/**
 * The Index editor's seven-step record form. `new` mode proposes a library
 * (`new_library`); `improve` mode edits an existing record, sending only
 * the changed fields as a `library_edit` (claimants) or a record
 * `correction` (everyone else). Both modes save a draft as you go.
 */
export function IndexRecordWizard({
  mode,
  initialData,
  target,
  locale,
}: IndexRecordWizardProps) {
  const improve = mode === "improve" && !!target
  // Translation mode: a non-default locale, improve mode only.
  const translating =
    improve && !!locale && translationMode(locale.code, locale.defaultCode)
  const translationLocale = translating ? locale.code : null
  const editable = useMemo<ReadonlySet<string> | null>(
    () =>
      translating
        ? new Set(editableFields(true, Object.keys(EMPTY_FORM)))
        : null,
    [translating]
  )
  const router = useRouter()
  const initial = useMemo<FormData>(
    () => (initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM),
    [initialData]
  )
  const [step, setStep] = useState(1)
  const [visited, setVisited] = useState<number[]>([])
  // eslint-disable-next-line react/hook-use-state -- `formData` is the view below
  const [rawFormData, setFormData] = useState<FormData>(initial)
  // Shared fields stay at the record's value in translation mode, whatever
  // a resumed draft holds.
  const formData = useMemo(
    () => restrictToEditable(initial, rawFormData, editable),
    [initial, rawFormData, editable]
  )
  const [draftId, setDraftId] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false)

  const submissionType = improve
    ? target.isClaimed
      ? "library_edit"
      : "correction"
    : "new_library"

  const { mutate: createSubmission, isPending: isCreating } =
    useCreateSubmission()
  const { mutate: saveDraftMutation } = useSaveDraft()
  const { mutate: finalizeDraft, isPending: isFinalizing } = useFinalizeDraft()
  const { data: existingDraft } = useResumeDraft(
    submissionType,
    improve ? target.slug : undefined,
    translationLocale ?? undefined
  )
  const isPending = isCreating || isFinalizing

  // Improve mode: what differs from the record.
  const changed = useMemo(
    () => (improve ? changedFieldKeys(initial, formData) : []),
    [improve, initial, formData]
  )
  const changedSet = useMemo(() => new Set(changed), [changed])
  const stepsWithChanges = useMemo(() => changedSteps(changed), [changed])
  const progress = useMemo(
    () => stepProgress(formData, improve),
    [formData, improve]
  )

  const showDraftBanner =
    !draftBannerDismissed &&
    !draftId &&
    !!existingDraft?.draftData &&
    // A draft of another language's version isn't this edit's to resume.
    (!improve ||
      !locale ||
      draftMatchesLocale(
        existingDraft as { locale?: string | null },
        locale.code,
        locale.defaultCode
      ))

  const resumeDraft = useCallback(() => {
    if (!existingDraft?.draftData) return
    setFormData({
      ...initial,
      ...(existingDraft.draftData as unknown as Partial<FormData>),
    })
    setStep(
      Math.min(LAST_STEP, Math.max(1, (existingDraft.stepCompleted ?? 0) + 1))
    )
    setDraftId(existingDraft.documentId)
    setDraftBannerDismissed(true)
  }, [existingDraft, initial])

  const discardDraft = useCallback(() => setDraftBannerDismissed(true), [])

  const set = useCallback((k: keyof FormData, v: string) => {
    setFormData((prev) => ({ ...prev, [k]: v }))
  }, [])

  const StepComponent = STEP_COMPONENTS[step - 1]!
  const tip = tipFor(step, improve)

  const scope = useMemo<ValidationScope>(
    () => ({ record: improve ? initial : null, editable }),
    [improve, initial, editable]
  )
  const missing = useMemo(
    () => missingFields(step, formData, scope),
    [step, formData, scope]
  )
  // Errors stay hidden until leaving a step is refused, then track the input.
  const [revealed, setRevealed] = useState<{
    step: number
    focus?: keyof FormData
  } | null>(null)
  const fieldErrors = useMemo(
    () => new Set<string>(revealed?.step === step ? missing : []),
    [revealed, step, missing]
  )
  const reveal = (at: number, keys: (keyof FormData)[]) => {
    setStep(at)
    setRevealed({ step: at, focus: keys[0] })
  }

  const saveDraft = useCallback(
    (currentFormData: FormData, currentStep: number, id: string) => {
      saveDraftMutation(
        {
          id,
          draftData: currentFormData as unknown as Record<string, unknown>,
          stepCompleted: currentStep,
        },
        { onSuccess: () => setLastSavedAt(new Date()) }
      )
    },
    [saveDraftMutation]
  )

  const targetParams = improve
    ? {
        targetEntityType: "library" as const,
        targetDocumentId: target.documentId,
        targetSlug: target.slug,
      }
    : {}

  const startDraft = useCallback(
    (currentFormData: FormData) => {
      const { libraryFields, ...meta } = splitForm(currentFormData)
      createSubmission(
        withSubmissionLocale(
          {
            submissionType,
            ...targetParams,
            ...meta,
            fields: improve
              ? recordChangesPayload(initial, currentFormData)
              : libraryFields,
            asDraft: true,
          },
          translationLocale
        ),
        {
          onSuccess: (submission) => {
            setDraftId(submission.documentId)
            setLastSavedAt(new Date())
          },
          onError: () => {},
        }
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      createSubmission,
      submissionType,
      improve,
      initial,
      target?.documentId,
      translationLocale,
    ]
  )

  const goNext = () => {
    if (missing.length > 0) {
      reveal(step, missing)

      return
    }
    setVisited((v) => (v.includes(step) ? v : [...v, step]))
    const nextStep = Math.min(step + 1, LAST_STEP)
    setStep(nextStep)
    if (draftId) saveDraft(formData, step, draftId)
    else if (!improve || changed.length > 0) startDraft(formData)
  }

  const goPrev = () => setStep((s) => Math.max(s - 1, 1))

  const handleStepClick = (n: number) => {
    if (!improve && !visited.includes(step) && n > step) return
    if (n > step && missing.length > 0) {
      reveal(step, missing)

      return
    }
    setStep(n)
  }

  const topRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false

      return
    }
    const el = topRef.current
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: "start" })
    }
  }, [step])

  // After the step scroll above, so the first missing field ends in view.
  useEffect(() => {
    if (!revealed?.focus) return
    const el = document.getElementById(revealed.focus)
    el?.scrollIntoView({ block: "center" })
    el?.focus({ preventScroll: true })
  }, [revealed])

  useEffect(() => {
    if (!draftId) return
    saveDraft(formData, step, draftId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const onSent = () => {
    toast.success(
      "Submission received — editorial review typically takes 1–3 days."
    )
    router.push("/contribute/submissions")
  }
  const onFailed = (err: Error | null) =>
    toast.error(err?.message ?? "Submission failed")

  const submit = () => {
    if (improve && changed.length === 0) {
      toast.error("Change at least one field before sending.")

      return
    }
    const incomplete = firstIncompleteStep(formData, scope)
    if (incomplete !== null) {
      reveal(incomplete, missingFields(incomplete, formData, scope))

      return
    }

    const { libraryFields, ...meta } = splitForm(formData)
    const fields = improve
      ? recordChangesPayload(initial, formData)
      : libraryFields

    if (draftId) {
      // Finalize keeps the draft's history; `fields` is what the reviewer sees.
      finalizeDraft(
        { id: draftId, formData: { ...fields, ...meta } },
        { onSuccess: onSent, onError: onFailed }
      )
    } else {
      createSubmission(
        withSubmissionLocale(
          { submissionType, ...targetParams, ...meta, fields },
          translationLocale
        ),
        { onSuccess: onSent, onError: onFailed }
      )
    }
  }

  const findHref = `${INDEX_EDITOR_PATH}`

  return (
    <ChangedFieldsContext.Provider value={changedSet}>
      <main
        id="wizard-main"
        className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12"
      >
        <div
          ref={topRef}
          className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12 2xl:grid-cols-[300px_minmax(0,1fr)] 2xl:gap-16"
          style={{ scrollMarginTop: "128px" }}
        >
          {/* Left — rail: title, status, completeness, stepper */}
          <div className="min-w-0 self-start lg:sticky lg:top-[128px]">
            <h2
              className="truncate"
              style={{
                fontFamily: T.font.serif,
                fontSize: "24px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                color: T.ink.base,
                margin: "0 0 6px",
              }}
              title={improve ? target.name : undefined}
            >
              {improve ? target.name : "Your record"}
            </h2>
            {improve ? (
              changed.length === 0 ? (
                <RailStatus icon="mdi:pencil-outline" color={T.ink.dim}>
                  No changes yet
                </RailStatus>
              ) : (
                <RailStatus icon="mdi:pencil" color={T.accent.primary}>
                  {changed.length} field{changed.length === 1 ? "" : "s"}{" "}
                  changed
                  {lastSavedAt
                    ? ` · saved ${formatSavedTime(lastSavedAt)}`
                    : ""}
                </RailStatus>
              )
            ) : (
              <RailStatus
                icon={
                  lastSavedAt
                    ? "mdi:check-circle-outline"
                    : "mdi:circle-outline"
                }
                color={lastSavedAt ? T.accent.ok : T.ink.dim}
              >
                {lastSavedAt
                  ? `Draft saved · ${formatSavedTime(lastSavedAt)}`
                  : "Draft not yet saved"}
              </RailStatus>
            )}
            <div className="mt-5">
              <RecordProgress
                progress={progress}
                improving={improve}
                changedCount={changed.length}
              />
            </div>
            <div className="mt-5">
              <WizardStepNav
                currentStep={step}
                progress={progress}
                changedSteps={stepsWithChanges}
                onStepClick={handleStepClick}
                findHref={findHref}
              />
            </div>
          </div>

          {/* Right — step form */}
          <div className="max-w-[880px] min-w-0">
            {improve && (
              <div
                className="mb-8 flex flex-col gap-3 rounded-[20px] p-5"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <p
                  className="m-0 flex items-start gap-3 text-[15px] leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  <Icon
                    icon="mdi:pencil-outline"
                    width={18}
                    aria-hidden="true"
                    style={{
                      color: T.accent.primary,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <span>
                    <strong style={{ color: T.ink.base }}>
                      Improving an existing record.
                    </strong>{" "}
                    Change only what you can source. Changed fields are marked.
                    {target.isClaimed
                      ? " You look after this library, so your edit goes straight to review as a stewarded change."
                      : ""}
                  </span>
                </p>
                <Link
                  href={findHref}
                  className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-muted-2)"
                  style={{
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.deep,
                    color: T.ink.base,
                  }}
                >
                  Choose a different library
                </Link>
              </div>
            )}

            {translating && (
              <TranslationBanner
                languageName={locale.languageName}
                missing={locale.missing}
              />
            )}

            {showDraftBanner && existingDraft && (
              <DraftResumeBanner
                savedStep={existingDraft.stepCompleted ?? 1}
                savedAt={existingDraft.updatedAt}
                onResume={resumeDraft}
                onDiscard={discardDraft}
              />
            )}

            <EditableFieldsContext.Provider value={editable}>
              <FieldErrorsContext.Provider value={fieldErrors}>
                <StepComponent
                  f={formData}
                  set={set}
                  setFormData={setFormData}
                  improving={improve}
                />
              </FieldErrorsContext.Provider>
            </EditableFieldsContext.Provider>

            <div className="mt-10">
              <Notice
                icon="mdi:lightbulb-on-outline"
                tone="info"
                title={tip.title}
              >
                <p className="m-0" style={{ color: T.ink.base }}>
                  {tip.body}
                </p>
              </Notice>
            </div>

            <div
              role="group"
              aria-label="Step navigation"
              className="flex flex-wrap items-center gap-3"
              style={{
                marginTop: "40px",
                paddingTop: "28px",
                borderTop: `1px solid ${T.border.line}`,
              }}
            >
              {step > 1 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-muted-2)"
                  style={{
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.deep,
                    color: T.ink.base,
                    cursor: "pointer",
                    fontFamily: T.font.sans,
                  }}
                >
                  <Icon icon="mdi:arrow-left" width={18} aria-hidden="true" />
                  Back
                </button>
              ) : (
                <Link
                  href={findHref}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-muted-2)"
                  style={{
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.deep,
                    color: T.ink.base,
                    fontFamily: T.font.sans,
                  }}
                >
                  <Icon icon="mdi:arrow-left" width={18} aria-hidden="true" />
                  Back
                </Link>
              )}

              <span className="flex-1" />

              {improve && step < LAST_STEP && (
                <button
                  type="button"
                  onClick={() => handleStepClick(LAST_STEP)}
                  disabled={changed.length === 0}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-muted-2) disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.deep,
                    color: T.ink.base,
                    cursor: "pointer",
                    fontFamily: T.font.sans,
                  }}
                >
                  Skip to sources
                </button>
              )}

              {step < LAST_STEP ? (
                <button
                  type="button"
                  onClick={goNext}
                  className={primaryCtaSm}
                  style={{ border: "none", cursor: "pointer" }}
                >
                  Next:{" "}
                  {
                    [
                      "",
                      "Identity",
                      "Location",
                      "Visit",
                      "Collections",
                      "History",
                      "Photo",
                      "Sources & send",
                    ][step + 1]
                  }
                  <Icon icon="mdi:arrow-right" width={18} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={isPending}
                  aria-busy={isPending}
                  className={primaryCtaSm}
                  style={{
                    border: "none",
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending ? "Submitting…" : "Submit for review"}
                  {!isPending && (
                    <Icon
                      icon="mdi:arrow-right"
                      width={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </ChangedFieldsContext.Provider>
  )
}
