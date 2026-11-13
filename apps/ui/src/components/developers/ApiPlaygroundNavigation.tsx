"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import {
  createContext,
  useId,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { useOptionalDashboardOverlay } from "@/components/dashboard/DashboardFrame"
import { createPlaygroundOperations } from "@/components/developers/playground-operations"
import type { PlaygroundOperation } from "@/lib/team-api/playground"

type PlaygroundNavigationState = {
  operation: PlaygroundOperation
  setOperation: Dispatch<SetStateAction<PlaygroundOperation>>
  pending: boolean
  setPending: Dispatch<SetStateAction<boolean>>
  selectionVersion: number
  selectOperation: (operation: PlaygroundOperation) => void
  sidebar: boolean
}
const PlaygroundNavigationContext =
  createContext<PlaygroundNavigationState | null>(null)

export function useApiPlaygroundNavigation() {
  return useContext(PlaygroundNavigationContext)
}

export function ApiPlaygroundNavigationProvider({
  children,
  sidebar = false,
}: {
  readonly children: ReactNode
  readonly sidebar?: boolean
}) {
  const [operation, setOperation] = useState<PlaygroundOperation>("search")
  const [pending, setPending] = useState(false)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const value = useMemo(
    () => ({
      operation,
      setOperation,
      pending,
      setPending,
      selectionVersion,
      sidebar,
      selectOperation(next: PlaygroundOperation) {
        if (pending || next === operation) return
        setOperation(next)
        setSelectionVersion((version) => version + 1)
      },
    }),
    [operation, pending, selectionVersion, sidebar]
  )

  return (
    <PlaygroundNavigationContext value={value}>
      {children}
    </PlaygroundNavigationContext>
  )
}

/** Request navigation shares state with the form without remounting it. */
export function ApiPlaygroundNavigation() {
  const PLAYGROUND_OPERATIONS = createPlaygroundOperations(
    useTranslations("playgroundOperations")
  )
  const tStatic = useTranslations("staticUi")
  const GROUPS: {
    id: string
    label: string
    operations: readonly PlaygroundOperation[]
  }[] = [
    {
      id: "libraries",
      label: tStatic("frontendExtra.libraries"),
      operations: ["search", "list", "read"],
    },
    {
      id: "places",
      label: tStatic("frontendExtra.places"),
      operations: ["places", "placeLibraries"],
    },
    {
      id: "services",
      label: tStatic("frontendExtra.services"),
      operations: ["services", "service", "serviceLibraries"],
    },
    {
      id: "analysis",
      label: tStatic("frontendExtra.analysis"),
      operations: ["summary", "reach", "job", "jobResult"],
    },
    {
      id: "submissions",
      label: tStatic("frontendExtra.submissions"),
      operations: ["proposal"],
    },
  ]

  const state = useApiPlaygroundNavigation()
  const overlay = useOptionalDashboardOverlay()
  const groupId = useId()
  const operation = state?.operation
  const [previousOperation, setPreviousOperation] = useState(operation)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        GROUPS.filter(
          (group) => operation && group.operations.includes(operation)
        ).map((group) => group.id)
      )
  )
  if (previousOperation !== operation) {
    setPreviousOperation(operation)
    const activeGroup = GROUPS.find(
      (group) => operation && group.operations.includes(operation)
    )
    if (activeGroup)
      setExpanded((current) => new Set([...current, activeGroup.id]))
  }
  if (!state) return null

  return (
    <section
      aria-label={tStatic("frontendExtra.playground_requests")}
      className="mx-3 mt-4 border-t border-(--t-border-line) pt-4 pb-5"
    >
      <h2 className="type-small-heading m-0 px-3">
        {tStatic("frontendExtra.requests")}
      </h2>
      <p className="mt-1 mb-4 px-3 text-xs leading-relaxed text-(--t-ink-dim)">
        {tStatic("frontendExtra.choose_an_endpoint_to_configure_a_request")}
      </p>
      <fieldset
        disabled={state.pending}
        className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0"
      >
        <legend className="sr-only">{tStatic("common.requestType")}</legend>
        {GROUPS.map((group) => (
          <div key={group.id} className="min-w-0">
            <h3 className="type-label m-0">
              <button
                type="button"
                aria-expanded={expanded.has(group.id)}
                aria-controls={`${groupId}-${group.id}`}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current)
                    if (next.has(group.id)) next.delete(group.id)
                    else next.add(group.id)

                    return next
                  })
                }
                className={
                  "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-(--t-bg-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) " +
                  (group.operations.includes(state.operation)
                    ? "text-(--t-accent-primary)"
                    : "text-(--t-ink-dim)")
                }
              >
                <Icon
                  aria-hidden
                  icon={
                    expanded.has(group.id)
                      ? "mdi:chevron-down"
                      : "mdi:chevron-right"
                  }
                  width={18}
                />
                <span className="flex-1">{group.label}</span>
                <span className="text-xs font-normal tabular-nums">
                  {group.operations.length}
                </span>
              </button>
            </h3>
            <div id={`${groupId}-${group.id}`} hidden={!expanded.has(group.id)}>
              <div className="mb-2 flex flex-col gap-1">
                {PLAYGROUND_OPERATIONS.filter((item) =>
                  group.operations.includes(item.id)
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={state.operation === item.id}
                    onClick={() => {
                      state.selectOperation(item.id)
                      overlay?.handleClose()
                    }}
                    className={
                      "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) disabled:cursor-wait disabled:opacity-60 " +
                      (state.operation === item.id
                        ? "bg-(--t-accent-chip) font-semibold text-(--t-accent-primary)"
                        : "text-(--t-ink-base) hover:bg-(--t-bg-muted)")
                    }
                  >
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <span
                      translate="no"
                      className="shrink-0 font-mono text-[10px] text-(--t-ink-dim)"
                    >
                      {item.method}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </fieldset>
    </section>
  )
}
