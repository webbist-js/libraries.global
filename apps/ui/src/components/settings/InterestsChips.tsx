"use client"

import { useLocale, useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"
import type { Topic } from "@/lib/types/profile"

export function InterestsChips({
  selected,
  onChange,
  inputStyle,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  /** Overrides for the "Suggest a topic" input, e.g. a page's field style. */
  inputStyle?: React.CSSProperties
}) {
  const tUi = useUiTranslations("ui")
  const locale = useLocale()

  const [topics, setTopics] = useState<Topic[]>([])
  const [suggestInput, setSuggestInput] = useState("")
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics?locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setTopics(json.data ?? [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [locale])

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const suggest = async () => {
    const name = suggestInput.trim()
    if (!name || name.length < 2) return
    setSuggesting(true)
    try {
      const res = await fetch("/api/profile/me/suggest-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        toast.success(tUi("topic_suggestion_submitted", { name }))
        setSuggestInput("")
      } else {
        toast.error(tUi("topic_suggestion_failed"))
      }
    } catch {
      toast.error(tUi("topic_suggestion_failed"))
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        {topics.map((topic) => {
          const active = selected.includes(topic.documentId)

          return (
            <button
              key={topic.documentId}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(topic.documentId)}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                border: `1px solid ${active ? T.accent.primary : T.border.hi}`,
                background: active ? T.accent.chip : T.bg.deep,
                color: active ? T.accent.primaryHover : T.ink.base,
                fontSize: "14px",
                fontFamily: T.font.sans,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {active ? (
                <span aria-hidden="true" style={{ marginRight: "6px" }}>
                  ✓
                </span>
              ) : null}
              {topic.name}
            </button>
          )
        })}
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <input
          type="text"
          aria-label={tUi("suggest_a_topic")}
          placeholder={tUi("suggest_a_topic_2")}
          value={suggestInput}
          onChange={(e) => setSuggestInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void suggest()
            }
          }}
          style={{
            flex: 1,
            padding: "9px 14px",
            borderRadius: "12px",
            border: `1px solid ${T.border.line}`,
            background: T.bg.deep,
            color: T.ink.base,
            fontSize: "15px",
            fontFamily: T.font.sans,
            ...inputStyle,
          }}
        />
        <button
          type="button"
          onClick={() => void suggest()}
          disabled={suggesting || suggestInput.trim().length < 2}
          style={{
            padding: "9px 18px",
            borderRadius: "999px",
            border: `1px solid ${T.border.hi}`,
            background: T.bg.deep,
            color: T.ink.base,
            fontSize: "14px",
            fontFamily: T.font.sans,
            fontWeight: 600,
            cursor: suggesting ? "not-allowed" : "pointer",
            opacity: suggesting ? 0.6 : 1,
          }}
        >
          {suggesting ? "…" : tUi("suggest")}
        </button>
      </div>
    </div>
  )
}
