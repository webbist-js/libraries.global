"use client"

import { useSearchParams } from "next/navigation"
import { type Locale, useTranslations } from "next-intl"
import React from "react"

import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { pushAnalyticsEvent } from "@/lib/analytics-events"
import { getPathname, routing, usePathname } from "@/lib/navigation"

const localeTranslation = { cs: "Čeština", en: "English", fr: "Français" }

function LocaleSwitcher({
  locale,
  triggerClassName,
}: {
  locale: Locale
  triggerClassName?: string
}) {
  return (
    <UseSearchParamsWrapper>
      <SuspensedLocaleSwitcher
        locale={locale}
        triggerClassName={triggerClassName}
      />
    </UseSearchParamsWrapper>
  )
}
function SuspensedLocaleSwitcher({
  locale,
  triggerClassName,
}: {
  locale: Locale
  triggerClassName?: string
}) {
  const t = useTranslations("translation")

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleLocaleChange = (locale: Locale) => {
    pushAnalyticsEvent("navigation_action", {
      interaction_source: "navigation",
      action_type: "locale",
      target_locale: locale,
    })
    const queryParams = searchParams.toString()

    // A document request clears cached locale redirects. Always include the
    // prefix so middleware updates the language cookie before canonicalising
    // English back to an unprefixed URL.
    const target = getPathname({
      href: queryParams.length > 0 ? `${pathname}?${queryParams}` : pathname,
      locale,
      forcePrefix: true,
    })
    window.location.replace(`${target}${window.location.hash}`)
  }

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger
        aria-label={t("language")}
        className={triggerClassName ?? "w-18 font-bold uppercase"}
      >
        <SelectValue>{locale}</SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base) shadow-xl shadow-black/40"
      >
        {routing.locales.map((locale, index) => (
          <React.Fragment key={locale}>
            <SelectItem
              key={locale}
              value={locale}
              className="text-(--t-ink-low) focus:bg-(--t-bg-surface) focus:text-(--t-ink-base) data-[state=checked]:text-(--t-ink-base)"
            >
              {localeTranslation[locale]}
            </SelectItem>
            {index < routing.locales.length - 1 && (
              <SelectSeparator
                key={`${locale}-separator`}
                className="bg-(--t-border-line)"
              />
            )}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LocaleSwitcher
