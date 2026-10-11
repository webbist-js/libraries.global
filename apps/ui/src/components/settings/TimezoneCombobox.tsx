"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState, useRef, useEffect, useId, useMemo } from "react"

import { T } from "@/lib/design-tokens"

function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone")
  } catch {
    return [
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Australia/Sydney",
    ]
  }
}

// Matches the text inputs beside it; a page with taller fields passes
// `triggerStyle` to line up with them.
const triggerStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "12px",
  border: `1px solid ${T.border.line}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: "15px",
  fontFamily: T.font.sans,
  boxSizing: "border-box",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
}

export function TimezoneCombobox({
  value,
  onChange,
  id,
  labelledBy,
  triggerStyle: triggerOverrides,
}: {
  value: string
  onChange: (tz: string) => void
  /** The trigger button's id, for a `<label htmlFor>`. */
  id?: string
  /**
   * The visible label's id. The trigger is then named by the label and its
   * current value; a `<label htmlFor>` alone would drop the value.
   */
  labelledBy?: string
  /** Overrides for the trigger button, e.g. a page's own field style. */
  triggerStyle?: React.CSSProperties
}) {
  const tUi = useUiTranslations("ui")

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const valueId = useId()
  const timezones = useMemo(() => getTimezones(), [])

  const filtered = useMemo(() => {
    if (!query) return timezones
    const q = query.toLowerCase()

    return timezones.filter(
      (tz) =>
        tz.toLowerCase().includes(q) ||
        tz.replaceAll("_", " ").toLowerCase().includes(q)
    )
  }, [query, timezones])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)

    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const displayValue = value ? value.replaceAll("_", " ") : ""

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        id={id}
        type="button"
        aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
        style={{ ...triggerStyle, ...triggerOverrides }}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={valueId} style={{ color: value ? T.ink.base : T.ink.dim }}>
          {displayValue || "Select timezone…"}
        </span>
        <Icon
          aria-hidden="true"
          icon="mdi:chevron-down"
          width={18}
          height={18}
          style={{ color: T.ink.dim, flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: T.bg.deep,
            border: `1px solid ${T.border.hi}`,
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 12px 28px rgba(23,22,43,.12)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            aria-label={tUi("search_timezones")}
            placeholder={tUi("search_timezones_eg_london_paris")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "15px",
              fontFamily: T.font.sans,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  color: T.ink.faint,
                  fontSize: "13px",
                }}
              >
                {tUi("no_results")}{" "}
              </div>
            )}
            {filtered.slice(0, 100).map((tz) => (
              <button
                key={tz}
                type="button"
                onClick={() => {
                  onChange(tz)
                  setOpen(false)
                  setQuery("")
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background:
                    tz === value ? "var(--t-accent-chip)" : "transparent",
                  border: "none",
                  color: tz === value ? T.accent.primaryHover : T.ink.base,
                  fontSize: "14px",
                  fontFamily: T.font.sans,
                  fontWeight: tz === value ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-(--t-bg-surface)"
              >
                {tz.replaceAll("_", " ")}
              </button>
            ))}
            {filtered.length > 100 && (
              <div
                style={{
                  padding: "8px 14px",
                  color: T.ink.low,
                  fontSize: "13px",
                }}
              >
                {filtered.length - 100} more — refine your search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
