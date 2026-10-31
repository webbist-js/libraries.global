import type { Metadata } from "next"

import { SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

import { DocsSearchClient } from "./_components/SearchClient"

export const metadata: Metadata = {
  title: "Search the knowledge base",
  description: `Search the ${SITE_NAME} documentation.`,
  robots: { index: false, follow: true },
}

export default function DocsSearchPage() {
  return (
    <div
      className="relative isolate flex min-h-0 w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <DocsSearchClient />
    </div>
  )
}
