"use client"

import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useRef, useState } from "react"

import { ACTIONS } from "@/components/contribute/actions"
import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import type { LibrarySuggestion } from "@/components/contribute/LibraryPicker"
import {
  type ActionId,
  hubHref,
  parseHubParams,
} from "@/components/contribute/wizard.logic"
import { T } from "@/lib/design-tokens"

/**
 * "What would you like to do?": the actions as a radio group on the left,
 * the matching three-step form on the right. `?action=&library=&name=`
 * (see hubHref) opens it with a library already chosen, at step 2.
 */
export function HubActionChooser({
  publishedCount,
  suggestions = [],
}: {
  readonly publishedCount: number
  readonly suggestions?: readonly LibrarySuggestion[]
}) {
  const params = useSearchParams()
  const prefill = parseHubParams(params)
  const prefillKey = params.toString()
  const [selected, setSelected] = useState<ActionId>(
    prefill.action ?? "correction"
  )
  // A link on this page (e.g. "Help fill this in") can set a new prefill.
  const [seenKey, setSeenKey] = useState(prefillKey)
  if (seenKey !== prefillKey) {
    setSeenKey(prefillKey)
    if (prefill.action) setSelected(prefill.action)
  }
  const radios = useRef<(HTMLButtonElement | null)[]>([])
  // The prefilled library only applies to the action it came with.
  const library = selected === prefill.action ? prefill.library : null

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const delta =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + ACTIONS.length) % ACTIONS.length
    setSelected(ACTIONS[next]!.id)
    radios.current[next]?.focus()
  }

  return (
    <div
      className="grid scroll-mt-24 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]"
      id="start"
    >
      <div
        aria-label="What would you like to do?"
        className="flex flex-col gap-3"
        role="radiogroup"
      >
        {ACTIONS.map((action, i) => {
          const on = action.id === selected

          return (
            <button
              key={action.id}
              ref={(el) => {
                radios.current[i] = el
              }}
              aria-checked={on}
              className="flex items-start gap-4 rounded-[20px] bg-white p-5 text-left transition-colors hover:border-(--t-accent-primary)"
              onClick={() => setSelected(action.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              role="radio"
              style={{
                border: on
                  ? `2px solid ${T.accent.primary}`
                  : `1px solid ${T.border.line}`,
                // Keep content aligned whichever border width applies.
                padding: on ? 19 : 20,
                background: on ? "#F7F6FE" : T.bg.deep,
              }}
              tabIndex={on ? 0 : -1}
              type="button"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: action.tintBg, color: action.tintFg }}
              >
                <Icon height={20} icon={action.icon} width={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className="text-[21px] leading-tight"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {action.title}
                </span>
                <span
                  className="text-[15px] leading-[1.5]"
                  style={{ color: T.ink.dim }}
                >
                  {action.description}
                </span>
                <span
                  className="mt-1 flex items-center gap-1.5 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  <Icon
                    aria-hidden="true"
                    height={15}
                    icon="mdi:clock-outline"
                    width={15}
                  />
                  About {action.minutes} minutes
                  {action.note ? ` · ${action.note}` : null}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full"
                style={
                  on
                    ? { background: T.accent.primary, color: "#fff" }
                    : { border: `2px solid ${T.border.hi}` }
                }
              >
                {on ? (
                  <Icon height={15} icon="mdi:check-bold" width={15} />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      <section
        aria-labelledby="hub-wizard-title"
        className="rounded-[24px] border bg-white p-6 sm:p-8 lg:p-10"
        style={{ borderColor: T.border.line }}
      >
        <ContributionWizard
          key={`${selected}:${library?.slug ?? ""}`}
          action={selected}
          headingId="hub-wizard-title"
          initialCategory={library ? prefill.category : null}
          initialLibrary={library}
          publishedCount={publishedCount}
          returnTo={(chosen) => hubHref(selected, chosen ?? undefined)}
          suggestions={suggestions}
        />
      </section>
    </div>
  )
}
