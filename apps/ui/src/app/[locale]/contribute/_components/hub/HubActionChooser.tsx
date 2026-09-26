"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { SearchField } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

type ActionId = "add" | "correction" | "photo" | "source"

const ACTIONS: {
  id: ActionId
  icon: string
  tintBg: string
  tintFg: string
  title: string
  description: string
  minutes: number
}[] = [
  {
    id: "add",
    icon: "mdi:plus",
    tintBg: "#F5EEDC",
    tintFg: "#6B5420",
    title: "Add a missing library",
    description:
      "A library that isn't in the index yet, anywhere in the world.",
    minutes: 5,
  },
  {
    id: "correction",
    icon: "mdi:pencil-outline",
    tintBg: "var(--t-accent-chip)",
    tintFg: "var(--t-accent-primary)",
    title: "Suggest a correction",
    description:
      "Opening hours, address, accessibility or anything out of date.",
    minutes: 2,
  },
  {
    id: "photo",
    icon: "mdi:camera-outline",
    tintBg: "var(--t-bg-muted)",
    tintFg: "#55536A",
    title: "Share a photo",
    description:
      "A photo you took or have permission to share under an open licence.",
    minutes: 3,
  },
  {
    id: "source",
    icon: "mdi:link-variant",
    tintBg: "var(--tint-national-bg)",
    tintFg: "var(--tint-national-fg)",
    title: "Add a source",
    description: "A reference that backs up details already in a record.",
    minutes: 2,
  },
]

type LibraryResult = {
  documentId: string
  slug: string
  name: string
  city?: string | null
}

