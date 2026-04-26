"use client"

import { useState, useRef, useEffect } from "react"

import { COUNTRIES } from "@/lib/data/countries"
import { T } from "@/lib/design-tokens"

const triggerStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.04)",
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
        className="focus:border-[rgba(127,223,255,.4)]"
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
            background: "rgba(7,11,30,0.98)",
            border: `1px solid ${T.border.hi}`,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
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
                  background:
                    c.code === value ? "rgba(127,223,255,0.08)" : "transparent",
                  border: "none",
                  color: c.code === value ? T.accent.aurora : T.ink.dim,
                  fontSize: "13px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                className="hover:bg-white/[0.05]"
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
