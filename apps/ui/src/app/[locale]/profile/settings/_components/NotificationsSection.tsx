"use client"

import { type DismissiblePrompt, DISMISSIBLE_PROMPTS } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { NewsletterPreference } from "@/components/notifications/NewsletterPreference"
import { useNotifications } from "@/components/notifications/NotificationProvider"
import { SectionCard } from "@/components/profile-form/FormParts"
import { ToggleSwitch } from "@/components/settings/ToggleSwitch"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/hooks/useProfile"
import { T } from "@/lib/design-tokens"
import { clearPromptCookie, savePromptSetting } from "@/lib/dismissed-prompts"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

type NotifKey =
  | "weeklyDigest"
  | "weeklyReport"
  | "recognition"
  | "editsReviewed"
  | "drives"
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
    key: "weeklyReport",
    label: "Weekly community report",
    desc: "A Monday summary of new libraries, public articles and your contributions. No email in quiet weeks.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    desc: "A Monday email when libraries you follow have public updates. No email in quiet weeks.",
  },
  {
    key: "editsReviewed",
    label: "Your edits are reviewed",
    desc: "When a change is accepted, returned for more information or rejected.",
  },
  {
    key: "drives",
    label: "Drives you helped",
    desc: "A thank-you with the final numbers when a drive closes.",
  },
  {
    key: "newFollowers",
    label: "New followers",
    desc: "When another contributor follows you.",
  },
  {
    key: "editorialMessages",
    label: "Project notices",
    desc: "Operational updates from project stewards. Essential account and security emails are always sent.",
  },
  {
    key: "recognition",
    label: "Badges earned",
    desc: "An email when you earn a new badge. Your badges also appear in the notification inbox.",
  },
  {
    key: "marketing",
    label: "Product updates",
    desc: "Occasional emails about new features. Separate from the newsletter and weekly reports.",
  },
]

const SITE_NOTIFS: NotificationItem[] = [
  {
    key: "soundOn",
    label: "Play a sound for new notifications",
    desc: "A quiet, short chime while the site is open, after you interact with it. No sound for existing unread updates.",
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
  disabled = false,
}: {
  title: string
  items: ToggleItem<K>[]
  prefs: Record<K, boolean>
  onToggle: (key: K) => void
  disabled?: boolean
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
            disabled={disabled}
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
  const tUi = useUiTranslations("ui")

  const { updateNotifications, saving } = useProfile()
  const { refresh, previewSound } = useNotifications()

  const defaults: NotificationPrefs = {
    editsReviewed: true,
    drives: true,
    newFollowers: false,
    editorialMessages: true,
    soundOn: false,
    recognition: false,
    ...profile?.notifPrefs,
    // Old "coming soon" values are not consent to a newly launched digest.
    weeklyDigest:
      profile?.notifPrefs?.weeklyDigest === true &&
      Boolean(profile?.notifPrefs?.digestConsentedAt),
    weeklyReport:
      profile?.notifPrefs?.weeklyReport === true &&
      Boolean(profile?.notifPrefs?.reportConsentedAt),
    marketing:
      profile?.notifPrefs?.marketing === true &&
      Boolean(profile?.notifPrefs?.productConsentedAt),
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

  const toggle = async (key: NotifKey) => {
    if (saving) return
    const previous = prefs
    const next = { ...prefs, [key]: !prefs[key] }

    setPrefs(next)
    if (!(await updateNotifications({ [key]: next[key] }))) setPrefs(previous)
    else await refresh()
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
      title={tUi("notifications")}
      lead="Choose what you hear about libraries, your contributions and the people you follow."
    >
      <NotifGroup
        title={tUi("by_email")}
        items={EMAIL_NOTIFS}
        prefs={prefs}
        onToggle={toggle}
        disabled={saving}
      />
      <NewsletterPreference />

      <NotifGroup
        title={tUi("on_the_site")}
        items={SITE_NOTIFS}
        prefs={prefs}
        onToggle={toggle}
        disabled={saving}
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/profile/notifications">Open notification inbox</Link>
        </Button>
        {prefs.soundOn && (
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={previewSound}
          >
            Preview notification sound
          </Button>
        )}
      </div>
      <p className="text-sm" style={{ color: T.ink.dim }}>
        Email preferences do not hide updates on the site. Newsletter emails
        have their own confirmation and unsubscribe links.
      </p>

      <NotifGroup
        title={tUi("prompts")}
        items={Object.values(PROMPTS)}
        prefs={shownPrompts}
        onToggle={togglePrompt}
      />
    </SectionCard>
  )
}
