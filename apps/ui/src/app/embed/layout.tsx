import "@/styles/globals.css"

import type { Metadata } from "next"
import type { ReactNode } from "react"

import { fontFigtree, fontJetBrainsMono, fontNewsreader } from "@/lib/fonts"

export const metadata: Metadata = {
  title: "Library widget · Libraries Global",
  robots: { index: false, follow: false },
}
export default function EmbedLayout({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fontFigtree.variable} ${fontNewsreader.variable} ${fontJetBrainsMono.variable}`}
    >
      <body className="m-0 bg-white font-sans text-(--t-ink-base)">
        <a
          href="#widget-content"
          className="sr-only focus:not-sr-only focus:inline-flex focus:min-h-11 focus:p-3"
        >
          Skip to widget
        </a>
        <main
          id="widget-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl p-2 sm:p-4"
        >
          {children}
        </main>
      </body>
    </html>
  )
}
