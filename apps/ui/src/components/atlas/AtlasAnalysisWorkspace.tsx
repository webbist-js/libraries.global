"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"

import { AtlasAnalysisHeader } from "@/components/atlas/AtlasAnalysisHeader"
import { T } from "@/lib/design-tokens"

export type AnalysisTab = "overview" | "explore" | "compare" | "data"
export const ANALYSIS_TABS: { id: AnalysisTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "explore", label: "Explore" },
  { id: "compare", label: "Compare" },
  { id: "data", label: "Data" },
]

/** Keep task navigation visible, with results before the supporting settings. */
export function AtlasAnalysisWorkspace({
  title,
  badge,
  description,
  collapsed,
  onCollapse,
  onClose,
  onSettings,
  tab,
  onTab,
  tabs = ANALYSIS_TABS,
  context,
  lead,
  footer,
  children,
}: {
  readonly title: string
  readonly badge: string
  readonly description: string
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly onClose: () => void
  readonly onSettings?: () => void
  readonly tab: AnalysisTab
  readonly onTab: (tab: AnalysisTab) => void
  readonly tabs?: readonly { id: AnalysisTab; label: string }[]
  readonly lead?: ReactNode
  readonly context?: ReactNode
  readonly footer?: ReactNode
  readonly children: ReactNode
}) {
  const id = useId(),
    content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0
  }, [tab])

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-clip"
      style={{ color: T.ink.base }}
    >
      <AtlasAnalysisHeader
        {...{
          title,
          badge,
          description,
          collapsed,
          onCollapse,
          onClose,
          onSettings,
        }}
      />
      {!collapsed ? (
        <>
          <div
            role="tablist"
            aria-label={`${title} analysis`}
            className="grid shrink-0 grid-cols-4 border-b px-5"
            style={{
              borderColor: T.border.divider,
              gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
            }}
          >
            {tabs.map((item, index) => (
              <button
                key={item.id}
                id={`${id}-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`${id}-content`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => onTab(item.id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : null
                  if (next === null) return
                  event.preventDefault()
                  onTab(tabs[next]!.id)
                  document.getElementById(`${id}-${tabs[next]!.id}`)?.focus()
                }}
                className="min-h-12 border-b-2 px-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--t-accent-primary)"
                style={{
                  borderColor:
                    tab === item.id ? T.accent.primary : "transparent",
                  color: tab === item.id ? T.accent.primary : T.ink.dim,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            ref={content}
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-5 [&>*]:shrink-0"
          >
            <div
              id={`${id}-content`}
              role="tabpanel"
              aria-labelledby={`${id}-${tab}`}
              tabIndex={0}
              className="flex flex-col gap-5 focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
            >
              {lead}
              {children}
            </div>
            {context ? <div className="text-sm">{context}</div> : null}
          </div>
          {footer ? (
            <footer
              className="shrink-0 border-t px-5 py-2"
              style={{ borderColor: T.border.divider }}
            >
              {footer}
            </footer>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
