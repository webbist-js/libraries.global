"use client"

import { Icon } from "@iconify/react"
import { QueryClientContext } from "@tanstack/react-query"
import { useLocale, useTranslations as useUiTranslations } from "next-intl"
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { Notice } from "@/components/ds/Notice"
import { Container } from "@/components/elementary/Container"
import {
  useCreateSubmission,
  useFinalizeDraft,
  useResumeDraft,
  useSaveDraft,
} from "@/hooks/useSubmissions"
import { useUnsavedNavigation } from "@/hooks/useUnsavedNavigation"
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

type RecoveryDraft = {
  form: FormData
  step: number
  id: string | null
  savedSnapshot: string
  creationTeamId: string
  updatedAt: number
}

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
        fontSize: "var(--type-body-size)",
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
  const tSave = useUiTranslations("draftSave")

  const queryClient = useContext(QueryClientContext)
  const recoveryKey = useMemo(
    () => [
      "index-editor-recovery",
      mode,
      target?.documentId ?? "new",
      locale?.code ?? "default",
    ],
    [mode, target?.documentId, locale?.code]
  )
  const [recovery, setRecovery] = useState<RecoveryDraft | null>(() => {
    const saved = queryClient?.getQueryData<RecoveryDraft>(recoveryKey)

    return saved && Date.now() - saved.updatedAt < 4 * 60 * 60 * 1000
      ? saved
      : null
  })
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(loaded)
  )
  const saveBusy = useRef(false)
  const committed = useRef(false)
  const persistedId = useRef<string | null>(null)
  const queuedSave = useRef<{
    form: FormData
    step: number
    id: string | null
  } | null>(null)
  const drainSave = useRef<() => void>(() => {})
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
  const dirty = JSON.stringify(formData) !== savedSnapshot
  const isPending = isCreating || isFinalizing || saving
  useUnsavedNavigation(dirty || saving, tSave("leave"), committed)
  // Browser Back cannot be cancelled reliably. Keep unpersisted work only in
  // this account’s in-memory query client; account changes clear that client.
  useEffect(() => {
    if (!queryClient || recovery) return
    if (!dirty || committed.current) {
      queryClient.removeQueries({ queryKey: recoveryKey, exact: true })

      return
    }
    queryClient.setQueryDefaults(["index-editor-recovery"], {
      gcTime: 4 * 60 * 60 * 1000,
    })
    queryClient.setQueryData<RecoveryDraft>(recoveryKey, {
      form: formData,
      step,
      id: draftId,
      savedSnapshot,
      creationTeamId,
      updatedAt: Date.now(),
    })
  }, [
    queryClient,
    recovery,
    dirty,
    recoveryKey,
    formData,
    step,
    draftId,
    savedSnapshot,
    creationTeamId,
  ])
  const restoreRecovery = () => {
    if (!recovery) return
    setFormData(recovery.form)
    setStep(recovery.step)
    setDraftId(recovery.id)
    persistedId.current = recovery.id
    setSavedSnapshot(recovery.savedSnapshot)
    setCreationTeamId(
      creationTeams.some((team) => team.id === recovery.creationTeamId)
        ? recovery.creationTeamId
        : ""
    )
    setDraftBannerDismissed(true)
    setRecovery(null)
  }
  const discardRecovery = () => {
    queryClient?.removeQueries({ queryKey: recoveryKey, exact: true })
    setRecovery(null)
  }

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
    !recovery &&
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
    persistedId.current = existingDraft.documentId
    setSavedSnapshot(JSON.stringify(resumed))
    setLastSavedAt(new Date(existingDraft.updatedAt))
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

  const targetParams = improve
    ? {
        targetEntityType: "library" as const,
        targetDocumentId: target.documentId,
        targetSlug: target.slug,
      }
    : {}

  const persist = useCallback(
    (currentFormData: FormData, currentStep: number, id: string | null) => {
      queuedSave.current = { form: currentFormData, step: currentStep, id }
      drainSave.current()
    },
    []
  )

  drainSave.current = () => {
    if (saveBusy.current || committed.current || !queuedSave.current) return
    const pending = queuedSave.current
    queuedSave.current = null
    saveBusy.current = true
    setSaving(true)
    setSaveError(null)
    const snapshot = JSON.stringify(pending.form)
    let succeeded = false
    const callbacks = {
      onSuccess: (submission?: { documentId?: string }) => {
        succeeded = true
        if (submission?.documentId) {
          persistedId.current = submission.documentId
          setDraftId(submission.documentId)
        }
        queryClient?.setQueryData<RecoveryDraft>(recoveryKey, (cached) =>
          cached
            ? {
                ...cached,
                id: submission?.documentId ?? persistedId.current ?? pending.id,
              }
            : undefined
        )
        setSavedSnapshot(snapshot)
        setLastSavedAt(new Date())
      },
      onError: () => {
        setSaveError(tSave("failed"))
      },
      onSettled: () => {
        saveBusy.current = false
        setSaving(false)
        if (succeeded && queuedSave.current) drainSave.current()
      },
    }
    const id = persistedId.current ?? pending.id
    if (id) {
      saveDraftMutation(
        {
          id,
          draftData: pending.form as unknown as Record<string, unknown>,
          stepCompleted: pending.step,
        },
        callbacks
      )
    } else {
      const { libraryFields, ...meta } = splitForm(pending.form)
      createSubmission(
        withSubmissionLocale(
          {
            submissionType,
            ...targetParams,
            ...meta,
            fields: improve
              ? recordChangesPayload(initial, pending.form)
              : libraryFields,
            asDraft: true,
            draftData: pending.form as unknown as Record<string, unknown>,
            ...(staffNew ? { staffCreation } : {}),
          },
          translationLocale
        ),
        callbacks
      )
    }
  }
  const saveDraft = persist
  const startDraft = (current: FormData) => persist(current, step, null)

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
    if (
      !dirty ||
      recovery ||
      showDraftBanner ||
      isFinalizing ||
      saveError ||
      !formData.name.trim()
    )
      return
    const timeout = setTimeout(() => persist(formData, step, draftId), 800)

    return () => clearTimeout(timeout)
  }, [
    dirty,
    recovery,
    showDraftBanner,
    isFinalizing,
    saveError,
    formData,
    step,
    draftId,
    persist,
  ])

  useEffect(() => {
    setSaveError(null)
  }, [formData])

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
    committed.current = true
    queryClient?.removeQueries({ queryKey: recoveryKey, exact: true })
    queuedSave.current = null
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
    if (saveBusy.current) return
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
                className="type-h2 truncate"
                style={{
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
              <div className="mt-3" aria-live="polite">
                {saveError ? (
                  <div role="alert">
                    <p className="text-sm">{saveError}</p>
                    <button
                      type="button"
                      className="min-h-11 font-semibold underline"
                      onClick={() => persist(formData, step, draftId)}
                    >
                      {tSave("retry")}
                    </button>
                  </div>
                ) : saving ? (
                  <RailStatus icon="mdi:loading" color={T.ink.dim}>
                    {tSave("saving")}
                  </RailStatus>
                ) : dirty ? (
                  <RailStatus icon="mdi:circle-outline" color={T.ink.dim}>
                    {tSave("unsaved")}
                  </RailStatus>
                ) : null}
              </div>
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
            <fieldset
              disabled={isFinalizing || (isCreating && !saving)}
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
                    className="m-0 flex items-start gap-3 text-base leading-[1.5]"
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
                    className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-muted-2)"
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
                      className="mt-3 mb-0 flex items-start gap-2 text-sm"
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
                          fontSize: "var(--type-body-small-size)",
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

              {recovery && (
                <section
                  role="status"
                  className="mb-6 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5"
                >
                  <h2 className="type-h2 m-0">{tSave("recoveryTitle")}</h2>
                  <p className="mt-2 text-sm text-(--t-ink-dim)">
                    {tSave("recoveryLead")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={primaryCtaSm}
                      onClick={restoreRecovery}
                    >
                      {tSave("restore")}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 px-3 text-sm underline"
                      onClick={discardRecovery}
                    >
                      {tSave("discardRecovery")}
                    </button>
                  </div>
                </section>
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
                    className={`${primaryCtaSm} min-h-12 px-6 text-base`}
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
                    className={`${primaryCtaSm} min-h-12 px-6 text-base`}
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
                  savingDraft={saving}
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
                    queryClient?.removeQueries({
                      queryKey: recoveryKey,
                      exact: true,
                    })
                    queuedSave.current = null
                    persistedId.current = null
                    setSavedSnapshot(JSON.stringify(formData))
                    setInitial(formData)
                    setDraftId(null)
                    setDraftBannerDismissed(true)
                  }}
                />
              )}
            </fieldset>
          </div>
        </Wrapper>
      </ModeratedFieldsContext.Provider>
    </ChangedFieldsContext.Provider>
  )
}
