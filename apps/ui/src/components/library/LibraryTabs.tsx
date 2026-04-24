"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

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

  // Detect when the nav has become sticky so we can swap to a solid background.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const io = new IntersectionObserver(
      ([entry]) => entry && setIsStuck(entry.boundingClientRect.top < 0),
      { threshold: [0] }
    )
    io.observe(sentinel)

    return () => io.disconnect()
  }, [])

  return (
    <>
      {/* Sentinel — placed at the natural position of the nav */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      <div
        className="sticky top-14 z-30 border-t border-b border-white/8 backdrop-blur-md transition-colors duration-200"
        style={{ background: isStuck ? "rgba(5,8,22,1)" : "rgba(5,8,22,.85)" }}
      >
        <Container>
          <div className="flex items-center">
            <nav
              role="tablist"
              aria-label="Library sections"
              className="flex items-center gap-6"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative shrink-0 py-4 text-[13px] whitespace-nowrap transition-colors duration-150",
                    "after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-[2px] after:transition-opacity after:duration-150",
                    activeTab === tab.id
                      ? "text-white after:bg-[#7fdfff] after:opacity-100"
                      : "text-white/50 after:opacity-0 hover:text-white/80"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Right side: last verified + entity ref */}
            {(lastVerifiedLabel ?? entityRef) ? (
              <div className="flex shrink-0 items-center gap-3 pl-6">
                {entityRef ? (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      letterSpacing: ".12em",
                      color: "rgba(255,255,255,.22)",
                    }}
                  >
                    {entityRef}
                  </span>
                ) : null}
                {entityRef && lastVerifiedLabel ? (
                  <span
                    style={{ color: "rgba(255,255,255,.12)", fontSize: "11px" }}
                  >
                    ·
                  </span>
                ) : null}
                {lastVerifiedLabel ? (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      letterSpacing: ".1em",
                      color: "rgba(255,255,255,.3)",
                      textTransform: "uppercase",
                    }}
                  >
                    Last verified {lastVerifiedLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </Container>
      </div>
    </>
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
