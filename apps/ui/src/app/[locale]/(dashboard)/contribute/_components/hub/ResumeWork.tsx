"use client"

import { useTranslations } from "next-intl"

import { continueLink } from "@/app/[locale]/(dashboard)/contribute/submissions/_components/submissionContinue"
import { useMySubmissions } from "@/hooks/useSubmissions"
import { useCapabilities } from "@/lib/access-client"
import { isArticleEditor } from "@/lib/editor-gate"
import { Link } from "@/lib/navigation"

export function ResumeWork() {
  const t = useTranslations("workspaceDashboard"),
    ui = useTranslations("ui")
  const { data, isLoading, isError, refetch } = useMySubmissions()
  const { has } = useCapabilities()
  const work =
    data
      ?.filter(
        (item) => item.status === "draft" || item.status === "needs_info"
      )
      .slice(0, 3) ?? []
  if (isLoading || (!isError && !work.length)) return null

  return (
    <section className="workspace-card" aria-labelledby="resume-work-title">
      <h2 id="resume-work-title" className="type-panel-title">
        {t("resumeTitle")}
      </h2>
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
          {work.map((item) => {
            const next = continueLink(item, (kind) =>
              isArticleEditor(has, kind)
            )

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
                <h3 className="type-small-heading my-2">
                  {[
                    item.targetLabel,
                    item.draftData?.title,
                    item.fields?.libraryName,
                  ].find(
                    (value): value is string =>
                      typeof value === "string" && Boolean(value.trim())
                  ) ?? ui("your_record")}
                </h3>
                {item.reviewNote ? (
                  <p className="text-sm">{item.reviewNote}</p>
                ) : null}
                <Link
                  className="font-semibold text-(--t-accent-primary)"
                  href={next.href}
                >
                  {next.label} →
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
