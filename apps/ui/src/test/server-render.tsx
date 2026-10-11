import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import {
  renderToStaticMarkup as renderStatic,
  renderToString as renderString,
} from "react-dom/server"

import messages from "../../locales/en.json"

const withMessages = (node: ReactNode) => (
  <NextIntlClientProvider
    locale="en"
    messages={messages}
    timeZone="Europe/Prague"
  >
    {node}
  </NextIntlClientProvider>
)

export const renderToString = (node: ReactNode) =>
  renderString(withMessages(node))
export const renderToStaticMarkup = (node: ReactNode) =>
  renderStatic(withMessages(node))
