"use client"

import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useRef, useState } from "react"

import {
  ACTION_GROUPS,
  ACTIONS,
  type ActionMeta,
} from "@/components/contribute/actions"
import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import type { LibrarySuggestion } from "@/components/contribute/LibraryPicker"
import {
  type ActionId,
  hubHref,
  parseHubParams,
} from "@/components/contribute/wizard.logic"
import { T } from "@/lib/design-tokens"

function RadioDot({ on }: { readonly on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full"
      style={
        on
          ? { background: T.accent.primary, color: "#fff" }
          : { border: `2px solid ${T.border.hi}`, background: T.bg.deep }
      }
    >
      {on ? <Icon height={15} icon="mdi:check-bold" width={15} /> : null}
    </span>
  )
}

function ActionIcon({ action }: { readonly action: ActionMeta }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full"
      style={{ background: action.tintBg, color: action.tintFg }}
    >
      <Icon height={20} icon={action.icon} width={20} />
    </span>
  )
}

function Minutes({ minutes }: { readonly minutes: number }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[14px]"
      style={{ color: T.ink.dim }}
    >
      <Icon
        aria-hidden="true"
        height={15}
        icon="mdi:clock-outline"
        width={15}
      />
      About {minutes} minutes
    </span>
  )
}

const cardTitle: React.CSSProperties = {
  fontFamily: T.font.serif,
  fontWeight: 500,
  lineHeight: 1.15,
  letterSpacing: "-0.01em",
  color: T.ink.base,
}

/**
 * "What would you like to do?": quick index edits and longer written pieces
 * as two groups of cards (one radio group), with the chosen action's
 * three-step form in a panel below. `?action=&library=&name=` (see hubHref)
 * opens it with a library already chosen, at step 2.
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
  const radios = useRef<Partial<Record<ActionId, HTMLButtonElement | null>>>({})
  // The prefilled library only applies to the action it came with.
  const library = selected === prefill.action ? prefill.library : null

  // Arrow keys move through every action, across both groups.
  const onKeyDown = (e: React.KeyboardEvent, id: ActionId) => {
    const delta =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0
    if (!delta) return
    e.preventDefault()
    const index = ACTIONS.findIndex((a) => a.id === id)
    const next = ACTIONS[(index + delta + ACTIONS.length) % ACTIONS.length]!
    setSelected(next.id)
    radios.current[next.id]?.focus()
  }

  const radioProps = (action: ActionMeta) => {
    const on = action.id === selected

    return {
      ref: (el: HTMLButtonElement | null) => {
        radios.current[action.id] = el
      },
      "aria-checked": on,
      onClick: () => setSelected(action.id),
      onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, action.id),
      role: "radio" as const,
      tabIndex: on ? 0 : -1,
      type: "button" as const,
      style: {
        border: on
          ? `2px solid ${T.accent.primary}`
          : `1px solid ${T.border.line}`,
        // Keep content aligned whichever border width applies.
        margin: on ? 0 : 1,
        background: on ? "#F7F6FE" : T.bg.deep,
      },
    }
  }

  return (
    <div className="flex scroll-mt-24 flex-col gap-6" id="start">
      <div
        aria-label="What would you like to do?"
        className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]"
        role="radiogroup"
      >
        {ACTION_GROUPS.map((group) => {
          const actions = ACTIONS.filter((a) => a.group === group.id)
          const headingId = `hub-group-${group.id}`

          return (
            <div
              key={group.id}
              aria-labelledby={headingId}
              className="flex flex-col gap-3 rounded-[24px] p-4 sm:p-5"
              role="group"
              style={{ background: T.bg.space }}
            >
              <p
                className="m-0 flex flex-wrap items-center gap-x-2 px-1 text-[16px]"
                id={headingId}
              >
                <Icon
                  aria-hidden="true"
                  height={17}
                  icon={group.icon}
                  style={{ color: T.accent.primary }}
                  width={17}
                />
                <span className="font-semibold" style={{ color: T.ink.base }}>
                  {group.title}
                </span>
                <span style={{ color: T.ink.dim }}>{group.subtitle}</span>
              </p>

              {group.id === "index" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      {...radioProps(action)}
                      className="flex h-full flex-col items-start gap-3 rounded-[20px] p-5 text-left transition-colors hover:border-(--t-accent-primary)"
                    >
                      <span className="flex w-full items-start justify-between">
                        <ActionIcon action={action} />
                        <RadioDot on={action.id === selected} />
                      </span>
                      <span className="text-[22px]" style={cardTitle}>
                        {action.title}
                      </span>
                      <span
                        className="flex-1 text-[15px] leading-[1.5]"
                        style={{ color: T.ink.dim }}
                      >
                        {action.description}
                      </span>
                      <Minutes minutes={action.minutes} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-3">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      {...radioProps(action)}
                      className="flex flex-1 items-start gap-4 rounded-[20px] p-5 text-left transition-colors hover:border-(--t-accent-primary)"
                    >
                      <ActionIcon action={action} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[22px]" style={cardTitle}>
                          {action.title}
                        </span>
                        <span
                          className="text-[15px] leading-[1.5]"
                          style={{ color: T.ink.dim }}
                        >
                          {action.description}
                        </span>
                        <span className="mt-1">
                          <Minutes minutes={action.minutes} />
                        </span>
                      </span>
                      <RadioDot on={action.id === selected} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <section aria-labelledby="hub-wizard-title">
        <ContributionWizard
          key={`${selected}:${library?.slug ?? ""}`}
          action={selected}
          headingId="hub-wizard-title"
          initialCategory={library ? prefill.category : null}
          initialLibrary={library}
          layout="panel"
          publishedCount={publishedCount}
          returnTo={(chosen) => hubHref(selected, chosen ?? undefined)}
          suggestions={suggestions}
        />
      </section>
    </div>
  )
}
