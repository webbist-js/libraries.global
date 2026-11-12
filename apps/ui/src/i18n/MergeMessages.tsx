"use client"

import {
  NextIntlClientProvider,
  useLocale,
  useMessages,
  useTimeZone,
} from "next-intl"
import { useMemo, type ReactNode } from "react"

import { mergeMessages } from "./pick-messages"

/**
 * Adds a route's messages to those its layouts already sent. next-intl
 * providers replace messages rather than merge them, so this merges first.
 */
export function MergeMessages({
  messages,
  children,
}: {
  readonly messages: Record<string, unknown>
  readonly children: ReactNode
}) {
  const parent = useMessages()
  const locale = useLocale()
  const timeZone = useTimeZone()
  const merged = useMemo(
    () => mergeMessages(parent as Record<string, unknown>, messages),
    [parent, messages]
  )

  return (
    <NextIntlClientProvider
      locale={locale}
      timeZone={timeZone}
      messages={merged as typeof parent}
    >
      {children}
    </NextIntlClientProvider>
  )
}
