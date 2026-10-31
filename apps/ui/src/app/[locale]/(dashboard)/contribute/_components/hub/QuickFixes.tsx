"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import { hubHref } from "@/components/contribute/wizard.logic"
import { Button } from "@/components/ui/button"

import type { IncompleteRecord } from "./RecordsThatNeedYou"

/** Opportunities use the production structured editors, source validation and draft storage. */
export function QuickFixes({
  records,
}: {
  readonly records: readonly IncompleteRecord[]
}) {
  const t = useTranslations("workspaceDashboard")
  const [skipped, setSkipped] = useState<string[]>([])
  const [selected, setSelected] = useState<IncompleteRecord | null>(null)
  const editor = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const selectedAction = selected?.missing.every((field) => field === "Photo")
    ? "photo"
    : "correction"
  useEffect(() => {
    if (!selected || !editor.current) return
    editor.current.scrollIntoView({ block: "start", behavior: "instant" })
    editor.current.focus({ preventScroll: true })
  }, [selected])
  const visible = records
    .filter((record) => !skipped.includes(record.documentId))
    .slice(0, 2)
  if (!records.length) return null

  return (
    <section
      className="workspace-card contribute-quick-fixes"
      aria-labelledby="quick-fixes-title"
    >
      <header className="contribute-quick-intro">
        <h2 id="quick-fixes-title" className="type-panel-title">
          {t("quickTitle")}
        </h2>
        <p className="text-sm">{t("quickBody")}</p>
      </header>
      <div
        ref={list}
        tabIndex={-1}
        className="contribute-quick-records"
        aria-live="polite"
      >
        {visible.map((record) => (
          <article key={record.documentId} className="contribute-quick-record">
            <header>
              <h3 className="type-small-heading">{record.name}</h3>
              <p>{record.place}</p>
            </header>
            <p>{t("missing", { fields: record.missing.join(", ") })}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                id={`quick-fix-${record.documentId}`}
                aria-controls="quick-fix-editor"
                variant="primary"
                size="pill"
                onClick={() => setSelected(record)}
                aria-expanded={selected?.documentId === record.documentId}
              >
                {t("helpRecord")}
              </Button>
              <Button
                variant="surface"
                size="pill"
                onClick={() => {
                  setSkipped((ids) => [...ids, record.documentId])
                  if (selected?.documentId === record.documentId)
                    setSelected(null)
                  requestAnimationFrame(() => {
                    const next =
                      list.current?.querySelector<HTMLElement>("button")
                    ;(next ?? list.current)?.focus()
                  })
                }}
              >
                {t("skip")}
              </Button>
            </div>
          </article>
        ))}
        {!visible.length ? (
          <div className="contribute-quick-empty">
            <p role="status">{t("emptyFixes")}</p>
            <Button
              variant="surface"
              size="pill"
              onClick={() => setSkipped([])}
            >
              {t("showSkipped")}
            </Button>
          </div>
        ) : null}
      </div>
      {selected ? (
        <div
          ref={editor}
          id="quick-fix-editor"
          tabIndex={-1}
          className="mt-5 scroll-mt-6 border-t border-(--t-border-line) pt-5 outline-none"
        >
          <div className="mb-4 flex justify-end">
            <Button
              variant="surface"
              size="pill"
              onClick={() => {
                document
                  .getElementById(`quick-fix-${selected.documentId}`)
                  ?.focus()
                setSelected(null)
              }}
            >
              {t("closeEditor")}
            </Button>
          </div>
          <ContributionWizard
            key={selected.documentId}
            action={selectedAction}
            initialLibrary={selected}
            initialCategory={
              selected.missing.find((field) => field !== "Photo") ?? null
            }
            returnTo={(library) => hubHref(selectedAction, library ?? selected)}
            layout="stacked"
          />
        </div>
      ) : null}
    </section>
  )
}