function useDebounce<V>(value: V, delay: number): V {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function StepChip({
  n,
  label,
  active,
}: {
  n: number
  label: string
  active: boolean
}) {
  return (
    <div
      className="flex flex-1 items-center gap-2.5 rounded-[12px] px-4 py-2.5"
      style={{
        background: active ? "var(--t-accent-chip)" : T.bg.surface,
        border: `1px solid ${active ? "transparent" : T.border.line}`,
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
        style={
          active
            ? { background: T.accent.primary, color: "#fff" }
            : {
                background: T.bg.deep,
                color: T.ink.dim,
                border: `1px solid ${T.border.line}`,
              }
        }
      >
        {n}
      </span>
      <span
        className="text-[15px] font-semibold"
        style={{ color: active ? T.accent.primaryHover : T.ink.dim }}
      >
        {label}
      </span>
    </div>
  )
}

export function HubActionChooser({
  publishedCount,
}: {
  readonly publishedCount: number
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<ActionId>("correction")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LibraryResult[]>([])
  const [chosen, setChosen] = useState<LibraryResult | null>(null)
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(query, 250)

  useEffect(() => {
    let cancelled = false
    if (!debouncedQuery || debouncedQuery.length < 2 || chosen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      setSearching(false)

      return
    }

    setSearching(true)
    fetch(`/api/search/libraries?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((json: { data?: LibraryResult[] }) => {
        if (!cancelled) setResults((json.data ?? []).slice(0, 6))
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, chosen])

  const needsLibrary = selected !== "add"
  const canContinue = selected === "add" || chosen != null

  const handleContinue = () => {
    if (selected === "add") {
      router.push("/contribute/add")

      return
    }
    if (!chosen) return
    router.push(`/contribute/edit/${chosen.slug}`)
  }

  return (
    <div>
      {/* Action cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const isSelected = action.id === selected

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setSelected(action.id)
                setChosen(null)
                setQuery("")
              }}
              aria-pressed={isSelected}
              className="flex flex-col items-start gap-3 rounded-[18px] p-5 text-left transition-colors"
              style={{
                background: T.bg.deep,
                border: `1.5px solid ${isSelected ? T.accent.primary : T.border.line}`,
              }}
            >
              <span className="flex w-full items-start justify-between">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full"
                  style={{ background: action.tintBg, color: action.tintFg }}
                >
                  <Icon icon={action.icon} width={19} height={19} />
                </span>
                {isSelected ? (
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: T.accent.primary }}
                  >
                    ✓ Selected
                  </span>
                ) : null}
              </span>
              <span
                className="text-[18px] font-medium"
                style={{ fontFamily: T.font.serif, color: T.ink.base }}
              >
                {action.title}
              </span>
              <span
                className="text-[14px] leading-[1.5]"
                style={{ color: T.ink.dim }}
              >
                {action.description}
              </span>
              <span
                className="mt-auto flex items-center gap-1.5 text-[13px]"
                style={{ color: T.ink.low }}
              >
                <Icon
                  icon="mdi:clock-outline"
                  width={14}
                  height={14}
                  aria-hidden="true"
                />
                About {action.minutes} minutes
              </span>
            </button>
          )
        })}
      </div>

      {/* Inline starter */}
      <div
        className="mt-6 rounded-[20px] p-6 md:p-8"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <StepChip
            n={1}
            label={needsLibrary ? "Choose the library" : "Start the record"}
            active
          />
          <StepChip n={2} label="Details" active={false} />
          <StepChip n={3} label="Source & send" active={false} />
        </div>

        {needsLibrary ? (
          <div className="mt-6">
            <p
              className="m-0 text-[17px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Which library is this about?
            </p>
            <p className="mt-1 mb-3 text-[14px]" style={{ color: T.ink.dim }}>
              Search the {publishedCount.toLocaleString("en-GB")} published
              records.
            </p>

            <div className="relative max-w-[460px]">
              {chosen ? (
                <div
                  className="flex items-center justify-between gap-3 rounded-[14px] px-4 py-3"
                  style={{
                    background: "var(--t-accent-chip)",
                    border: `1.5px solid ${T.accent.primary}`,
                  }}
                >
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: T.accent.primaryHover }}
                  >
                    {chosen.name}
                    {chosen.city ? (
                      <span className="font-normal"> · {chosen.city}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    aria-label="Clear selected library"
                    onClick={() => setChosen(null)}
                    className="flex size-6 items-center justify-center rounded-full"
                    style={{ background: T.bg.deep, color: T.ink.dim }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <SearchField
                    id="hub-library-search"
                    label="Library name or place"
                    placeholder="Library name or place — e.g. Epworth"
                    onClear={() => setQuery("")}
                    inputProps={{
                      value: query,
                      onChange: (e) => setQuery(e.target.value),
                      autoComplete: "off",
                    }}
                  />
                  {query.length >= 2 ? (
                    <ul
                      className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 m-0 list-none overflow-hidden rounded-[14px] p-1.5"
                      style={{
                        background: T.bg.deep,
                        border: `1px solid ${T.border.hi}`,
                        boxShadow: "0 12px 28px rgba(23,22,43,.12)",
                      }}
                    >
                      {searching ? (
                        <li
                          className="px-3 py-2.5 text-[14px]"
                          style={{ color: T.ink.low }}
                        >
                          Searching…
                        </li>
                      ) : results.length === 0 ? (
                        <li
                          className="px-3 py-2.5 text-[14px]"
                          style={{ color: T.ink.dim }}
                        >
                          No records match — try another spelling, or{" "}
                          <Link
                            href="/contribute/add"
                            style={{ color: T.accent.primary }}
                          >
                            add it as a new library
                          </Link>
                          .
                        </li>
                      ) : (
                        results.map((result) => (
                          <li key={result.documentId}>
                            <button
                              type="button"
                              onClick={() => setChosen(result)}
                              className="w-full rounded-[10px] px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-(--t-bg-surface)"
                              style={{ color: T.ink.base }}
                            >
                              <span className="font-semibold">
                                {result.name}
                              </span>
                              {result.city ? (
                                <span style={{ color: T.ink.dim }}>
                                  {" "}
                                  · {result.city}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
            A new record starts in the guided wizard — name, location, hours and
            sources, saved as you go.
          </p>
        )}

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="rounded-full px-6 py-2.5 text-[15px] font-semibold text-white transition-colors"
            style={{
              background: canContinue ? T.accent.primary : T.ink.ghost,
              cursor: canContinue ? "pointer" : "not-allowed",
            }}
          >
            Continue
          </button>
          <span className="text-[14px]" style={{ color: T.ink.low }}>
            Step 1 of 3
          </span>
        </div>
      </div>
    </div>
  )
}
