"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { LibraryContributionReview } from "@/components/library/LibraryContributionReview"
import { IndexRecordWizard } from "@/components/library-editor/IndexRecordWizard"
import { PublishedRecordChangedError } from "@/components/library-editor/wizard.resume"
import type {
  FormData,
  LibraryEditorBootstrap,
  WizardDraftState,
} from "@/components/library-editor/wizard.types"
import { primaryCtaSm } from "@/components/ui/action-styles"
import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { useHydratedSession } from "@/lib/access-client"
import { Link, useRouter } from "@/lib/navigation"

export const CONTRIBUTION_STATUS = {
  draft: "Draft",
  pending: "Submitted for review",
  needs_info: "Needs changes",
  approved: "Accepted",
  rejected: "Not accepted",
} as const

function ContributionStatusPanel({
  current,
  sent,
  errorMessage,
  onContinue,
  onBack,
  onRefresh,
}: {
  current: Submission
  sent: boolean
  errorMessage?: string
  onContinue: () => void
  onBack: () => void
  onRefresh: () => void
}) {
  return (
    <div className="space-y-5 p-6" aria-live="polite">
      <Notice
        icon="mdi:clipboard-text-outline"
        tone={current.status === "needs_info" ? "warn" : "info"}
        title={CONTRIBUTION_STATUS[current.status]}
      >
        <p>
          {sent && current.status === "pending"
            ? "Thank you. Your changes have been sent for review. The published record has not changed."
            : (current.reviewNote ??
              "This is the current state of your contribution.")}
        </p>
      </Notice>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {current.fields ? (
        <LibraryContributionReview fields={current.fields} />
      ) : null}
      {current.status === "needs_info" || current.status === "draft" ? (
        <button className={primaryCtaSm} onClick={onContinue}>
          Continue your changes
        </button>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button className={primaryCtaSm} onClick={onBack}>
          Back to library
        </button>
        <button className="min-h-11 underline" onClick={onRefresh}>
          Refresh status
        </button>
        <Link className="min-h-11 underline" href="/contribute/submissions">
          View submissions
        </Link>
      </div>
    </div>
  )
}

function contributionSignIn(path: string, step?: string, locale?: string) {
  const query = new URLSearchParams({ suggest: "correction" })
  if (step) query.set("step", step)
  if (locale) query.set("editLocale", locale)

  return `/auth/signin?callbackUrl=${encodeURIComponent(`${path}?${query}`)}`
}

function latestSubmission(
  loaded: Submission | undefined,
  selected: Submission | null
) {
  return loaded && loaded.updatedAt >= (selected?.updatedAt ?? "")
    ? loaded
    : selected
}

function editorNavigation(state: WizardDraftState) {
  return {
    disabled: state.step === 0 || state.dirty || state.saving,
    label:
      state.dirty || state.saving
        ? "Saving before opening full editor…"
        : "Open full editor",
  }
}

function ContributionLoadError({
  message,
  signInHref,
  onRetry,
}: {
  message?: string
  signInHref: string
  onRetry: () => void
}) {
  return (
    <div role="alert" className="space-y-3 p-6">
      <p>{message ?? "Your saved contributions could not load."}</p>
      <button className={primaryCtaSm} onClick={onRetry}>
        Retry
      </button>
      {message?.includes("session ended") ? (
        <Link className="min-h-11 underline" href={signInHref}>
          Sign in again
        </Link>
      ) : null}
    </div>
  )
}

function ContributionChoices({
  matching,
  onSelect,
  onNew,
}: {
  matching: Submission[]
  onSelect: (submission: Submission) => void
  onNew: () => void
}) {
  return (
    <div className="space-y-4 p-6">
      <h3 className="type-panel-title">Your contributions to this library</h3>
      {matching.slice(0, 5).map((submission) => (
        <button
          key={submission.documentId}
          className="block min-h-16 w-full rounded-2xl border p-4 text-left"
          onClick={() => onSelect(submission)}
        >
          <strong>{CONTRIBUTION_STATUS[submission.status]}</strong>
          <span className="mt-1 block text-sm">
            {submission.editSummary || "Library record changes"}
          </span>
        </button>
      ))}
      {!matching.some(
        (row) => row.status === "draft" || row.status === "needs_info"
      ) ? (
        <button className={primaryCtaSm} onClick={onNew}>
          Suggest another change
        </button>
      ) : null}
    </div>
  )
}

function ContributionEditorSession({
  slug,
  path,
  step,
  locale,
  onState,
  onClose,
}: {
  readonly slug: string
  readonly path: string
  readonly step?: string
  readonly locale?: string
  readonly onState: (state: WizardDraftState) => void
  readonly onClose: () => void
}) {
  const { data: session, isPending: sessionPending } = useHydratedSession()
  const userId = session?.user?.id
  const [screen, setScreen] = useState<"choose" | "edit" | "status">("choose")
  const [selected, setSelected] = useState<Submission | null>(null)
  const [sent, setSent] = useState(false)
  const [editorState, setEditorState] = useState<WizardDraftState>({
    dirty: false,
    saving: false,
    draftId: null,
    step: 0,
  })
  const router = useRouter()
  const trackState = useCallback(
    (state: WizardDraftState) => {
      setEditorState(state)
      onState(state)
    },
    [onState]
  )
  const mine = useMySubmissions()
  const query = new URLSearchParams()
  if (step) query.set("step", step)
  if (locale) query.set("locale", locale)
  const bootstrap = useQuery({
    queryKey: ["library-editor", userId, slug, locale, step],
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/contribute/library/${encodeURIComponent(slug)}/editor?${query}`,
        { signal, cache: "no-store" }
      )
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session ended. Sign in again to continue."
            : "The editor could not load. Please retry."
        )

      return (await response.json()).data as LibraryEditorBootstrap
    },
    staleTime: 0,
  })
  const owned = useQuery({
    queryKey: ["library-submission", userId, selected?.documentId],
    enabled: !!userId && !!selected && screen === "status",
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/submissions/my?documentId=${encodeURIComponent(selected?.documentId ?? "")}`,
        { signal, cache: "no-store" }
      )
      if (!response.ok) throw new Error("The submission status could not load.")
      const rows = (await response.json()).data as Submission[]
      if (!rows[0])
        throw new Error(
          "This submission is no longer available to this account."
        )

      return rows[0]
    },
    refetchOnWindowFocus: true,
  })
  const refreshedAcceptance = useRef(false)
  const accepted = (owned.data ?? selected)?.status === "approved"
  useEffect(() => {
    if (accepted && !refreshedAcceptance.current) {
      refreshedAcceptance.current = true
      router.refresh()
    }
  }, [accepted, router])
  const checkBaseline = useCallback(
    async (baseline: FormData, keys: readonly (keyof FormData)[]) => {
      const response = await fetch(
        `/api/contribute/library/${encodeURIComponent(slug)}?shape=wizard&locale=${encodeURIComponent(bootstrap.data?.locale?.code ?? "en")}`,
        { cache: "no-store" }
      )
      if (!response.ok)
        throw new Error(
          "Unable to check the latest published values. Your draft is kept; please retry."
        )
      const fresh = (await response.json()).data as FormData
      if (
        keys.some(
          (key) =>
            JSON.stringify(fresh[key] ?? null) !==
            JSON.stringify(baseline[key] ?? null)
        )
      )
        throw new PublishedRecordChangedError(fresh)
    },
    [slug, bootstrap.data?.locale?.code]
  )
  const submitted = useCallback(
    (submission: Submission) => {
      onState({ dirty: false, saving: false, draftId: null, step: 7 })
      setSelected(submission)
      setSent(true)
      setScreen("status")
    },
    [onState]
  )
  const tSave = useTranslations("draftSave")
  const signInHref = contributionSignIn(path, step, locale)
  const fullEditor = editorNavigation(editorState)
  if (sessionPending)
    return (
      <p role="status" className="p-6">
        Loading your session…
      </p>
    )
  if (!userId) {
    return (
      <div className="space-y-4 p-6">
        <h3 className="type-panel-title">Sign in to improve this library</h3>
        <p>The record will be prefilled when you return.</p>
        <Link className={primaryCtaSm} href={signInHref}>
          Sign in to contribute
        </Link>
      </div>
    )
  }
  if (bootstrap.isPending || mine.isLoading)
    return (
      <p role="status" className="p-6">
        Loading the library and your contributions…
      </p>
    )
  if (bootstrap.error || mine.error)
    return (
      <ContributionLoadError
        message={bootstrap.error?.message}
        signInHref={signInHref}
        onRetry={() => {
          bootstrap.refetch()
          mine.refetch()
        }}
      />
    )
  const data = bootstrap.data!
  if (data.staffHref)
    return (
      <div className="space-y-4 p-6">
        <h3 className="type-panel-title">You manage this record</h3>
        <p>
          Use the staff editor to publish ordinary updates and send sensitive
          changes for review.
        </p>
        <Link className={primaryCtaSm} href={data.staffHref}>
          Manage record
        </Link>
      </div>
    )
  const matching = (mine.data ?? [])
    .filter(
      (row) =>
        row.targetSlug === slug &&
        ["correction", "library_edit"].includes(row.submissionType) &&
        (row.locale ?? data.locale?.defaultCode) === data.locale?.code
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const current = latestSubmission(owned.data, selected)
  if (screen === "status" && current)
    return (
      <ContributionStatusPanel
        current={current}
        sent={sent}
        errorMessage={owned.error?.message}
        onContinue={() => {
          setSelected(current)
          setSent(false)
          setScreen("edit")
        }}
        onBack={() => {
          if (current.status === "approved") router.refresh()
          onClose()
        }}
        onRefresh={() => owned.refetch()}
      />
    )

  if (screen === "choose" && matching.length)
    return (
      <ContributionChoices
        matching={matching}
        onSelect={(submission) => {
          setSelected(submission)
          setScreen(
            ["draft", "needs_info"].includes(submission.status)
              ? "edit"
              : "status"
          )
        }}
        onNew={() => {
          setSelected(null)
          setScreen("edit")
        }}
      />
    )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm">
        <span>
          {data.locale?.languageName} · Changes are reviewed before publication
        </span>
        <button
          type="button"
          className="min-h-11 underline disabled:opacity-50"
          disabled={fullEditor.disabled}
          onClick={() => {
            const fullQuery = new URLSearchParams(query)
            fullQuery.set("step", String(editorState.step))
            if (editorState?.draftId)
              fullQuery.set("draft", editorState.draftId)
            router.push(`/contribute/index/${slug}?${fullQuery}`)
          }}
        >
          {fullEditor.label}
        </button>
      </div>
      {selected?.reviewNote ? (
        <div className="px-6 pt-4">
          <Notice
            icon="mdi:clipboard-text-outline"
            tone="warn"
            title="Reviewer’s feedback"
          >
            {selected.reviewNote}
          </Notice>
        </div>
      ) : null}
      <IndexRecordWizard
        key={`${userId}:${slug}:${data.locale?.code}:${selected?.documentId ?? "fresh"}`}
        mode="improve"
        {...data}
        layout="drawer"
        resumeSubmission={selected ?? undefined}
        beforeSubmit={checkBaseline}
        onCancel={onClose}
        onDraftState={trackState}
        onSubmitted={submitted}
      />
      <span className="sr-only">{tSave("leave")}</span>
    </>
  )
}

/** An account change destroys the previous account's selected submission. */
export function LibraryContributionEditor(
  props: Parameters<typeof ContributionEditorSession>[0]
) {
  const { data: session, isPending } = useHydratedSession()
  const { onState, slug, locale } = props
  useEffect(() => {
    onState({ dirty: false, saving: false, draftId: null, step: 1 })
  }, [session?.user?.id, onState])
  if (isPending)
    return (
      <p role="status" className="p-6">
        Loading your session…
      </p>
    )

  return (
    <ContributionEditorSession
      key={`${session?.user?.id ?? "anonymous"}:${slug}:${locale ?? "default"}`}
      {...props}
    />
  )
}
