"use client"

import { type DismissiblePrompt, DISMISSIBLE_PROMPTS } from "@repo/shared-data"
import { useState } from "react"
import { toast } from "sonner"

import { SectionCard } from "@/components/profile-form/FormParts"
import { ToggleSwitch } from "@/components/settings/ToggleSwitch"
import { useProfile } from "@/hooks/useProfile"
import { T } from "@/lib/design-tokens"
import { clearPromptCookie, savePromptSetting } from "@/lib/dismissed-prompts"
import type { UserProfile } from "@/lib/types/profile"

type NotifKey =
  | "weeklyDigest"
  | "editsReviewed"
  | "newFollowers"
  | "editorialMessages"
  | "soundOn"
  | "marketing"

type ToggleItem<K extends string> = {
  key: K
  label: string
  desc: string
}

type NotificationItem = ToggleItem<NotifKey>

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

/** Every prompt a reader can hide (`DismissiblePrompt`); on means shown. */
const PROMPTS: Record<DismissiblePrompt, ToggleItem<DismissiblePrompt>> = {
  "find-contribute": {
    key: "find-contribute",
    label: "Invitation to contribute on Find libraries",
    desc: "The banner above the results.",
  },
  "atlas-contribute": {
    key: "atlas-contribute",
    label: "Invitation to contribute on the Atlas",
    desc: "The card under the Atlas search.",
  },
}

type NotificationPrefs = Record<NotifKey, boolean>

function NotifGroup<K extends string>({
  title,
  items,
  prefs,
  onToggle,
}: {
  title: string
  items: ToggleItem<K>[]
  prefs: Record<K, boolean>
  onToggle: (key: K) => void
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
  const [shownPrompts, setShownPrompts] = useState(
    () =>
      Object.fromEntries(
        DISMISSIBLE_PROMPTS.map((p) => [
          p,
          !profile?.dismissedPrompts?.includes(p),
        ])
      ) as Record<DismissiblePrompt, boolean>
  )

  const toggle = (key: NotifKey) => {
    const next = { ...prefs, [key]: !prefs[key] }

    setPrefs(next)
    void updateNotifications(next)
  }

  const savePrompt = async (key: DismissiblePrompt, show: boolean) => {
    if (await savePromptSetting(key, !show)) return
    setShownPrompts((s) => ({ ...s, [key]: !show }))
    toast.error("Couldn't save that setting")
  }

  const togglePrompt = (key: DismissiblePrompt) => {
    const show = !shownPrompts[key]

    setShownPrompts((s) => ({ ...s, [key]: show }))
    // A cookie from hiding it this session would otherwise outlast "on".
    if (show) clearPromptCookie(key)
    void savePrompt(key, show)
  }

  return (
    <SectionCard
      id="notifications"
      title="Notifications"
      lead="Choose what you hear about libraries, your contributions and the people you follow."
    >
      <NotifGroup
        title="By email"
        items={EMAIL_NOTIFS}
        prefs={prefs}
        onToggle={toggle}
      />

      <NotifGroup
        title="On the site"
        items={SITE_NOTIFS}
        prefs={prefs}
        onToggle={toggle}
      />

      <NotifGroup
        title="Prompts"
        items={Object.values(PROMPTS)}
        prefs={shownPrompts}
        onToggle={togglePrompt}
      />
    </SectionCard>
  )
}
