"use client"

import { useState } from "react"

import { ToggleSwitch } from "@/components/settings/ToggleSwitch"
import { useProfile } from "@/hooks/useProfile"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

type NotifKey =
  | "weeklyDigest"
  | "editsReviewed"
  | "newFollowers"
  | "editorialMessages"
  | "soundOn"
  | "marketing"

type NotificationItem = {
  key: NotifKey
  label: string
  desc: string
}

const EMAIL_NOTIFS: NotificationItem[] = [
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    desc: "Activity on libraries you follow and your contributions.",
  },
  {
    key: "editsReviewed",
    label: "Your edits are reviewed",
    desc: "When a change is accepted, returned or commented on.",
  },
  {
    key: "newFollowers",
    label: "New followers",
    desc: "When another contributor follows you.",
  },
  {
    key: "editorialMessages",
    label: "Announcements from project stewards",
    desc: "Important project news. Recommended.",
  },
]

const SITE_NOTIFS: NotificationItem[] = [
  {
    key: "soundOn",
    label: "Play a sound for new notifications",
    desc: "A short chime.",
  },
  {
    key: "marketing",
    label: "Product updates",
    desc: "New features and project milestones.",
  },
]

type NotificationPrefs = Record<NotifKey, boolean>

function NotifGroup({
  title,
  items,
  prefs,
  onToggle,
}: {
  title: string
  items: NotificationItem[]
  prefs: NotificationPrefs
  onToggle: (key: NotifKey) => void
}) {
  return (
    <div>
      <p
        className="m-0 mb-1 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        {title}
      </p>
      {items.map((item, index) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-4 py-3.5"
          style={{
            borderBottom:
              index < items.length - 1
                ? `1px solid ${T.border.divider}`
                : "none",
          }}
        >
          <div className="min-w-0">
            <p
              className="m-0 text-[15px] font-medium"
              style={{ color: T.ink.base }}
            >
              {item.label}
            </p>
            <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
              {item.desc}
            </p>
          </div>
          <ToggleSwitch
            value={prefs[item.key]}
            onChange={() => onToggle(item.key)}
            label={item.label}
          />
        </div>
      ))}
    </div>
  )
}

export function NotificationsSection({
  profile,
}: {
  profile: UserProfile | null
}) {
  const { updateNotifications } = useProfile()

  const defaults: NotificationPrefs = profile?.notifPrefs ?? {
    weeklyDigest: true,
    editsReviewed: true,
    newFollowers: false,
    editorialMessages: true,
    soundOn: false,
    marketing: false,
  }

  const [prefs, setPrefs] = useState<NotificationPrefs>(defaults)

  const toggle = (key: NotifKey) => {
    const next = { ...prefs, [key]: !prefs[key] }

    setPrefs(next)
    void updateNotifications(next)
  }

  return (
    <div>
      <h2
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "24px",
          fontWeight: 500,
          color: T.ink.base,
        }}
      >
        Notifications
      </h2>
      <p className="mt-1 mb-6 text-[15px]" style={{ color: T.ink.dim }}>
        Choose what you hear about libraries, your contributions and the people
        you follow.
      </p>

      <NotifGroup
        title="By email"
        items={EMAIL_NOTIFS}
        prefs={prefs}
        onToggle={toggle}
      />

      <div className="mt-7">
        <NotifGroup
          title="On the site"
          items={SITE_NOTIFS}
          prefs={prefs}
          onToggle={toggle}
        />
      </div>
    </div>
  )
}
