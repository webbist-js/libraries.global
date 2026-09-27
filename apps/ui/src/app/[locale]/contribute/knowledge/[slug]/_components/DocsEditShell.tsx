"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { WikiBlockEditor } from "@/components/docs/editor/WikiBlockEditor"
import { WikiEditorSidebar } from "@/components/docs/editor/WikiEditorSidebar"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { ContributeSectionHeader } from "../../../_components/ContributeSectionHeader"

type EditArticle = {
  title: string
  slug: string
  summary: string | null
  body: Record<string, unknown>[]
  sectionKey: string
}

export function DocsEditShell(props: {
  readonly article: EditArticle
  readonly canDirectEdit: boolean
  readonly locale: string
}) {
  return (
    <Suspense fallback={null}>
      <DocsEditShellInner {...props} />
    </Suspense>
  )
}

function DocsEditShellInner({
  article,
  canDirectEdit,
  locale,
}: {
  readonly article: EditArticle
  readonly canDirectEdit: boolean
  readonly locale: string
}) {
  const searchParams = useSearchParams()
  const reportMode = searchParams.get("mode") === "report"
  const directEdit = canDirectEdit && !reportMode

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <main className="relative z-10 flex-1">
        <ContributeSectionHeader
          compact
          section={reportMode ? "Report a problem" : "Edit an article"}
          title={
            reportMode
              ? `Something wrong in *${article.title}?*`
              : `Improve *${article.title}.*`
          }
          lead={
            directEdit
              ? "Edit the page below. Your change is saved as a draft and goes to review — accepted changes are published and credited to you."
              : "Describe the change you'd like to see. A reviewer checks it against your source, and accepted changes are credited to you."
          }
        />

        <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
          {directEdit ? (
            <DirectDocEditor article={article} locale={locale} />
          ) : (
            <SuggestDocChangeForm article={article} reportMode={reportMode} />
          )}
        </div>
      </main>
    </div>
  )
}

/** Full block editor for wiki_editor / editorial_board roles — drafts
 * autosave via /api/contribute/wiki/[slug]; submitting finalizes for review;
 * approval publishes the change automatically. */
function DirectDocEditor({
  article,
  locale,
}: {
  readonly article: EditArticle
  readonly locale: string
}) {
  const [submissionId, setSubmissionId] = useState<number | undefined>()
  const [editSummary, setEditSummary] = useState("")

  async function handleFinalize() {
    if (!submissionId) return
    const res = await fetch(`/api/contribute/wiki/${article.slug}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    })
    if (!res.ok) throw new Error("Finalize failed")
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <WikiBlockEditor
          slug={article.slug}
          locale={locale}
          body={article.body}
          existingSubmissionId={submissionId}
          onSubmissionIdChange={setSubmissionId}
          editSummary={editSummary}
          onEditSummaryChange={setEditSummary}
        />
      </div>
      <aside>
        <WikiEditorSidebar
          submissionId={submissionId}
          onSubmit={handleFinalize}
        />
      </aside>
    </div>
  )
}

const REPORT_CATEGORIES = [
  "Incorrect or outdated information",
  "Broken formatting or links",
  "Missing information",
  "Wording or clarity",
  "Other",
] as const

/** Any signed-in contributor can suggest a change — recorded as a wiki_edit
 * submission and applied by a reviewer (mirrors the library correction flow). */
function SuggestDocChangeForm({
  article,
  reportMode,
}: {
  readonly article: EditArticle
  readonly reportMode: boolean
}) {
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0])
  const [proposal, setProposal] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!proposal.trim()) return
    setState("saving")
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "wiki_edit",
          targetEntityType: "wiki_article",
          targetSlug: article.slug,
          fields: { category, proposal: proposal.trim() },
          editSummary: `${reportMode ? "Issue report" : "Suggested change"}: ${category}`,
          evidenceUrl: evidenceUrl.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error("submit failed")
      setState("done")
    } catch {
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div
        className="mx-auto max-w-[640px] rounded-[20px] border p-8 text-center"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        <h2
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "26px",
            fontWeight: 500,
          }}
        >
          Sent for review
        </h2>
        <p className="mt-2 mb-0 text-[16px]" style={{ color: T.ink.dim }}>
          A reviewer will check your suggestion. You can follow its status from{" "}
          <GlobalLink
            href="/contribute"
            className="underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            your submissions
          </GlobalLink>
          .
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-[640px] flex-col gap-5 rounded-[20px] border p-7"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <label className="flex flex-col gap-1.5 text-[14px] font-medium">
        What needs changing?
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-[12px] border px-3.5 py-2.5 text-[15px] font-normal"
          style={{
            background: T.bg.deep,
            borderColor: T.border.hi,
            color: T.ink.base,
          }}
        >
          {REPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-medium">
        {reportMode ? "Describe the issue" : "Describe the change"}
        <span className="text-[13px] font-normal" style={{ color: T.ink.low }}>
          Quote the passage if you can, and say what it should be instead.
        </span>
        <textarea
          required
          rows={6}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          className="resize-y rounded-[12px] border px-3.5 py-2.5 text-[15px] leading-[1.55] font-normal"
          style={{
            background: T.bg.deep,
            borderColor: T.border.hi,
            color: T.ink.base,
          }}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[14px] font-medium">
        Source URL <span style={{ color: T.ink.low }}>· Recommended</span>
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://"
          className="rounded-[12px] border px-3.5 py-2.5 text-[15px] font-normal"
          style={{
            background: T.bg.deep,
            borderColor: T.border.hi,
            color: T.ink.base,
          }}
        />
      </label>

      {state === "error" ? (
        <p
          role="alert"
          className="m-0 text-[14px] font-semibold"
          style={{ color: T.accent.danger }}
        >
          Couldn&rsquo;t send — please try again.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-full px-6 py-2.5 text-[15px] font-semibold text-white transition-colors disabled:opacity-60"
          style={{ background: T.accent.primary }}
        >
          {state === "saving" ? "Sending…" : "Send for review"}
        </button>
        <GlobalLink
          href="/knowledge"
          className="text-[15px] underline underline-offset-[3px]"
          style={{ color: T.ink.dim }}
        >
          Cancel
        </GlobalLink>
      </div>
    </form>
  )
}
