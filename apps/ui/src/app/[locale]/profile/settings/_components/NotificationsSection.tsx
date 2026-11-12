"use client"

import { type DismissiblePrompt, DISMISSIBLE_PROMPTS } from "@repo/shared-data"
import { useTranslations } from "next-intl"
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

/**
 * Every prompt a reader can hide (`DismissiblePrompt`); on means shown.
 * `atlas-data-gap` is translated, so the section builds it.
 */

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
        className="m-0 mb-1 text-base font-semibold"
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
              className="m-0 text-base font-medium"
              style={{ color: T.ink.base }}
            >
              {item.label}
            </p>
            <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
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
  hasTeam = false,
}: {
  profile: UserProfile | null
  hasTeam?: boolean
}) {
  const tStatic = useTranslations("staticUi")
  const EMAIL_NOTIFS: NotificationItem[] = [
    {
      key: "weeklyReport",
      label: tStatic("profileRoute.weekly_community_report"),
      desc: tStatic(
        "notificationSetting.a_monday_summary_of_new_libraries_public_articles_and_your_contributions_no_email_in_quiet_week"
      ),
    },
    {
      key: "weeklyDigest",
      label: tStatic("profileRoute.weekly_digest"),
      desc: tStatic(
        "notificationSetting.a_monday_email_when_libraries_you_follow_have_public_updates_no_email_in_quiet_weeks"
      ),
    },
    {
      key: "editsReviewed",
      label: tStatic("profileRoute.your_edits_are_reviewed"),
      desc: tStatic(
        "notificationSetting.when_a_change_is_accepted_returned_for_more_information_or_rejected"
      ),
    },
    {
      key: "drives",
      label: tStatic("profileRoute.drives_you_helped"),
      desc: tStatic(
        "notificationSetting.a_thank_you_with_the_final_numbers_when_a_drive_closes"
      ),
    },
    {
      key: "newFollowers",
      label: tStatic("profileRoute.new_followers"),
      desc: tStatic("notificationSetting.when_another_contributor_follows_you"),
    },
    {
      key: "editorialMessages",
      label: tStatic("profileRoute.project_notices"),
      desc: tStatic(
        "notificationSetting.operational_updates_from_project_stewards_essential_account_and_security_emails_are_always_sent"
      ),
    },
    {
      key: "recognition",
      label: tStatic("profileRoute.badges_earned"),
      desc: tStatic(
        "notificationSetting.an_email_when_you_earn_a_new_badge_your_badges_also_appear_in_the_notification_inbox"
      ),
    },
    {
      key: "marketing",
      label: tStatic("profileRoute.product_updates"),
      desc: tStatic(
        "notificationSetting.occasional_emails_about_new_features_separate_from_the_newsletter_and_weekly_reports"
      ),
    },
  ]
  const SITE_NOTIFS: NotificationItem[] = [
    {
      key: "soundOn",
      label: tStatic("profileRoute.play_a_sound_for_new_notifications"),
      desc: tStatic(
        "notificationSetting.a_quiet_short_chime_while_the_site_is_open_after_you_interact_with_it_no_sound_for_existing_unr"
      ),
    },
  ]
  const PROMPTS: Record<
    Exclude<DismissiblePrompt, "atlas-data-gap">,
    ToggleItem<DismissiblePrompt>
  > = {
    "find-contribute": {
      key: "find-contribute",
      label: tStatic("profileRoute.invitation_to_contribute_on_find_libraries"),
      desc: tStatic("notificationSetting.the_banner_above_the_results"),
    },
    "atlas-contribute": {
      key: "atlas-contribute",
      label: tStatic("profileRoute.invitation_to_contribute_on_the_atlas"),
      desc: tStatic("notificationSetting.the_card_under_the_atlas_search"),
    },
    "api-playground-usage": {
      key: "api-playground-usage",
      label: tStatic("profileRoute.api_playground_usage_warning"),
      desc: tStatic(
        "notificationSetting.show_a_reminder_each_time_you_open_the_playground_that_successful_requests_use_your_api_account"
      ),
    },
  }

  const tUi = useTranslations("ui")
  const tGaps = useTranslations("atlasDataGaps")

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
  const [savingPrompt, setSavingPrompt] = useState(false)

  const toggle = async (key: NotifKey) => {
    if (saving) return
    const previous = prefs
    const next = { ...prefs, [key]: !prefs[key] }

    setPrefs(next)
    if (!(await updateNotifications({ [key]: next[key] }))) setPrefs(previous)
    else await refresh()
  }

  const savePrompt = async (key: DismissiblePrompt, show: boolean) => {
    setSavingPrompt(true)
    const saved = await savePromptSetting(key, !show)
    setSavingPrompt(false)
    if (!saved) {
      setShownPrompts((s) => ({ ...s, [key]: !show }))
      toast.error(tStatic("profileRoute.couldn_t_save_that_setting"))
    }
  }

  const togglePrompt = (key: DismissiblePrompt) => {
    if (savingPrompt) return
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
      lead={tStatic(
        "profileRoute.choose_what_you_hear_about_libraries_your_contributions_and_the_people_you_follow"
      )}
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
          <Link href="/profile/notifications">
            {tStatic("profileRoute.open_notification_inbox")}
          </Link>
        </Button>
        {prefs.soundOn && (
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={previewSound}
          >
            {tStatic("profileRoute.preview_notification_sound")}
          </Button>
        )}
      </div>
      <p className="text-sm" style={{ color: T.ink.dim }}>
        {tStatic(
          "profileRoute.email_preferences_do_not_hide_updates_on_the_site_newsletter_emails_have_their_own_confirmation_and_"
        )}
      </p>

      <NotifGroup
        title={tUi("prompts")}
        items={DISMISSIBLE_PROMPTS.filter(
          (key) => hasTeam || key !== "api-playground-usage"
        ).map((key) =>
          key === "atlas-data-gap"
            ? {
                key,
                label: tGaps("settingLabel"),
                desc: tGaps("settingDesc", { button: tGaps("details") }),
              }
            : PROMPTS[key]
        )}
        prefs={shownPrompts}
        onToggle={togglePrompt}
        disabled={savingPrompt}
      />
    </SectionCard>
  )
}
