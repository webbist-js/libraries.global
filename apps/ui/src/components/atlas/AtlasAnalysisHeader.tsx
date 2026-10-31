"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { createContext, useContext } from "react"

import { OK } from "@/components/atlas/atlas-map.style"
import { Icon } from "@/components/atlas/atlas-ui"
import { T } from "@/lib/design-tokens"

export const AtlasAnalysisPanelContext = createContext(false)

export function AtlasAnalysisHeader({
  title,
  badge,
  description,
  collapsed,
  onCollapse,
  onClose,
  onSettings,
  badgeTone = "area",
}: {
  readonly title: string
  readonly badge: string
  readonly description: string
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly onClose: () => void
  readonly onSettings?: () => void
  readonly badgeTone?: "area" | "pin"
}) {
  const tUi = useUiTranslations("ui")
  const panel = useContext(AtlasAnalysisPanelContext)

  if (panel) return null

  return (
    <header
      className="flex shrink-0 flex-col gap-2 border-b px-5 py-4"
      style={{ borderColor: T.border.divider }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={
            badgeTone === "pin"
              ? { background: "var(--t-palette-mint-bg)", color: OK }
              : { background: T.accent.chip, color: T.accent.primary }
          }
        >
          {badgeTone === "area" ? <Icon name="layers" size={16} /> : null}
          {badge}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCollapse}
            aria-label={collapsed ? "Expand analysis" : "Collapse analysis"}
            aria-expanded={!collapsed}
            className="flex size-11 items-center justify-center rounded-full border"
            style={{ borderColor: T.border.divider }}
          >
            <Icon
              name="chevD"
              className={collapsed ? "" : "rotate-180"}
              size={18}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={tUi("close_analysis")}
            className="flex size-11 items-center justify-center rounded-full border"
            style={{ borderColor: T.border.divider }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>
      <h2 className="type-h2 m-0">{title}</h2>
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        {description}
      </p>
      {onSettings ? (
        <button
          type="button"
          onClick={onSettings}
          className="flex min-h-9 items-center gap-1.5 self-start text-sm font-semibold"
          style={{ color: T.accent.primary }}
        >
          <Icon name="settings" size={16} /> Layer settings
        </button>
      ) : null}
    </header>
  )
}
