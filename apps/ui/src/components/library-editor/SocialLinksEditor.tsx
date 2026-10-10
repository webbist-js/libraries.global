"use client"

import { T } from "@/lib/design-tokens"

import { fieldInputStyle, SOCIAL_PLATFORMS } from "./wizard.constants"
import type { SocialLink } from "./wizard.types"

export function SocialLinksEditor({
  value,
  onChange,
}: {
  value: SocialLink[]
  onChange: (links: SocialLink[]) => void
}) {
  const addLink = () =>
    onChange([...value, { platform: "facebook", url: "", label: "" }])

  const updateLink = (i: number, patch: Partial<SocialLink>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const removeLink = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {value.map((link, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr auto",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <select
            value={link.platform}
            onChange={(e) => updateLink(i, { platform: e.target.value })}
            style={{
              ...fieldInputStyle,
              cursor: "pointer",
              padding: "9px 12px",
            }}
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={link.url}
            onChange={(e) => updateLink(i, { url: e.target.value })}
            placeholder="https://"
            style={fieldInputStyle}
          />
          <button
            type="button"
            onClick={() => removeLink(i)}
            aria-label="Remove social link"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.faint,
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLink}
        style={{
          padding: "8px 16px",
          borderRadius: "7px",
          border: `1px solid ${T.border.hi}`,
          background: "transparent",
          color: T.ink.dim,
          fontFamily: T.font.sans,
          fontSize: "13px",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        + Add social link
      </button>
    </div>
  )
}
