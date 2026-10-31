"use client"

import { useTranslations as useUiTranslations } from "next-intl"

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
  const tUi = useUiTranslations("ui")

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
            aria-label={`${tUi("social_media")} ${i + 1}`}
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
            aria-label={`${tUi("link_url")} ${i + 1}`}
            type="url"
            value={link.url}
            onChange={(e) => updateLink(i, { url: e.target.value })}
            placeholder="https://"
            style={fieldInputStyle}
          />
          <button
            type="button"
            onClick={() => removeLink(i)}
            aria-label={tUi("remove_social_link")}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.faint,
              fontSize: "var(--type-body-large-size)",
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
          fontSize: "var(--type-body-small-size)",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        {tUi("add_social_link")}{" "}
      </button>
    </div>
  )
}
