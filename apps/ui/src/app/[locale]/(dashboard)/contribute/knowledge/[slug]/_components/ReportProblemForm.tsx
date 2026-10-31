"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { T } from "@/lib/design-tokens"
import { editorApplyHref } from "@/lib/editor-gate"
import { Link } from "@/lib/navigation"

const CATEGORIES = [
  "Incorrect or outdated information",
  "Broken formatting or links",
  "Missing information",
  "Wording or clarity",
  "Other",
] as const

const input: React.CSSProperties = {
  padding: "12px 16px",
  minHeight: 48,
  borderRadius: 14,
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: "var(--type-body-size)",
  fontFamily: T.font.sans,
  width: "100%",
  boxSizing: "border-box",
}

/**
 * "Report a problem" on a Knowledge article: a short suggestion a reviewer
 * applies by hand. Open to every signed-in user. Knowledge editors can make
 * the change themselves in the article editor; everyone else is pointed to
 * the editor role application.
 */
export function ReportProblemForm({
  slug,
  title,
  editHref,
  canEdit,
  contentLocale,
}: {
  readonly slug: string
  readonly title: string
  readonly editHref: string
  /** The viewer holds the Knowledge editor role (`docs.directEdit`). */
  readonly canEdit: boolean
  readonly contentLocale?: string
}) {
  const tUi = useUiTranslations("ui")

  const [category, setCategory] = useState<string>(CATEGORIES[0])
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
          targetSlug: slug,
          ...(contentLocale ? { locale: contentLocale } : {}),
          fields: { category, proposal: proposal.trim() },
          editSummary: `Issue report: ${category}`,
          evidenceUrl: evidenceUrl.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error("submit failed")
      setState("done")
    } catch {
      setState("error")
    }
  }

  const card = "mx-auto max-w-[680px] rounded-[24px] p-7 sm:p-8"
  const cardStyle = {
    background: T.bg.deep,
    border: `1px solid ${T.border.line}`,
  }

  if (state === "done")
    return (
      <div className={`${card} text-center`} style={cardStyle}>
        <h2 className="type-h2 m-0">{tUi("sent_for_review")}</h2>
        <p className="mt-2 mb-0 text-base" style={{ color: T.ink.dim }}>
          A reviewer will check your report. Follow it in{" "}
          <Link
            href="/contribute/submissions"
            className="underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            {tUi("my_submissions")}{" "}
          </Link>
          .
        </p>
      </div>
    )

  return (
    <form
      onSubmit={handleSubmit}
      className={`${card} flex flex-col gap-5`}
      style={cardStyle}
    >
      <p className="m-0 text-base" style={{ color: T.ink.dim }}>
        Reporting a problem in{" "}
        <strong style={{ color: T.ink.base }}>{title}</strong>.{" "}
        {canEdit ? (
          <>
            Prefer to fix it yourself?{" "}
            <Link
              href={editHref}
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Open it in the editor
            </Link>
            .
          </>
        ) : (
          <>
            Want to edit pages yourself?{" "}
            <Link
              href={editorApplyHref("knowledge")}
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Apply to be a Knowledge editor
            </Link>
            .
          </>
        )}
      </p>
      <label className="flex flex-col gap-2 text-base font-semibold">
        What needs changing?
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={input}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-base font-semibold">
        Describe the issue
        <span className="text-sm font-normal" style={{ color: T.ink.dim }}>
          Quote the passage if you can, and say what it should be instead.
        </span>
        <textarea
          required
          rows={6}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
        />
      </label>
      <label className="flex flex-col gap-2 text-base font-semibold">
        {tUi("source_url")}{" "}
        <span className="font-normal" style={{ color: T.ink.dim }}>
          · Recommended
        </span>
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://"
          style={input}
        />
      </label>
      {state === "error" && (
        <p
          role="alert"
          className="m-0 text-sm font-semibold"
          style={{ color: T.accent.danger }}
        >
          Couldn’t send — please try again.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-full px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-(--t-action-primary-hover) disabled:opacity-60"
          style={{
            background: T.action.primary,
            border: "none",
            cursor: "pointer",
            fontFamily: T.font.sans,
          }}
        >
          {state === "saving" ? tUi("sending") : "Send for review"}
        </button>
        <Link
          href="/knowledge"
          className="text-base underline underline-offset-[3px]"
          style={{ color: T.ink.dim }}
        >
          {tUi("cancel")}{" "}
        </Link>
      </div>
    </form>
  )
}
