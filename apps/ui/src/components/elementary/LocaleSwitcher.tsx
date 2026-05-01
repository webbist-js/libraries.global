"use client"

import { useSearchParams } from "next/navigation"
import type { Locale } from "next-intl"
import React, { useTransition } from "react"

import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { routing, usePathname, useRouter } from "@/lib/navigation"

const localeTranslation = {
  cs: "Czech",
  en: "English",
}

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
  // prevent the locale switch from blocking the UI thread
  const [, startTransition] = useTransition()

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLocaleChange = (locale: Locale) => {
    const queryParams = searchParams.toString()

    // next-intl router.replace does not persist query params
    startTransition(() => {
      router.replace(
        queryParams.length > 0 ? `${pathname}?${queryParams}` : pathname,
        { locale }
      )
    })
  }

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger className={triggerClassName ?? "w-18 font-bold uppercase"}>
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
