import { redirect } from "next/navigation"
import { getLocale } from "next-intl/server"

import { teamWorkspaceHref } from "@/lib/staff/paths"

/** Preserve bookmarks and in-flight checkout returns to the former Staff page. */
export default async function TeamApiPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    team?: string
    payment?: string
    setup?: string
  }>
}) {
  const [locale, query] = await Promise.all([getLocale(), searchParams])
  redirect(teamWorkspaceHref("/api", locale, query))
}
