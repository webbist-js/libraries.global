import {
  render as testingLibraryRender,
  type RenderOptions,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactElement, ReactNode } from "react"

import messages from "../../locales/en.json"

export * from "@testing-library/react"

/** Component tests use the same translation context as the application shell. */
function EnglishMessages({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Europe/Prague"
    >
      {children}
    </NextIntlClientProvider>
  )
}

export function render(ui: ReactElement, options?: RenderOptions) {
  return testingLibraryRender(ui, { wrapper: EnglishMessages, ...options })
}
