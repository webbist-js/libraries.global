"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"
import { useProfile } from "@/hooks/useProfile"

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "42px",
        height: "24px",
        borderRadius: "999px",
        border: "none",
        background: value ? T.accent.aurora : "rgba(255,255,255,0.12)",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 200ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: value ? "21px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 200ms",
        }}
      />
    </button>
  )
}

type NotifKey = "weeklyDigest" | "editsReviewed" | "newFollowers" | "editorialMessages" | "soundOn" | "marketing"

const EMAIL_NOTIFS: { key: NotifKey; label: string; desc: string }[] = [
  { key: "weeklyDigest",      label: "Weekly digest",            desc: "Every activity on followed libraries + your contributions." },
  { key: "editsReviewed",     label: "Edits reviewed",           desc: "When an editor approves, rejects, or comments on your submission." },
  { key: "newFollowers",      label: "New followers",            desc: "When another contributor follows you." },
  { key: "editorialMessages", label: "Editorial-board messages", desc: "Important announcements from the project stewards. Recommended." },
]
const PRODUCT_NOTIFS: { key: NotifKey; label: string; desc: string }[] = [
  { key: "soundOn",   label: "Sound on new notifications", desc: "A subtle chime when a new notification arrives." },
  { key: "marketing", label: "Marketing emails",           desc: "Occasional updates on new features and project milestones." },
]

export function NotificationsSection({ profile }: { profile: UserProfile | null }) {
  const { saving, updateNotifications } = useProfile()
  const defaults = profile?.notifPrefs ?? {
    weeklyDigest: true, editsReviewed: true, newFollowers: false,
    editorialMessages: true, soundOn: false, marketing: false,
  }
  const [prefs, setPrefs] = useState(defaults)

  const toggle = (key: NotifKey) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    void updateNotifications(next)
  }

  const SectionCard = ({ title, items }: { title: string; items: typeof EMAIL_NOTIFS }) => (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border.line}`, background: "rgba(255,255,255,0.02)" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: T.ink.base }}>{title}</h3>
      </div>
      {items.map((item, i) => (
        <div
          key={item.key}
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            borderBottom: i < items.length - 1 ? `1px solid ${T.border.line}` : "none",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.base }}>{item.label}</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>{item.desc}</p>
          </div>
          <Toggle value={prefs[item.key]} onChange={() => toggle(item.key)} />
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Notifications</h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Choose how you want to hear about activity on libraries, contributions, and the people you follow.
      </p>
      <SectionCard title="Email" items={EMAIL_NOTIFS} />
      <SectionCard title="In-product" items={PRODUCT_NOTIFS} />
      {saving && <p style={{ fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>Saving…</p>}
    </div>
  )
}
