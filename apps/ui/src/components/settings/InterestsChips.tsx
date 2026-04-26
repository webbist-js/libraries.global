"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"
import type { Topic } from "@/lib/types/profile"

export function InterestsChips({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [suggestInput, setSuggestInput] = useState("")
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((json) => setTopics(json.data ?? []))
      .catch(() => {})
  }, [])

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
        toast.success(`"${name}" submitted for review`)
        setSuggestInput("")
      } else {
        toast.error("Failed to submit suggestion")
      }
    } catch {
      toast.error("Failed to submit suggestion")
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
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        {topics.map((topic) => {
          const active = selected.includes(topic.documentId)

          return (
            <button
              key={topic.documentId}
              type="button"
              onClick={() => toggle(topic.documentId)}
              style={{
                padding: "5px 12px",
                borderRadius: "999px",
                border: `1px solid ${active ? "rgba(127,223,255,0.5)" : T.border.line}`,
                background: active
                  ? "rgba(127,223,255,0.1)"
                  : "rgba(255,255,255,0.03)",
                color: active ? T.accent.aurora : T.ink.dim,
                fontSize: "12px",
                fontFamily: T.font.mono,
                letterSpacing: "0.04em",
                cursor: "pointer",
                transition: "all 150ms",
              }}
            >
              {topic.name}
            </button>
          )
        })}
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Suggest a topic…"
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
            padding: "8px 12px",
            borderRadius: "6px",
            border: `1px solid ${T.border.line}`,
            background: "rgba(255,255,255,0.03)",
            color: T.ink.base,
            fontSize: "12px",
            fontFamily: T.font.sans,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => void suggest()}
          disabled={suggesting || suggestInput.trim().length < 2}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: `1px solid ${T.border.line}`,
            background: "rgba(255,255,255,0.05)",
            color: T.ink.dim,
            fontSize: "12px",
            fontFamily: T.font.sans,
            cursor: suggesting ? "not-allowed" : "pointer",
            opacity: suggesting ? 0.6 : 1,
          }}
        >
          {suggesting ? "…" : "Suggest"}
        </button>
      </div>
    </div>
  )
}
