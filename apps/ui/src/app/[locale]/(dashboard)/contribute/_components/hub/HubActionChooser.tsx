"use client"

import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import {
  ACTION_GROUPS,
  ACTIONS,
  actionFor,
} from "@/components/contribute/actions"
import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import type { LibrarySuggestion } from "@/components/contribute/LibraryPicker"
import {
  type ActionId,
  hubHref,
  parseHubParams,
} from "@/components/contribute/wizard.logic"
import { Button } from "@/components/ui/button"
import { useCapabilities } from "@/lib/access-client"
import { Link } from "@/lib/navigation"

/** Compact action groups; full editors open directly and quick edits expand in place. */
export function HubActionChooser({
  publishedCount,
  suggestions = [],
}: {
  readonly publishedCount: number
  readonly suggestions?: readonly LibrarySuggestion[]
}) {
  const t = useTranslations("workspaceDashboard")
  const editor = useRef<HTMLElement>(null)
  const params = useSearchParams(),
    prefill = parseHubParams(params),
    prefillKey = params.toString()
  const { has } = useCapabilities()
  const [selected, setSelected] = useState<ActionId | null>(prefill.action)
  const [seenKey, setSeenKey] = useState(prefillKey)
  if (seenKey !== prefillKey) {
    setSeenKey(prefillKey)
    setSelected(prefill.action)
  }
  const library = selected === prefill.action ? prefill.library : null
  useEffect(() => {
    if (!selected || !editor.current) return
    editor.current.scrollIntoView({ block: "start", behavior: "instant" })
    editor.current.focus({ preventScroll: true })
  }, [selected, library?.slug])

  return (
    <div
      id="start"
      tabIndex={-1}
      className="hub-action-chooser scroll-mt-6 outline-none"
    >
      <div className="hub-action-groups">
        {ACTION_GROUPS.map((group) => (
          <section
            key={group.id}
            className="workspace-card"
            aria-labelledby={`hub-group-${group.id}`}
          >
            <h3
              id={`hub-group-${group.id}`}
              className="type-small-heading flex items-center gap-2"
            >
              <Icon icon={group.icon} width={18} aria-hidden />
              {group.title}
            </h3>
            <p className="mb-4 text-sm">{group.subtitle}</p>
            <div className="grid gap-2">
              {ACTIONS.filter((action) => action.group === group.id).map(
                (action) => {
                  const meta = actionFor(action.id, has)
                  const content = (
                    <>
                      <span
                        className="hub-action-icon"
                        style={{ background: meta.tintBg, color: meta.tintFg }}
                      >
                        <Icon icon={meta.icon} width={20} aria-hidden />
                      </span>
                      <span>
                        <strong>{meta.title}</strong>
                        <small>{meta.description}</small>
                      </span>
                      <span aria-hidden>→</span>
                    </>
                  )

                  return meta.handoff ? (
                    <Link
                      key={meta.id}
                      className="hub-action-option"
                      href={meta.handoff.href}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={meta.id}
                      type="button"
                      id={`hub-action-${meta.id}`}
                      className="hub-action-option"
                      aria-expanded={selected === meta.id}
                      aria-controls="hub-action-editor"
                      onClick={() => setSelected(meta.id)}
                    >
                      {content}
                    </button>
                  )
                }
              )}
            </div>
          </section>
        ))}
      </div>
      {selected ? (
        <section
          ref={editor}
          id="hub-action-editor"
          tabIndex={-1}
          className="mt-5 scroll-mt-6 outline-none"
          aria-labelledby="hub-wizard-title"
        >
          <div className="mb-4 flex justify-end">
            <Button
              variant="surface"
              size="pill"
              onClick={() => {
                ;(
                  document.getElementById(`hub-action-${selected}`) ??
                  document.getElementById("start")
                )?.focus()
                setSelected(null)
              }}
            >
              {t("closeEditor")}
            </Button>
          </div>
          <ContributionWizard
            key={`${selected}:${library?.slug ?? ""}`}
            action={selected}
            headingId="hub-wizard-title"
            initialCategory={library ? prefill.category : null}
            initialLibrary={library}
            layout="stacked"
            publishedCount={publishedCount}
            returnTo={(chosen) => hubHref(selected, chosen ?? undefined)}
            suggestions={suggestions}
          />
        </section>
      ) : null}
    </div>
  )
}
