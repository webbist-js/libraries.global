import { redirect } from "next/navigation"

/** Keep issued invitations and Stripe return links working after the URL change. */
export default async function LegacyTeamPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string; path?: string[] }>
  readonly searchParams: Promise<{ payment?: string; seats?: string }>
}) {
  const [{ locale, path = [] }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const suffix = path.map(encodeURIComponent).join("/")
  const allowed = new URLSearchParams()
  if (query.payment) allowed.set("payment", query.payment)
  if (query.seats) allowed.set("seats", query.seats)
  redirect(
    `${locale === "en" ? "" : `/${locale}`}/staff/teams${suffix ? `/${suffix}` : ""}${allowed.size ? `?${allowed}` : ""}`
  )
}
