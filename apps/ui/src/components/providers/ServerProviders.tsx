import { NextIntlClientProvider } from "next-intl"
import type React from "react"

import { scopedMessages } from "@/i18n/scoped-messages"
import { setupLibraries } from "@/lib/general-helpers"

// Setup libraries in server environment
setupLibraries()

interface Props {
  readonly children: React.ReactNode
}

export async function ServerProviders({ children }: Props) {
  // Only the shell's messages: pages and layouts add their own scopes.
  const messages = (await scopedMessages("[locale]/layout")) ?? {}

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
