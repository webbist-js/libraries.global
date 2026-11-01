"use client"

import { QueryClientContext } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useContext, useState } from "react"

import { continueLink } from "@/app/[locale]/(dashboard)/contribute/submissions/_components/submissionContinue"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useMySubmissions } from "@/hooks/useSubmissions"
import { useCapabilities } from "@/lib/access-client"
import { isArticleEditor } from "@/lib/editor-gate"
import { Link } from "@/lib/navigation"

export function ResumeWork({
  compact = false,
  prompt = false,
  onNavigate,
}: {
  compact?: boolean
  prompt?: boolean
  onNavigate?: () => void
}) {
  const t = useTranslations("workspaceDashboard"),
    ui = useTranslations("ui")
  const { data, isLoading, isError, refetch } = useMySubmissions()
  const { has } = useCapabilities()
  const client = useContext(QueryClientContext)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const work =
    data
      ?.filter(
        (item) => item.status === "draft" || item.status === "needs_info"
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3) ?? []
  const signature = JSON.stringify(
    work.map((item) => [item.documentId, item.updatedAt])
  )
  const promptKey = ["contribute-resume-dismissed", signature]
  const dismiss = () => {
    setDismissed(signature)
    client?.setQueryData(promptKey, true)
  }
  const links = work.map((item) => {
    const next = continueLink(item, (kind) => isArticleEditor(has, kind))
    const label =
      [
        item.targetLabel,
        item.draftData?.name,
        item.draftData?.title,
        item.fields?.name,
        item.fields?.libraryName,
      ].find(
        (value): value is string =>
          typeof value === "string" && Boolean(value.trim())
      ) ?? ui("your_record")

    return { item, next, label }
  })
  if (isLoading || (!isError && !work.length)) return null

  return (
    <>
      {prompt && !isError && work.length > 0 ? (
        <Dialog
          open={dismissed !== signature && !client?.getQueryData(promptKey)}
          onOpenChange={(open) => {
            if (!open) dismiss()
          }}
        >
          <DialogContent>
            <DialogTitle>{t("resumeTitle")}</DialogTitle>
            <DialogDescription>{t("resumePromptBody")}</DialogDescription>
            <ul className="m-0 grid list-none gap-3 p-0">
              {links.map(({ item, next, label }) => (
                <li key={item.documentId}>
                  <Link
                    className="block min-h-11 rounded-xl border p-3 font-semibold"
                    href={next.href}
                    onClick={dismiss}
                  >
                    {label} · {next.label} →
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="min-h-11 underline"
              onClick={dismiss}
            >
              {t("dismissResume")}
            </button>
          </DialogContent>
        </Dialog>
      ) : null}
      <section
        className={compact ? "contribute-recent" : "workspace-card"}
        aria-label={t("resumeTitle")}
      >
        <h2 className="type-panel-title">{t("resumeTitle")}</h2>
        <p className="text-sm">{t("resumeBody")}</p>
        {isError ? (
          <div role="status">
            <p className="text-sm">{t("resumeUnavailable")}</p>
            <button
              type="button"
              className="workspace-retry"
              onClick={() => void refetch()}
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {links.map(({ item, next, label }) => {
              return (
                <li
                  key={item.documentId}
                  className="rounded-xl border border-(--t-border-line) p-4"
                >
                  <p className="m-0 text-sm">
                    {item.status === "needs_info"
                      ? ui("changes_requested")
                      : ui("draft")}
                  </p>
                  <h3 className="type-small-heading my-2">{label}</h3>
                  {item.reviewNote ? (
                    <p className="text-sm">{item.reviewNote}</p>
                  ) : null}
                  <Link
                    className="font-semibold text-(--t-accent-primary)"
                    onClick={onNavigate}
                    href={next.href}
                  >
                    {next.label} →
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {!compact ? (
          <Link
            href="/contribute/submissions"
            onClick={onNavigate}
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary)"
          >
            {ui("my_submissions")}
          </Link>
        ) : null}
      </section>
    </>
  )
}
