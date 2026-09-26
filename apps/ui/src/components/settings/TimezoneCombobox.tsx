"use client"

import { useState, useRef, useEffect, useMemo } from "react"

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

const triggerStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
  cursor: "pointer",
  textAlign: "left" as const,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

export function TimezoneCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (tz: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
        type="button"
        style={triggerStyle}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: value ? T.ink.base : T.ink.faint }}>
          {displayValue || "Select timezone…"}
        </span>
        <span style={{ color: T.ink.faint, fontSize: "10px" }}>▾</span>
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
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 12px 28px rgba(23,22,43,.12)",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search timezones… (e.g. London, Paris)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "13px",
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
                No results
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
