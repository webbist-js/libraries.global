"use client"

import { Icon } from "@iconify/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  useCreateSubmission,
  useFinalizeDraft,
  useResumeDraft,
  useSaveDraft,
} from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"
import { primaryCtaSm } from "@/lib/styles"

import { DraftResumeBanner } from "./DraftResumeBanner"
import { LibrarySearchGate } from "./LibrarySearchGate"
import {
  EMPTY_FORM,
  type AddLibraryWizardProps,
  type FormData,
} from "./wizard.types"
import { WizardCompletionSidebar } from "./WizardCompletionSidebar"
import { WizardStepNav } from "./WizardStepNav"
import { STEP_COMPONENTS } from "./WizardSteps"

export type { FormData, SocialLink, UploadedImage } from "./wizard.types"
export { calcScore } from "./wizard.scoring"

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

function DraftStatus({ lastSavedAt }: { lastSavedAt: Date | null }) {
  return (
    <p
      role="status"
      style={{
        fontFamily: T.font.sans,
        fontSize: "15px",
        color: lastSavedAt ? T.accent.ok : T.ink.dim,
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <Icon
        icon={lastSavedAt ? "mdi:check-circle-outline" : "mdi:circle-outline"}
        width={16}
        aria-hidden="true"
      />
      {lastSavedAt
        ? `Draft saved · ${formatSavedTime(lastSavedAt)}`
        : "Draft not yet saved"}
    </p>
  )
}

export function AddLibraryWizard({
  sessionUser: _,
  initialData,
  targetDocumentId,
  targetSlug,
}: AddLibraryWizardProps) {
  const isEditMode = !!(targetDocumentId && targetSlug)
  const router = useRouter()
  const [step, setStep] = useState(isEditMode ? 1 : 0)
  const [claimedEntityRefs, setClaimedEntityRefs] = useState<string[]>([])
  const [completed, setCompleted] = useState<number[]>([])
  const [formData, setFormData] = useState<FormData>(
    initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM
  )
  const [draftId, setDraftId] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/profile/me/affiliations")
      .then((r) => r.json())
      .then((j: { entityRefs?: string[] }) =>
        setClaimedEntityRefs(j.entityRefs ?? [])
      )
      .catch(() => {})
  }, [])

  const { mutate: createSubmission, isPending: isCreating } =
    useCreateSubmission()
  const { mutate: saveDraftMutation } = useSaveDraft()
  const { mutate: finalizeDraft, isPending: isFinalizing } = useFinalizeDraft()
  const { data: existingDraft } = useResumeDraft(
    isEditMode ? "" : "new_library"
  )

  const isPending = isCreating || isFinalizing

  const showDraftBanner =
    !draftBannerDismissed && !draftId && !!existingDraft?.draftData

  const resumeDraft = useCallback(() => {
    if (!existingDraft?.draftData) return
    setFormData(existingDraft.draftData as unknown as FormData)
    setStep(Math.max(1, (existingDraft.stepCompleted ?? 0) + 1))
    setDraftId(existingDraft.documentId)
    setDraftBannerDismissed(true)
  }, [existingDraft])

  useEffect(() => {
    if (existingDraft?.draftData && step === 0) {
      setStep(Math.max(1, (existingDraft.stepCompleted ?? 0) + 1))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraft])

  const discardDraft = useCallback(() => {
    setDraftBannerDismissed(true)
  }, [])

  const set = useCallback((k: keyof FormData, v: string) => {
    setFormData((prev) => ({ ...prev, [k]: v }))
  }, [])

  const StepComponent = step > 0 ? STEP_COMPONENTS[step - 1]! : null

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

  const goNext = () => {
    const nextCompleted = completed.includes(step)
      ? completed
      : [...completed, step]
    setCompleted(nextCompleted)
    const nextStep = Math.min(step + 1, 7)
    setStep(nextStep)

    if (draftId) {
      saveDraft(formData, step, draftId)
    } else if (!isEditMode) {
      const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
        formData
      createSubmission(
        {
          submissionType: "new_library",
          note,
          editSummary,
          evidenceType,
          evidenceUrl,
          fields: libraryFields as unknown as Record<string, unknown>,
          asDraft: true,
        },
        {
          onSuccess: (submission) => {
            setDraftId(submission.documentId)
            setLastSavedAt(new Date())
          },
          onError: () => {},
        }
      )
    }
  }

  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const handleStepClick = (n: number) => {
    if (n === 0 || completed.includes(step) || n <= step) setStep(n)
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
    if (!draftId) return
    saveDraft(formData, step, draftId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const submit = () => {
    if (!formData.name || !formData.libraryType || !formData.evidenceUrl) {
      toast.error(
        "Please fill in the required fields: name, library type, and evidence URL."
      )

      return
    }

    if (draftId && !isEditMode) {
      finalizeDraft(
        {
          id: draftId,
          formData: formData as unknown as Record<string, unknown>,
        },
        {
          onSuccess: () => {
            toast.success(
              "Submission received — editorial review typically takes 1–3 days."
            )
            router.push("/contribute/submissions")
          },
          onError: (err) => toast.error(err?.message ?? "Submission failed"),
        }
      )
    } else {
      const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
        formData
      createSubmission(
        {
          submissionType: isEditMode ? "library_edit" : "new_library",
          note,
          editSummary,
          evidenceType,
          evidenceUrl,
          fields: libraryFields as unknown as Record<string, unknown>,
          ...(isEditMode && targetDocumentId ? { targetDocumentId } : {}),
          ...(isEditMode && targetSlug ? { targetSlug } : {}),
        },
        {
          onSuccess: () => {
            toast.success(
              "Submission received — editorial review typically takes 1–3 days."
            )
            router.push("/contribute/submissions")
          },
          onError: (err) => toast.error(err?.message ?? "Submission failed"),
        }
      )
    }
  }

  return (
    <main
      id="wizard-main"
      className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12"
    >
      <div
        ref={topRef}
        className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[280px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]"
        style={{ scrollMarginTop: "128px" }}
      >
        {/* Left — rail: back link, title, stepper */}
        <div className="min-w-0 self-start lg:sticky lg:top-[128px] lg:row-span-2 xl:row-span-1">
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "24px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              color: T.ink.base,
              margin: "0 0 6px",
            }}
          >
            {isEditMode ? "Your edits" : "Your record"}
          </h2>
          <DraftStatus lastSavedAt={lastSavedAt} />
          <div className="mt-6">
            <WizardStepNav
              currentStep={step}
              completedSteps={completed}
              onStepClick={handleStepClick}
              hideFindStep={isEditMode}
            />
          </div>
        </div>

        {/* Centre — step form */}
        <div className="min-w-0">
          {step === 0 ? (
            <LibrarySearchGate
              claimedEntityRefs={claimedEntityRefs}
              onConfirmNew={({ name, city }) => {
                setFormData((prev) => ({
                  ...prev,
                  ...(name && !prev.name ? { name } : {}),
                  ...(city && !prev.city ? { city } : {}),
                }))
                setStep(1)
              }}
            />
          ) : (
            <>
              {showDraftBanner && existingDraft && (
                <DraftResumeBanner
                  savedStep={existingDraft.stepCompleted ?? 1}
                  savedAt={existingDraft.updatedAt}
                  onResume={resumeDraft}
                  onDiscard={discardDraft}
                />
              )}
              {StepComponent && (
                <StepComponent
                  f={formData}
                  set={set}
                  setFormData={setFormData}
                />
              )}

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
                {step > 1 && (
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
                )}

                {step < 7 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className={primaryCtaSm}
                    style={{ border: "none", cursor: "pointer" }}
                  >
                    Next step
                    <Icon
                      icon="mdi:arrow-right"
                      width={18}
                      aria-hidden="true"
                    />
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
            </>
          )}
        </div>

        {/* Right — completeness + tip */}
        <aside
          aria-label="Submission completeness"
          className="self-start lg:col-start-2 xl:sticky xl:top-[128px] xl:col-start-auto"
        >
          <WizardCompletionSidebar formData={formData} step={step} />
        </aside>
      </div>
    </main>
  )
}
