import type React from "react"

import { T } from "@/lib/design-tokens"

export const fieldInputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: T.font.sans,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
}

export const fieldLabelStyle: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: "11px",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: T.ink.faint,
  display: "flex",
  alignItems: "center",
  gap: "6px",
}

export const LIBRARY_TYPES = [
  { value: "National", label: "National" },
  { value: "Public", label: "Public" },
  { value: "Academic", label: "Academic" },
  { value: "University", label: "University" },
  { value: "Parliamentary", label: "Parliamentary" },
  { value: "State", label: "State" },
  { value: "Municipal", label: "Municipal" },
  { value: "Special", label: "Special" },
  { value: "Monastic", label: "Monastic" },
  { value: "Archive", label: "Archive" },
  { value: "Private", label: "Private" },
  { value: "Cultural", label: "Cultural" },
  { value: "Digital", label: "Digital" },
  { value: "Mobile", label: "Mobile" },
  { value: "Other", label: "Other" },
]

export const OPERATOR_TYPES = [
  { value: "National Government", label: "National Government" },
  { value: "Regional Government", label: "Regional Government" },
  { value: "Municipality", label: "Municipality" },
  { value: "University", label: "University" },
  { value: "Religious Institution", label: "Religious Institution" },
  { value: "Private Foundation", label: "Private Foundation" },
  { value: "Independent", label: "Independent" },
  { value: "Volunteer Managed", label: "Volunteer Managed" },
  { value: "Community Managed", label: "Community Managed" },
  { value: "Other", label: "Other" },
]

export const OPERATIONAL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "temporarily_closed", label: "Temporarily Closed" },
  { value: "permanently_closed", label: "Permanently Closed" },
  { value: "seasonal", label: "Seasonal" },
  { value: "appointment_only", label: "Appointment Only" },
  { value: "planned", label: "Planned / Under Construction" },
  { value: "unknown", label: "Unknown" },
]

export const EVIDENCE_TYPES = [
  { value: "institutional_url", label: "Institutional URL" },
  { value: "on_site_photo", label: "On-site Photo" },
  { value: "press_release", label: "Press Release" },
  { value: "personal_communication", label: "Personal Communication" },
  {
    value: "my_institutional_affiliation",
    label: "My Institutional Affiliation",
  },
  { value: "other", label: "Other" },
]

export const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "wechat", label: "WeChat" },
  { value: "threads", label: "Threads" },
  { value: "bluesky", label: "Bluesky" },
  { value: "mastodon", label: "Mastodon" },
  { value: "pinterest", label: "Pinterest" },
]
