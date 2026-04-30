"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  useCreateSubmission,
  useFinalizeDraft,
  useResumeDraft,
  useSaveDraft,
} from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"
import { auroraCtaSm } from "@/lib/styles"

import { AddLibraryHero } from "./AddLibraryHero"
import { DraftResumeBanner } from "./DraftResumeBanner"
import { LibrarySearchGate } from "./LibrarySearchGate"
import { calcScore } from "./wizard.scoring"
import {
  EMPTY_FORM,
  type AddLibraryWizardProps,
  type FormData,
} from "./wizard.types"
import { WizardCompletionSidebar } from "./WizardCompletionSidebar"
import { WizardStepNav } from "./WizardStepNav"
import { STEP_COMPONENTS } from "./WizardSteps"
import { ContributeNavBar } from "../../_components/ContributeNavBar"

export type { FormData, SocialLink, UploadedImage } from "./wizard.types"
export { calcScore } from "./wizard.scoring"

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

  const score = calcScore(formData)
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
    <>
      <AddLibraryHero
        lastSavedAt={lastSavedAt}
        libraryName={isEditMode ? formData.name || undefined : undefined}
      />

      <ContributeNavBar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 260px",
          gap: "0",
          minHeight: "calc(100vh - 260px)",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
        className="grid-cols-1 lg:grid-cols-[220px_1fr_260px]"
      >
        {/* Left — step nav */}
        <aside
          style={{
            paddingRight: "24px",
            paddingTop: "8px",
            borderRight: `1px solid ${T.border.line}`,
            position: "sticky",
            top: "80px",
            alignSelf: "start",
          }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              margin: "0 0 16px",
              opacity: 0.7,
            }}
          >
            {isEditMode ? "Edit library" : "Add a library"}
          </p>
          <WizardStepNav
            currentStep={step}
            completedSteps={completed}
            onStepClick={handleStepClick}
          />
        </aside>

        {/* Centre — step form */}
        <main id="wizard-main" style={{ padding: "0 40px" }}>
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
                style={{ display: "flex", gap: "10px", marginTop: "36px" }}
              >
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    style={{
                      padding: "11px 22px",
                      borderRadius: "10px",
                      border: `1px solid ${T.border.hi}`,
                      background: "transparent",
                      color: T.ink.dim,
                      fontSize: "14px",
                      cursor: "pointer",
                      fontFamily: T.font.sans,
                    }}
                  >
                    ← Back
                  </button>
                )}

                {step < 7 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className={auroraCtaSm}
                    style={{ border: "none", cursor: "pointer" }}
                  >
                    Next step →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isPending}
                    aria-busy={isPending}
                    className={auroraCtaSm}
                    style={{
                      border: "none",
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.6 : 1,
                    }}
                  >
                    {isPending ? "Submitting…" : "Submit for review →"}
                  </button>
                )}
              </div>
            </>
          )}
        </main>

        {/* Right — completion sidebar */}
        <aside
          aria-label="Submission completeness"
          style={{
            paddingLeft: "24px",
            borderLeft: `1px solid ${T.border.line}`,
            position: "sticky",
            top: "80px",
            alignSelf: "start",
          }}
        >
          <WizardCompletionSidebar score={score} formData={formData} />
        </aside>
      </div>
    </>
  )
}
