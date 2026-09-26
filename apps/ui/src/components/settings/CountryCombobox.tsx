"use client"

import { useState, useRef, useEffect } from "react"

import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

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

export function CountryCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        type="button"
        style={triggerStyle}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ color: selected ? T.ink.base : T.ink.faint }}>
          {selected ? selected.name : "Select country…"}
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
            placeholder="Search countries…"
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
