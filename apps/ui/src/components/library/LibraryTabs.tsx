"use client"

import { createContext, useContext, useMemo, useState } from "react"

import { StickySubNav } from "@/components/ds"
import { T } from "@/lib/design-tokens"

// ── Context ───────────────────────────────────────────────────────────────────

type TabsContextValue = {
  activeTab: string
  setActiveTab: (id: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx)
    throw new Error("Tab components must be used within LibraryTabsProvider")

  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function LibraryTabsProvider({
  children,
  defaultTab = "overview",
}: {
  readonly children: React.ReactNode
  readonly defaultTab?: string
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const contextValue = useMemo(() => ({ activeTab, setActiveTab }), [activeTab])

  return (
    <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const BASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "hours", label: "Hours" },
  { id: "visit", label: "Visit & Access" },
  { id: "collections", label: "Collections" },
  { id: "facilities", label: "Facilities" },
  { id: "contact", label: "Contact" },
  { id: "nearby", label: "Explore nearby" },
] as const

export function LibraryTabNav({
  extraTabs,
  lastVerifiedAt,
  entityRef,
}: {
  readonly extraTabs?: readonly { id: string; label: string }[]
  readonly lastVerifiedAt?: string | null
  readonly entityRef?: string | null
}) {
  const { activeTab, setActiveTab } = useTabsContext()
  const tabs = extraTabs ? [...BASE_TABS, ...extraTabs] : BASE_TABS

  // Format last-verified date
  const lastVerifiedLabel = lastVerifiedAt
    ? new Date(lastVerifiedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  const rightSlot =
    entityRef || lastVerifiedLabel ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          paddingLeft: "16px",
          whiteSpace: "nowrap",
        }}
      >
        {entityRef ? (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            {entityRef}
          </span>
        ) : null}
        {entityRef && lastVerifiedLabel ? (
          <span style={{ color: T.ink.faint, fontSize: "10px" }}>·</span>
        ) : null}
        {lastVerifiedLabel ? (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Verified {lastVerifiedLabel}
          </span>
        ) : null}
      </div>
    ) : null

  return (
    <StickySubNav
      tabs={[...tabs]}
      activeId={activeTab}
      onTabClick={setActiveTab}
      rightSlot={rightSlot}
    />
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function LibraryTabPanel({
  id,
  children,
}: {
  readonly id: string
  readonly children: React.ReactNode
}) {
  const { activeTab } = useTabsContext()

  return (
    // All panels are in the server-rendered HTML for SEO; hidden hides them visually
    <section
      id={`tab-${id}`}
      role="tabpanel"
      aria-label={id}
      hidden={activeTab !== id}
    >
      {children}
    </section>
  )
}
