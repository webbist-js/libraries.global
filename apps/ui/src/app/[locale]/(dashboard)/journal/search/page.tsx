import type { Metadata } from "next"

import { SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

import { BlogSearchClient } from "./_components/SearchClient"

export const metadata: Metadata = {
  title: "Search the Journal",
  description: `Search articles in the ${SITE_NAME} Journal.`,
  robots: { index: false, follow: true },
}

export default function BlogSearchPage() {
  return (
    <div
      className="relative isolate flex min-h-0 w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <BlogSearchClient />
    </div>
  )
}
