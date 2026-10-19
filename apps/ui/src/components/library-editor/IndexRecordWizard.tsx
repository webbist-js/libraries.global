"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations as useUiTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Notice } from "@/components/ds/Notice"
import { Container } from "@/components/elementary/Container"
import {
  useCreateSubmission,
  useFinalizeDraft,
  useResumeDraft,
  useSaveDraft,
} from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import { primaryCtaSm } from "@/lib/styles"

import { ChangedFieldsContext } from "./ChangedFieldsContext"
import { DraftResumeBanner } from "./DraftResumeBanner"
import { StaffPublishControls } from "./StaffPublishControls"
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
import {
  fieldInputStyle,
  fieldLabelStyle,
  WIZARD_GRID,
  WIZARD_RAIL,
  WIZARD_CARD,
} from "./wizard.constants"
import { stepProgress } from "./wizard.progress"
import { nextWizardStep, wizardStepPosition, wizardSteps } from "./wizard.steps"
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
import {
  EditableFieldsContext,
  FieldErrorsContext,
  ModeratedFieldsContext,
  StepPositionContext,
} from "./WizardFields"
import { RecordProgress, WizardStepNav, wizardStepCopy } from "./WizardStepNav"
import { STEP_COMPONENTS } from "./WizardSteps"

export type { FormData, SocialLink, UploadedImage } from "./wizard.types"
export { calcScore } from "./wizard.scoring"

export const INDEX_EDITOR_PATH = "/contribute/index"

const LAST_STEP = 7

function formatSavedTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, {
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
    if (k === "staffCreation") continue
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
 * The shared record form. `new` mode proposes a library
 * (`new_library`); `improve` mode edits an existing record, sending only
 * the changed fields as a `library_edit` (claimants) or a record
 * `correction` (everyone else). Both modes save a draft as you go.
 */
export function IndexRecordWizard({
  mode,
  initialData,
  target,
  locale,
  publicPath,
  initialStep,
  creationTeams = [],
  timetableContext,
}: IndexRecordWizardProps) {
  const tUi = useUiTranslations("ui")
  const displayLocale = useLocale()

  const staff = mode === "staff"
  const staffNew = mode === "staff-new"
  const inStaffArea = staff || staffNew
  const [creationTeamId, setCreationTeamId] = useState(
    creationTeams.length === 1 ? creationTeams[0]!.id : ""
  )
  const staffCreation = staffNew
    ? { teamDocumentId: creationTeamId || null }
    : undefined
  const improve = (mode === "improve" || staff) && !!target
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
  const loaded = useMemo<FormData>(
    () => (initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM),
    [initialData]
  )
  const [initial, setInitial] = useState(loaded)
  const [step, setStep] = useState(() =>
    initialStep &&
    wizardStepPosition(initialStep, loaded.libraryType === "Mobile") > 0
      ? initialStep
      : 1
  )
  const [visited, setVisited] = useState<number[]>([])
  // eslint-disable-next-line react/hook-use-state -- `formData` is the view below
  const [rawFormData, setFormData] = useState<FormData>(initial)
  // Shared fields stay at the record's value in translation mode, whatever
  // a resumed draft holds.
  const formData = useMemo(
    () => restrictToEditable(initial, rawFormData, editable),
    [initial, rawFormData, editable]
  )
  const mobile = formData.libraryType === "Mobile"
  const steps = wizardSteps(mobile)
  const position = wizardStepPosition(step, mobile)
  const nextStep = nextWizardStep(step, mobile)
  const stepCount = steps.length - 1
  const stepCounter = useMemo(
    () => ({ position, total: stepCount }),
    [position, stepCount]
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
    translationLocale ?? undefined,
    staffNew
  )
  const isPending = isCreating || isFinalizing

  // Improve mode: what differs from the record.
  const changed = useMemo(
    () => (improve ? changedFieldKeys(initial, formData) : []),
    [improve, initial, formData]
  )
  const changedSet = useMemo(() => new Set(changed), [changed])
  const stepsWithChanges = useMemo(
    () => changedSteps(changed, mobile),
    [changed, mobile]
  )
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
    const { staffCreation: _creation, ...savedForm } = existingDraft.draftData
    const resumed = {
      ...initial,
      ...(savedForm as Partial<FormData>),
    }
    setFormData(resumed)
    setStep(
      nextWizardStep(
        existingDraft.stepCompleted ?? 0,
        resumed.libraryType === "Mobile"
      )
    )
    setDraftId(existingDraft.documentId)
    if (staffNew) {
      const savedTeam = existingDraft.draftData.staffCreation as
        | { teamDocumentId?: string | null }
        | undefined
      setCreationTeamId(savedTeam?.teamDocumentId ?? "")
    }
    setDraftBannerDismissed(true)
  }, [existingDraft, initial, staffNew])

  const discardDraft = useCallback(() => setDraftBannerDismissed(true), [])

  const set = useCallback((k: keyof FormData, v: string) => {
    setFormData((prev) => ({ ...prev, [k]: v }))
  }, [])

  const StepComponent = STEP_COMPONENTS[step - 1]!
  const tip = tipFor(step, improve, staff, mobile)

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
            draftData: currentFormData as unknown as Record<string, unknown>,
            ...(staffNew ? { staffCreation } : {}),
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
      staffNew,
      creationTeamId,
    ]
  )

  const goNext = () => {
    if (!staff && missing.length > 0) {
      reveal(step, missing)

      return
    }
    setVisited((v) => (v.includes(step) ? v : [...v, step]))
    setStep(nextStep)
    if (draftId) saveDraft(formData, step, draftId)
    else if (!improve || changed.length > 0) startDraft(formData)
  }

  const goPrev = () => setStep(steps[Math.max(position - 1, 1)]!.n)

  const handleStepClick = (n: number) => {
    const forward = wizardStepPosition(n, mobile) > position
    if (!improve && !visited.includes(step) && forward) return
    if (!staff && forward && missing.length > 0) {
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

  useEffect(() => {
    if (!staff || !changed.length || isCreating) return
    const timeout = setTimeout(() => {
      if (draftId) saveDraft(formData, step, draftId)
      else startDraft(formData)
    }, 800)

    return () => clearTimeout(timeout)
  }, [
    staff,
    changed.length,
    draftId,
    formData,
    step,
    isCreating,
    saveDraft,
    startDraft,
  ])

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
      staffNew
        ? "Library sent for review. Approval will add it to your staff area."
        : "Submission received — editorial review typically takes 1–3 days."
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
          {
            submissionType,
            ...targetParams,
            ...meta,
            fields,
            ...(staffNew ? { staffCreation } : {}),
          },
          translationLocale
        ),
        { onSuccess: onSent, onError: onFailed }
      )
    }
  }

  const findHref = staff ? "/staff" : INDEX_EDITOR_PATH

  // The staff area's layout already provides the page container, so the
  // wizard adds no padding of its own there: same rail, widths and spacing
  // as /contribute/index/[slug].
  const Wrapper = inStaffArea ? "div" : Container

  return (
    <ChangedFieldsContext.Provider value={changedSet}>
      <ModeratedFieldsContext.Provider value={staff}>
        <Wrapper className={inStaffArea ? "w-full" : "py-10"}>
          <div
            id="wizard-main"
            ref={topRef}
            className={WIZARD_GRID}
            style={{ scrollMarginTop: "128px" }}
          >
            {/* Left — rail: title, status, completeness, stepper */}
            <div
              className={WIZARD_RAIL}
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
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
                {improve ? target.name : tUi("your_record")}
              </h2>
              {improve ? (
                changed.length === 0 ? (
                  <RailStatus icon="mdi:pencil-outline" color={T.ink.dim}>
                    {tUi("no_changes_yet")}{" "}
                  </RailStatus>
                ) : (
                  <RailStatus icon="mdi:pencil" color={T.accent.primary}>
                    {changed.length} field{changed.length === 1 ? "" : "s"}{" "}
                    changed
                    {lastSavedAt
                      ? ` · ${tUi("draft_saved")} ${formatSavedTime(lastSavedAt, displayLocale)}`
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
                    ? `${tUi("draft_saved")} · ${formatSavedTime(lastSavedAt, displayLocale)}`
                    : tUi("draft_not_yet_saved")}
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
                  staff={staff}
                  mobile={formData.libraryType === "Mobile"}
                />
              </div>
            </div>

            {/* Right — step form */}
            <section
              aria-label={tUi("library_record_form")}
              className={WIZARD_CARD}
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              {improve && !staff && (
                <div
                  className="mb-8 flex flex-col gap-3 rounded-[20px] p-5"
                  style={{
                    background: T.bg.surface,
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
                        {tUi("improving_an_existing_record")}{" "}
                      </strong>{" "}
                      {tUi(
                        "change_only_what_you_can_source_changed_fields_are_marked"
                      )}{" "}
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
                    {tUi("choose_a_different_library")}{" "}
                  </Link>
                </div>
              )}

              {staff && (
                <div className="mb-6">
                  <Notice
                    icon="mdi:account-check-outline"
                    tone="info"
                    title={tUi("you_re_editing_as_staff")}
                  >
                    <p className="m-0">
                      Changes publish straight away and show in the record’s
                      history. Fields marked “Reviewed by a moderator” go to a
                      Moderator first.
                    </p>
                  </Notice>
                  {step === 3 && (
                    <p
                      className="mt-3 mb-0 flex items-start gap-2 text-[14px]"
                      style={{ color: T.ink.dim }}
                    >
                      <Icon
                        icon="mdi:bullhorn-outline"
                        width={16}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0"
                        style={{ color: T.accent.primary }}
                      />
                      <span>
                        <Link
                          href={staffLibraryHref(
                            target!.slug,
                            "/notices#post-notice"
                          )}
                          className="font-semibold underline underline-offset-[3px]"
                          style={{ color: T.accent.primary }}
                        >
                          For a closure or holiday hours, post a notice
                        </Link>{" "}
                        instead of changing the regular week.
                      </span>
                    </p>
                  )}
                </div>
              )}

              {staffNew && (
                <div className="mb-6 flex flex-col gap-4">
                  <Notice
                    icon="mdi:account-check-outline"
                    tone="info"
                    title={tUi("adding_a_library_as_staff")}
                  >
                    <p className="m-0">
                      An editor reviews the new record and your staff access
                      together. Approval makes you an owner of this library.{" "}
                      {creationTeamId
                        ? tUi(
                            "it_will_also_be_covered_by_the_team_selected_below"
                          )
                        : tUi("everyday_staff_tools_stay_free")}
                    </p>
                  </Notice>
                  {creationTeams.length > 0 && (
                    <label
                      className="flex flex-col gap-2"
                      style={fieldLabelStyle}
                    >
                      {tUi("team_coverage")}{" "}
                      <select
                        aria-label={tUi("team_coverage")}
                        value={creationTeamId}
                        disabled={!!draftId}
                        onChange={(event) =>
                          setCreationTeamId(event.target.value)
                        }
                        style={fieldInputStyle}
                      >
                        <option value="">
                          {tUi("no_team_free_staff_access")}
                        </option>
                        {creationTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          color: T.ink.dim,
                          fontSize: 14,
                          fontWeight: 400,
                        }}
                      >
                        {draftId
                          ? tUi("team_coverage_is_saved_with_this_draft")
                          : tUi(
                              "choose_the_library_service_this_new_record_belongs_to"
                            )}
                      </span>
                    </label>
                  )}
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
                  savedStep={Math.max(
                    1,
                    wizardStepPosition(
                      existingDraft.stepCompleted ?? 1,
                      existingDraft.draftData?.libraryType === "Mobile"
                    )
                  )}
                  savedAt={existingDraft.updatedAt}
                  onResume={resumeDraft}
                  onDiscard={discardDraft}
                />
              )}

              <EditableFieldsContext.Provider value={editable}>
                <FieldErrorsContext.Provider value={fieldErrors}>
                  <StepPositionContext.Provider value={stepCounter}>
                    <StepComponent
                      f={formData}
                      set={set}
                      setFormData={setFormData}
                      improving={improve}
                      timetableContext={timetableContext}
                    />
                  </StepPositionContext.Provider>
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
                aria-label={tUi("step_navigation")}
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
                    {tUi("back")}{" "}
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
                    {tUi("back")}{" "}
                  </Link>
                )}

                <span className="flex-1" />

                {improve && !staff && step !== LAST_STEP && (
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
                    {tUi("skip_to_sources")}{" "}
                  </button>
                )}

                {step !== LAST_STEP ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className={`${primaryCtaSm} min-h-12 px-6 text-[16px]`}
                    style={{ border: "none", cursor: "pointer" }}
                  >
                    Next: {wizardStepCopy(nextStep, mobile, staff).label}
                    <Icon
                      icon="mdi:arrow-right"
                      width={18}
                      aria-hidden="true"
                    />
                  </button>
                ) : staff ? null : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isPending}
                    aria-busy={isPending}
                    className={`${primaryCtaSm} min-h-12 px-6 text-[16px]`}
                    style={{
                      border: "none",
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    {isPending ? tUi("submitting") : tUi("submit_for_review")}
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
              {staff && target && (
                <StaffPublishControls
                  id={target.documentId}
                  slug={target.slug}
                  initial={initial}
                  current={formData}
                  draftId={draftId}
                  locale={locale?.code}
                  publicPath={publicPath}
                  onStale={(fresh) => {
                    setInitial((prev) => ({ ...prev, ...fresh }))
                    setFormData((prev) => ({ ...prev, ...fresh }))
                  }}
                  onDiscard={() => {
                    setFormData(initial)
                    if (draftId) saveDraft(initial, step, draftId)
                    setDraftBannerDismissed(true)
                  }}
                  onPublished={() => {
                    setInitial(formData)
                    setDraftId(null)
                    setDraftBannerDismissed(true)
                  }}
                />
              )}
            </section>
          </div>
        </Wrapper>
      </ModeratedFieldsContext.Provider>
    </ChangedFieldsContext.Provider>
  )
}
