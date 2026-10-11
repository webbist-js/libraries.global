"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState, useRef, useEffect, useId } from "react"

import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

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

export function CountryCombobox({
  value,
  onChange,
  id,
  labelledBy,
  triggerStyle: triggerOverrides,
}: {
  value: string
  onChange: (code: string) => void
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

  const selected = COUNTRIES.find((c) => c.code === value)
  const filtered = query
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRIES

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

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        id={id}
        type="button"
        aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
        style={{ ...triggerStyle, ...triggerOverrides }}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={valueId} style={{ color: selected ? T.ink.base : T.ink.dim }}>
          {selected ? selected.name : "Select country…"}
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
            aria-label={tUi("search_countries")}
            placeholder={tUi("search_countries_2")}
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
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.code)
                  setOpen(false)
                  setQuery("")
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background: c.code === value ? T.accent.chip : "transparent",
                  border: "none",
                  color: c.code === value ? T.accent.primaryHover : T.ink.dim,
                  fontSize: "14px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-(--t-bg-surface)"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
