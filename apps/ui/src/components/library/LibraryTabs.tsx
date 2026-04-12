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
  { id: "facilities", label: "Facilities" },
  { id: "contact", label: "Contact" },
] as const

export function LibraryTabNav({
  extraTabs,
}: {
  readonly extraTabs?: readonly { id: string; label: string }[]
}) {
  const { activeTab, setActiveTab } = useTabsContext()
  const tabs = extraTabs ? [...BASE_TABS, ...extraTabs] : BASE_TABS

  // Detect when the nav has become sticky so we can swap to a solid background.
  // The sentinel sits just above the nav at its natural (non-sticky) position;
  // when it scrolls off the top of the viewport the nav is stuck.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const io = new IntersectionObserver(
      ([entry]) => setIsStuck(entry.boundingClientRect.top < 0),
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
        className={cn(
          "sticky top-0 z-20 transition-colors duration-200",
          isStuck
            ? "border-b border-white/8 bg-[#050816]/95 backdrop-blur-md"
            : "border-b border-white/[0.07] bg-[#050816]/50 backdrop-blur-sm"
        )}
      >
        <Container>
          <nav
            role="tablist"
            aria-label="Library sections"
            className="flex items-center overflow-x-auto"
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
                  "relative shrink-0 px-5 py-3.5 text-sm font-medium transition-colors duration-150",
                  "after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[2px] after:transition-opacity after:duration-150",
                  activeTab === tab.id
                    ? "text-white after:bg-blue-400 after:opacity-100"
                    : "text-white/46 after:opacity-0 hover:text-white/70"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
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
