"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState, useRef, useEffect, useId, type RefObject } from "react"

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
  fontSize: "var(--type-body-size)",
  fontFamily: T.font.sans,
  boxSizing: "border-box",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
}

const searchText = (value: string) =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()

export function CountryCombobox({
  value,
  onChange,
  id,
  labelledBy,
  triggerStyle: triggerOverrides,
  countries = COUNTRIES,
  triggerRef,
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
  /** CMS-backed selectors can provide their own country names and identifiers. */
  countries?: readonly { code: string; name: string; searchTerms?: string }[]
  triggerRef?: RefObject<HTMLButtonElement | null>
}) {
  const tUi = useUiTranslations("ui")

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const valueId = useId()
  const listId = useId()

  const selected = countries.find((c) => c.code === value)
  const filtered = query
    ? countries.filter((c) =>
        searchText(`${c.name} ${c.code} ${c.searchTerms ?? ""}`).includes(
          searchText(query.trim())
        )
      )
    : countries

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    const option = list?.children[activeIndex] as HTMLElement | undefined
    if (list && option) {
      const top = option.offsetTop - list.offsetTop
      if (top < list.scrollTop) list.scrollTop = top
      else if (top + option.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = top + option.offsetHeight - list.clientHeight
    }
  }, [activeIndex, open, query])

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

  const choose = (code: string) => {
    onChange(code)
    setOpen(false)
    setQuery("")
    setActiveIndex(0)
    ;(triggerRef ?? buttonRef).current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          setQuery("")
          setActiveIndex(0)
        }
      }}
    >
      <button
        ref={triggerRef ?? buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
        style={{ ...triggerStyle, ...triggerOverrides }}
        onClick={() => {
          setOpen((o) => !o)
          setQuery("")
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
          }
        }}
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
            className="focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--t-accent-primary)"
            aria-label={tUi("search_countries")}
            placeholder={tUi("search_countries_2")}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                setOpen(false)
                setQuery("")
                ;(triggerRef ?? buttonRef).current?.focus({
                  preventScroll: true,
                })
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) =>
                  filtered.length
                    ? (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        filtered.length) %
                      filtered.length
                    : 0
                )
              } else if (event.key === "Enter" && filtered[activeIndex]) {
                event.preventDefault()
                choose(filtered[activeIndex]!.code)
              }
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.base,
              fontSize: "var(--type-body-size)",
              fontFamily: T.font.sans,
              boxSizing: "border-box",
            }}
          />
          <div
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label={tUi("search_countries")}
            style={{
              maxHeight: "240px",
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {filtered.length === 0 && (
              <div
                style={{
                  padding: "12px 14px",
                  color: T.ink.faint,
                  fontSize: "var(--type-body-small-size)",
                }}
              >
                {tUi("no_results")}{" "}
              </div>
            )}
            {filtered.map((c, index) => (
              <button
                key={c.code}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={c.code === value}
                tabIndex={-1}
                onClick={() => choose(c.code)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  background:
                    c.code === value
                      ? T.accent.chip
                      : index === activeIndex
                        ? T.bg.surface
                        : "transparent",
                  border: "none",
                  color: c.code === value ? T.accent.primaryHover : T.ink.dim,
                  fontSize: "var(--type-body-small-size)",
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
